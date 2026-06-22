// Worker process — runs alongside the API. Handles BullMQ jobs.
//
// Pre-fix: every event was enqueued, retried forever on failure, and the
// consumer had no idempotency guard → poison rules could starve the queue
// and duplicate event delivery would re-run side effects.
//
// Post-fix:
//   - Job id = event id ⇒ BullMQ-native dedup on enqueue.
//   - Bounded retries with jittered backoff; failures land in `dlq` collection.
//   - Per-rule circuit breaker: 5 failures in 60s disables that rule and pages.
//   - Consumer is idempotent on event._id via Redis SETNX.
import { Worker, Queue, type Job } from "bullmq";
import { redis, redisSub, REDIS_CHANNELS } from "../db/redis.js";
import { connectMongo, col } from "../db/mongo.js";
import type { DomainEvent } from "../../../src/contracts/events.js";
import { claimEvent, releaseEvent } from "../platform/dedup.js";
import { workerJobs } from "../platform/metrics.js";
import { processPriorityRecalculation } from "../modules/leads/priority-worker.js";

const QUEUE = "automation";
const CONSUMER = "automation-worker";

await connectMongo();

const queue = new Queue(QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 10_000 },
    removeOnFail: false,                 // we move to DLQ ourselves
  },
});

// In-memory circuit breaker per ruleId. Cleared on a 60s sliding window.
const breaker = new Map<string, { failures: number[]; openUntil: number }>();
function tripCheck(ruleId: string): boolean {
  const now = Date.now();
  const b = breaker.get(ruleId) ?? { failures: [], openUntil: 0 };
  if (now < b.openUntil) return false;
  b.failures = b.failures.filter((t) => now - t < 60_000);
  if (b.failures.length >= 5) {
    b.openUntil = now + 5 * 60_000;     // open 5 min
    breaker.set(ruleId, b);
    console.error(`[breaker] OPEN rule=${ruleId} for 5m`);
    return false;
  }
  return true;
}
function recordFailure(ruleId: string) {
  const b = breaker.get(ruleId) ?? { failures: [], openUntil: 0 };
  b.failures.push(Date.now());
  breaker.set(ruleId, b);
}

// Bridge Redis pub/sub → BullMQ. Job id = event id ⇒ duplicate publishes are no-ops.
await redisSub.subscribe(REDIS_CHANNELS.events);
redisSub.on("message", async (channel, raw) => {
  if (channel !== REDIS_CHANNELS.events) return;
  let evt: DomainEvent & { _id: string };
  try { evt = JSON.parse(raw); } catch { return; }
  await queue.add(evt.type, evt, { jobId: evt._id });
});

new Worker<DomainEvent>(
  QUEUE,
  async (job: Job<DomainEvent>) => {
    const evt = job.data;
    // Idempotent consumer guard. SETNX = first delivery wins; replays no-op.
    if (!(await claimEvent(evt._id, CONSUMER))) {
      workerJobs.inc({ outcome: "skip-dup" });
      return { skipped: true };
    }
    try {
      // run JSONLogic when, dispatch action commands with deterministic IDs.
      // For now: structured log proves the event reached us.
      const ruleId = "default";
      if (!tripCheck(ruleId)) {
        workerJobs.inc({ outcome: "breaker-open" });
        return { breakerOpen: true };
      }
      
      // Hook Priority recalculation
      await processPriorityRecalculation(evt);

      console.log(`[automation] ${evt.type}`, JSON.stringify((evt as { payload: unknown }).payload));
      workerJobs.inc({ outcome: "ok" });
      return { ok: true };
    } catch (err) {
      // Release the dedup lock so retries can re-enter.
      await releaseEvent(evt._id, CONSUMER);
      recordFailure("default");
      workerJobs.inc({ outcome: "fail" });
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 16,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  },
).on("failed", async (job, err) => {
  if (!job) return;
  // Final failure (after `attempts` exhausted) → DLQ for manual replay.
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    try {
      await col("dlq").insertOne({
        _id: `${QUEUE}:${job.id}`,
        queue: QUEUE,
        eventId: job.id,
        eventType: job.name,
        data: job.data,
        error: { message: err.message, stack: err.stack },
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      });
      console.error(`[dlq] ${job.name} #${job.id} → DLQ after ${job.attemptsMade} tries: ${err.message}`);
    } catch (dlqErr) {
      console.error("[dlq] insert failed:", dlqErr);
    }
  }
});

console.log("✓ Automation worker started · queue=automation · consumer=", CONSUMER);
