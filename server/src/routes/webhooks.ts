// Async webhook ingress.
//
// Pre-fix: vendors hitting /webhooks could DoS the command path because
// translation + DB writes happened inline.
//
// Post-fix: verify signature (when configured), persist raw payload to a
// queue + collection, return 202 immediately. A worker translates → command.
import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Queue } from "bullmq";
import { redis } from "../db/redis.js";
import { col } from "../db/mongo.js";
import { ulid } from "../../../src/contracts/ids.js";

const QUEUE = "webhooks_in";

const inbox = new Queue(QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 5_000 },
    removeOnFail: false,
  },
});

const SECRETS: Record<string, string | undefined> = {
  wa: process.env.WEBHOOK_SECRET_WA,
  dialer: process.env.WEBHOOK_SECRET_DIALER,
  payments: process.env.WEBHOOK_SECRET_PAYMENTS,
};

function verify(secret: string | undefined, signature: string | null, body: string): boolean {
  if (!secret) return true;                  // dev mode: no secret = accept (warn at startup)
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export function registerWebhookRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/:vendor", {
    config: { rawBody: true },
    bodyLimit: 1024 * 256,                   // 256KB cap — vendors don't need more
  }, async (req, reply) => {
    const { vendor } = req.params as { vendor: string };
    if (!/^[a-z][a-z0-9_-]{1,30}$/.test(vendor)) {
      return reply.code(400).send({ code: "VALIDATION_FAILED", message: "Invalid vendor" });
    }
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const sig = (req.headers["x-webhook-signature"] as string | undefined) ?? null;
    if (!verify(SECRETS[vendor], sig, raw)) {
      return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Bad signature" });
    }
    const id = ulid();
    const record = {
      _id: id, vendor, raw,
      headers: { "x-webhook-signature": sig, "user-agent": req.headers["user-agent"] ?? null },
      receivedAt: new Date().toISOString(),
      ip: req.ip,
    };
    // Durable record FIRST (so we never lose a webhook even if Redis is down),
    // then enqueue. Idempotent on _id.
    await col("webhooks_in").insertOne(record);
    await inbox.add(vendor, record, { jobId: id });
    return reply.code(202).send({ ok: true, id });
  });
}
