import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import { ulid } from "../../../../src/contracts/ids.js";

const FollowUpDoc = z.object({
  _id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  tourId: z.string().optional().default(""),
  tcmId: z.string(),
  dueAt: z.string(),
  priority: z.enum(["high", "medium", "low", "urgent"]),
  reason: z.string().default(""),
  done: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateBody = z.object({
  leadId: z.string().min(1),
  tourId: z.string().optional(),
  tcmId: z.string().min(1),
  dueAt: z.string().min(1),
  priority: z.enum(["high", "medium", "low", "urgent"]),
  reason: z.string().optional().default(""),
});

const ListQuery = z.object({
  leadId: z.string().optional(),
  done: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(500).default(200),
});

export function registerFollowUpsRoutes(app: FastifyInstance) {
  app.get("/api/follow-ups", { preHandler: [requireAuth] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.leadId) filter.leadId = q.leadId;
    if (q.done !== undefined) filter.done = q.done;
    const items = await col("follow_ups")
      .find(filter)
      .sort({ dueAt: 1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });

  app.post("/api/follow-ups", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const now = new Date().toISOString();
    const doc = {
      _id: ulid(),
      tenantId: req.user!.tenantId,
      leadId: body.leadId,
      tourId: body.tourId ?? "",
      tcmId: body.tcmId,
      dueAt: body.dueAt,
      priority: body.priority,
      reason: body.reason,
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    await col("follow_ups").insertOne(doc);
    return reply.status(201).send(doc);
  });

  app.patch("/api/follow-ups/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.done === "boolean") update.done = body.done;
    if (typeof body.priority === "string") update.priority = body.priority;
    if (typeof body.dueAt === "string") update.dueAt = body.dueAt;
    if (typeof body.reason === "string") update.reason = body.reason;
    const result = await col("follow_ups").findOneAndUpdate(
      { _id: id, tenantId: req.user!.tenantId },
      { $set: update },
      { returnDocument: "after" },
    );
    if (!result) return reply.status(404).send({ error: "not_found" });
    return reply.send(result);
  });
}
