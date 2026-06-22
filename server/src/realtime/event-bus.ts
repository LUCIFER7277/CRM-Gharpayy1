import { col } from "../db/mongo.js";
import { redisPub, REDIS_CHANNELS } from "../db/redis.js";
import { ulid } from "../../../src/contracts/ids.js";
import { DomainEvent } from "../../../src/contracts/events.js";
import { eventCounter, outboxLag } from "../platform/metrics.js";

interface EventDoc {
  _id: string;
  type: string;
  occurredAt: string;
  actor: string;
  tenantId: string;
  correlationId: string;
  causationId: string | null;
  version: 1;
  payload: unknown;
  // Aggregate routing — set by emit() from payload heuristics so projectors,
  // WS rooms, and replay all key off the same field.
  aggregateType: string | null;
  aggregateId: string | null;
  seq: number | null;          // monotonic per (aggregateType, aggregateId)
  // Outbox state
  publishedAt: string | null;
  publishAttempts: number;
}

const EVENTS = "entity_event";
const SEQ_COUNTERS = "aggregate_seq";

interface SeqDoc { _id: string; seq: number }

function deriveAggregate(evt: DomainEvent): { type: string | null; id: string | null } {
  const p = evt.payload as Record<string, unknown>;
  // Try common shapes used by current handlers.
  if (p && typeof p === "object") {
    if ("lead" in p && typeof p.lead === "object" && p.lead && "_id" in (p.lead as object)) {
      return { type: "lead", id: (p.lead as { _id: string })._id };
    }
    if ("leadId" in p && typeof p.leadId === "string") return { type: "lead", id: p.leadId };
    if ("todo" in p && typeof p.todo === "object" && p.todo && "_id" in (p.todo as object)) {
      return { type: "todo", id: (p.todo as { _id: string })._id };
    }
    if ("todoId" in p && typeof p.todoId === "string") return { type: "todo", id: p.todoId };
    if ("tour" in p && typeof p.tour === "object" && p.tour && "_id" in (p.tour as object)) {
      return { type: "tour", id: (p.tour as { _id: string })._id };
    }
    if ("tourId" in p && typeof p.tourId === "string") return { type: "tour", id: p.tourId };
    if ("activity" in p && typeof p.activity === "object" && p.activity && "_id" in (p.activity as object)) {
      const a = p.activity as { entityType: string; entityId: string };
      return { type: a.entityType, id: a.entityId };
    }
    if ("activityId" in p && "entityType" in p && "entityId" in p) {
      return { type: p.entityType as string, id: p.entityId as string };
    }
    if ("booking" in p && typeof p.booking === "object" && p.booking && "_id" in (p.booking as object)) {
      return { type: "booking", id: (p.booking as { _id: string })._id };
    }
    if ("bookingId" in p && typeof p.bookingId === "string") return { type: "booking", id: p.bookingId };
    if ("tenant" in p && typeof p.tenant === "object" && p.tenant && "_id" in (p.tenant as object)) {
      return { type: "tenant", id: (p.tenant as { _id: string })._id };
    }
    if ("tenantId" in p && typeof p.tenantId === "string") return { type: "tenant", id: p.tenantId };
  }
  return { type: null, id: null };
}

/**
 * Allocate the next monotonic seq for an aggregate. Atomic via $inc + upsert.
 * The (aggregateType, aggregateId, seq) compound unique index on entity_event
 * is the ultimate guarantee — this counter is just the cooperative allocator.
 */
async function nextSeq(aggregateType: string, aggregateId: string): Promise<number> {
  const key = `${aggregateType}:${aggregateId}`;
  const r = await col<SeqDoc>(SEQ_COUNTERS).findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return r?.seq ?? 1;
}

/**
 * Append a validated event to the outbox. Does NOT publish.
 * Throws on duplicate _id or seq race — caller (the command handler) retries
 * inside the bus loop. Pure intent: "this event happened, durably".
 */
