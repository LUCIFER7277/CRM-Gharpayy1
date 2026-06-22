import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env, corsOrigins } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./db/mongo.js";
import { redis, redisPub, redisSub } from "./db/redis.js";
import { attachSocketIO, io } from "./realtime/socket.js";
import { startOutboxPublisher, stopOutboxPublisher } from "./realtime/event-bus.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerLeadsRoutes } from "./modules/leads/routes.js";
import { registerToursRoutes } from "./modules/tours/routes.js";
import { registerTodosRoutes } from "./modules/todos/routes.js";
import { registerActivitiesRoutes } from "./modules/activities/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerZoneRoutes } from "./modules/zones/routes.js";
import { registerPropertyRoutes } from "./modules/properties/routes.js";
import { registerActivityFeedRoutes } from "./modules/activity/feed-routes.js";
import { registerStatsRoutes } from "./modules/stats/routes.js";
import { registerQuotationsRoutes } from "./modules/quotations/routes.js";
import { registerFollowUpsRoutes } from "./modules/followups/routes.js";
import { registerHandoffsRoutes } from "./modules/handoffs/routes.js";
import { registerSequencesRoutes } from "./modules/sequences/routes.js";
import { registerBookingsRoutes } from "./modules/bookings/routes.js";
import { registerTenantsRoutes } from "./modules/tenants/routes.js";
import { registerOwnerRoutes } from "./modules/owner/routes.js";
import { ensureDefaultSuperAdmin } from "./auth/auth.js";

async function main() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    trustProxy: true,
    // Generate a per-request correlation id surfaced as `req.id` and threaded
    // into events, jobs, logs, and WS broadcasts. Single grep across the stack.
    genReqId: () => `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) {
        return cb(null, true);
      }
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        return cb(null, true);
      }
      if (env.NODE_ENV === "development" && /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Requested-With", "Accept", "Origin"],
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.NODE_ENV === "development" ? 10000 : 300,
    timeWindow: "1 minute",
    // Only use Redis store in production — in dev the in-memory store avoids
    // issues when Redis is not running or the adapter misbehaves.
    ...(env.NODE_ENV !== "development" ? { redis } : {}),
    keyGenerator: (req) => {
      // Per-user when authenticated, per-IP otherwise. Avoids one user starving
      // a shared NAT.
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) return `u:${auth.slice(7, 24)}`;
      return `ip:${req.ip}`;
    },
  });

  await connectMongo();

  // Root status — quick visual confirmation that the server is up.
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Gharpayy API</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1e293b;padding:2rem 2.5rem;border-radius:12px;border:1px solid #334155;text-align:center}
h1{margin:0 0 .5rem;font-size:1.5rem;color:#34d399}p{margin:.25rem 0;color:#94a3b8}code{color:#fbbf24}</style>
</head><body><div class="card"><h1>✓ Backend is running</h1>
<p>Gharpayy API on port <code>${env.PORT}</code></p>
<p>${new Date().toISOString()}</p></div></body></html>`
    );
  });

  // Health/metrics first — MUST work even before everything else is wired.
  registerHealthRoutes(app);
  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerLeadsRoutes(app);
  registerToursRoutes(app);
  registerTodosRoutes(app);
  registerActivitiesRoutes(app);
  registerUserRoutes(app);
  registerZoneRoutes(app);
  registerPropertyRoutes(app);
  registerActivityFeedRoutes(app);
  registerStatsRoutes(app);
  registerQuotationsRoutes(app);
  registerFollowUpsRoutes(app);
  registerHandoffsRoutes(app);
  registerSequencesRoutes(app);
  registerBookingsRoutes(app);
  registerTenantsRoutes(app);
  registerOwnerRoutes(app);

  // Idempotent — bootstraps the canonical Super Admin if missing.
  await ensureDefaultSuperAdmin().catch((err) => app.log.warn({ err }, "ensureDefaultSuperAdmin failed"));

  await attachSocketIO(app);

  // Outbox publisher: turns durable events into pub/sub broadcasts.
  // Multiple replicas can run; per-row lease prevents double-publish.
  startOutboxPublisher(app.log);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`✓ Gharpayy server listening on ${env.HOST}:${env.PORT}`);

  // ---------- Graceful shutdown ----------
  // PM2/k8s sends SIGTERM; we have ~10s before SIGKILL. Order matters:
  //   1) stop accepting new HTTP/WS
  //   2) drain in-flight (Fastify close awaits handlers)
  //   3) flush outbox publisher
  //   4) close Mongo + Redis
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutdown initiated");
    try {
      await app.close();                // 1 + 2
      if (io) await new Promise<void>((res) => io!.close(() => res()));
      await stopOutboxPublisher();      // 3
      await disconnectMongo();
      await Promise.allSettled([redis.quit(), redisPub.quit(), redisSub.quit()]);
      app.log.info("shutdown clean");
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => app.log.error({ reason }, "unhandledRejection"));
  process.on("uncaughtException",  (err)    => app.log.error({ err },    "uncaughtException"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
