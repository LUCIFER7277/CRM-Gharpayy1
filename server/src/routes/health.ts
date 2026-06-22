import type { FastifyInstance } from "fastify";
import { col, getDb } from "../db/mongo.js";
import { redis } from "../db/redis.js";
import { outboxBacklog } from "../realtime/event-bus.js";
import { render as renderMetrics } from "../platform/metrics.js";

export function registerHealthRoutes(app: FastifyInstance) {
  // Liveness — just "the process is up". Used by NGINX / PM2 / k8s.
  app.get("/healthz", async () => ({ ok: true, ts: new Date().toISOString() }));

  // Readiness — refuses traffic when downstreams are degraded. Used by load
  // balancers to drain a sick node without killing it.
  app.get("/readyz", async (_req, reply) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    // Mongo
    try {
      await getDb().command({ ping: 1 });
      checks.mongo = { ok: true };
    } catch (e) {
      checks.mongo = { ok: false, detail: (e as Error).message };
    }

    // Redis
    try {
      const pong = await redis.ping();
      checks.redis = { ok: pong === "PONG" };
    } catch (e) {
      checks.redis = { ok: false, detail: (e as Error).message };
    }

    // Outbox backlog — > 50 pending events older than 5s = degraded.
    try {
      const lag = await outboxBacklog(5000);
      checks.outbox = { ok: lag < 50, detail: `${lag} pending > 5s` };
    } catch (e) {
      checks.outbox = { ok: false, detail: (e as Error).message };
    }

    // DLQ depth — > 100 = page on-call.
    try {
      const dlqCount = await col("dlq").estimatedDocumentCount();
      checks.dlq = { ok: dlqCount < 100, detail: `${dlqCount} dead jobs` };
    } catch (e) {
      checks.dlq = { ok: false, detail: (e as Error).message };
    }

    const ok = Object.values(checks).every((c) => c.ok);
    return reply.code(ok ? 200 : 503).send({ ok, checks });
  });

  // Prometheus scrape endpoint.
  app.get("/metrics", async (_req, reply) => {
    reply.header("content-type", "text/plain; version=0.0.4");
    return renderMetrics();
  });
}
