import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";

interface EventDoc {
  _id: string;
  type: string;
  occurredAt: string;
  actor: string;
  tenantId: string;
  payload?: Record<string, unknown>;
}

export function registerActivityFeedRoutes(app: FastifyInstance) {
  const events = () => col<EventDoc>("entity_event");

  // Login/logout audit feed (super_admin)
  app.get("/api/activity/login", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const q = z.object({ limit: z.coerce.number().min(1).max(500).default(100) }).parse(req.query);
    const items = await events()
      .find({ tenantId: req.user!.tenantId, type: { $in: ["evt.user.login", "evt.user.logout"] } })
      .sort({ occurredAt: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });

  // System-wide event feed (super_admin)
  app.get("/api/activity/all", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const q = z.object({ limit: z.coerce.number().min(1).max(500).default(200) }).parse(req.query);
    const items = await events()
      .find({ tenantId: req.user!.tenantId })
      .sort({ occurredAt: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });

  // Per-lead activity stream
  app.get("/api/activity/lead", { preHandler: [requireAuth, requireScope("activity.read")] }, async (req, reply) => {
    const q = z.object({
      leadId: z.string(),
      limit: z.coerce.number().min(1).max(500).default(200),
    }).parse(req.query);
    const items = await events()
      .find({
        tenantId: req.user!.tenantId,
        $or: [
          { "payload.leadId": q.leadId },
          { "payload.lead._id": q.leadId },
        ],
      })
      .sort({ occurredAt: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });
}
