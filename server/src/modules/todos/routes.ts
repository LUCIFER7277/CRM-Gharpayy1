import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { Todo } from "../../../../src/contracts/entities.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";

const ListQuery = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  scope: z.enum(["mine", "entity", "all"]).optional(),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export function registerTodosRoutes(app: FastifyInstance) {
  app.get("/api/todos", { preHandler: [requireAuth, requireScope("todo.read")] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.entityType) filter.entityType = q.entityType;
    if (q.entityId) filter.entityId = q.entityId;
    if (q.scope === "mine") {
      filter.$or = [
        { assignedTo: req.user!.sub },
        { createdBy: req.user!.sub, assignedTo: null },
      ];
    }
    const items = await col<Todo>("todos").find(filter).sort({ _id: -1 }).limit(q.limit).toArray();
    return reply.send({ items });
  });
}
