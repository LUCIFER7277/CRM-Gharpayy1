import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { emit, newEventId } from "../../realtime/event-bus.js";

const HandoffDoc = z.object({
  _id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  ts: z.string(),
  from: z.string(),
  fromId: z.string(),
  to: z.string(),
  text: z.string().default(""),
  priority: z.enum(["normal", "urgent"]),
  read: z.boolean().default(false),
});

const CreateBody = z.object({
  leadId: z.string().min(1),
  from: z.string().min(1),
  fromId: z.string().min(1),
  to: z.string().min(1),
  text: z.string().default(""),
  priority: z.enum(["normal", "urgent"]),
});

const ListQuery = z.object({
  leadId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(200),
});

export function registerHandoffsRoutes(app: FastifyInstance) {
  app.get("/api/v1/handoffs", { preHandler: [requireAuth] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.leadId) filter.leadId = q.leadId;
    const items = await col("handoffs")
      .find(filter)
      .sort({ ts: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });

  app.post("/api/v1/handoffs", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const doc = {
      _id: ulid(),
      tenantId: req.user!.tenantId,
      leadId: body.leadId,
      ts: new Date().toISOString(),
      from: body.from,
      fromId: body.fromId,
      to: body.to,
      text: body.text,
      priority: body.priority,
      read: false,
    };
    await col("handoffs").insertOne(doc);
    await emit({
      _id: newEventId(),
      type: "evt.handoff.created",
      occurredAt: doc.ts,
      actor: req.user!.sub,
      tenantId: req.user!.tenantId,
      correlationId: req.id,
      causationId: null,
      version: 1,
      payload: { handoffId: doc._id },
    });
    return reply.status(201).send(doc);
  });

  app.post("/api/v1/handoffs/mark-read", { preHandler: [requireAuth] }, async (req, reply) => {
    const { leadId } = req.body as { leadId: string };
    if (!leadId) return reply.status(400).send({ error: "leadId required" });
    const unread = await col("handoffs").find({ tenantId: req.user!.tenantId, leadId, read: false }).toArray();
    let modifiedCount = 0;
    if (unread.length > 0) {
      const result = await col("handoffs").updateMany(
        { tenantId: req.user!.tenantId, leadId, read: false },
        { $set: { read: true } },
      );
      modifiedCount = result.modifiedCount;
      const now = new Date().toISOString();
      for (const h of unread) {
        await emit({
          _id: newEventId(),
          type: "evt.handoff.updated",
          occurredAt: now,
          actor: req.user!.sub,
          tenantId: req.user!.tenantId,
          correlationId: req.id,
          causationId: null,
          version: 1,
          payload: { handoffId: h._id },
        });
      }
    }
    return reply.send({ modifiedCount });
  });
}