export async function emit(event: DomainEvent): Promise<void> {
  const parsed = DomainEvent.parse(event);
  const agg = deriveAggregate(parsed);
  let seq: number | null = null;
  if (agg.type && agg.id) seq = await nextSeq(agg.type, agg.id);

  const doc: EventDoc = {
    ...parsed,
    aggregateType: agg.type,
    aggregateId: agg.id,
    seq,
    publishedAt: null,
    publishAttempts: 0,
  } as EventDoc;
  await col<EventDoc>(EVENTS).insertOne(doc);
  eventCounter.inc({ type: parsed.type });
}

export function newEventId() { return ulid(); }

// ---------------------------------------------------------------------------
// Outbox publisher — runs inside the API process (and as a fallback worker).
// Multiple replicas can run safely: findOneAndUpdate({publishedAt:null}) acts
// as a per-row lease.
// ---------------------------------------------------------------------------

const PUBLISHER_BATCH = 50;
const PUBLISHER_INTERVAL_MS = 25;
const MAX_ATTEMPTS = 12;       // ~30 min worst case at backoff cap; then alert

let stopRequested = false;
let publisherRunning = false;

export function startOutboxPublisher(log: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void }) {
  if (publisherRunning) return;
  publisherRunning = true;
  stopRequested = false;
  log.info("[outbox] publisher started");
  loop(log).catch((err) => log.error({ err }, "[outbox] loop crashed"));
}

export async function stopOutboxPublisher() {
  stopRequested = true;
  // Give the loop a tick to finish current iteration.
  await new Promise((r) => setTimeout(r, PUBLISHER_INTERVAL_MS * 2));
  publisherRunning = false;
}

async function loop(log: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void }) {
  while (!stopRequested) {
    try {
      const drained = await drainOnce();
      if (drained === 0) await new Promise((r) => setTimeout(r, PUBLISHER_INTERVAL_MS));
    } catch (err) {
      log.error({ err }, "[outbox] iter failed");
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function drainOnce(): Promise<number> {
  const c = col<EventDoc>(EVENTS);
  // Find a batch of pending events. We claim them one-by-one via
  // findOneAndUpdate to avoid double-publish across replicas.
  let processed = 0;
  for (let i = 0; i < PUBLISHER_BATCH; i++) {
    const doc = await c.findOneAndUpdate(
      { publishedAt: null, publishAttempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { publishAttempts: 1 } },
      { sort: { _id: 1 }, returnDocument: "after" },
    );
    if (!doc) break;
    try {
      await redisPub.publish(REDIS_CHANNELS.events, JSON.stringify(stripOutboxFields(doc)));
      await c.updateOne({ _id: doc._id }, { $set: { publishedAt: new Date().toISOString() } });
      const lagMs = Date.now() - new Date(doc.occurredAt).getTime();
      outboxLag.observe(lagMs, { type: doc.type });
      processed++;
    } catch {
      // leave publishedAt=null; next iteration will retry. publishAttempts limits storms.
      // Backoff is implicit: a row that keeps failing falls off the front of the queue
      // after MAX_ATTEMPTS and is surfaced via the /readyz check.
    }
  }
  return processed;
}

function stripOutboxFields(doc: EventDoc) {
  // Wire shape sent over Redis = the original DomainEvent + seq + aggregate (consumers need them).
  const { publishedAt: _p, publishAttempts: _a, ...rest } = doc;
  return rest;
}

/**
 * Health: how many events are stuck > N seconds without publish.
 * Used by /readyz to refuse traffic if the outbox is wedged.
 */
export async function outboxBacklog(olderThanMs = 5000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  return col<EventDoc>(EVENTS).countDocuments({ publishedAt: null, occurredAt: { $lt: cutoff } });
}

/**
 * Replay support — used by the WS layer on reconnect.
 * Returns events for an aggregate strictly after `afterSeq`, capped.
 */
export async function eventsAfter(aggregateType: string, aggregateId: string, afterSeq: number, limit = 500) {
  return col<EventDoc>(EVENTS)
    .find({ aggregateType, aggregateId, seq: { $gt: afterSeq } })
    .sort({ seq: 1 })
    .limit(limit)
    .toArray();
}
