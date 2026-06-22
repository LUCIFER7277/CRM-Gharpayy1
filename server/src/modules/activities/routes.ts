import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { Activity } from "../../../../src/contracts/entities.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";

const ListQuery = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  kind: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(200),
});

export function registerActivitiesRoutes(app: FastifyInstance) {
  app.get("/api/activities", { preHandler: [requireAuth, requireScope("activity.read")] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = {
      tenantId: req.user!.tenantId,
    };
    if (q.entityType) filter.entityType = q.entityType;
    if (q.entityId && q.entityId !== "_all_") filter.entityId = q.entityId;
    if (q.kind) filter.kind = q.kind;
    const items = await col<Activity>("activities")
      .find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });
}
