import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import { ulid } from "../../../../src/contracts/ids.js";

const SequenceKind = z.enum(["post-tour", "pre-decision", "cold-revival", "first-contact"]);

const SequenceDoc = z.object({
  _id: z.string(),
  tenantId: z.string(),
  leadId: z.string(),
  kind: SequenceKind,
  startedAt: z.string(),
  currentStep: z.number().int().min(0).default(0),
  paused: z.boolean().default(false),
  stoppedReason: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateBody = z.object({
  leadId: z.string().min(1),
  kind: SequenceKind,
});

const ListQuery = z.object({
  leadId: z.string().optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(500).default(200),
});

export function registerSequencesRoutes(app: FastifyInstance) {
  app.get("/api/sequences", { preHandler: [requireAuth] }, async (req, reply) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (q.leadId) filter.leadId = q.leadId;
    if (q.active === true) filter.stoppedReason = null;
    else if (q.active === false) filter.stoppedReason = { $ne: null };
    const items = await col("sequences")
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(q.limit)
      .toArray();
    return reply.send({ items });
  });

  app.post("/api/sequences", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const now = new Date().toISOString();
    const doc = {
      _id: ulid(),
      tenantId: req.user!.tenantId,
      leadId: body.leadId,
      kind: body.kind,
      startedAt: now,
      currentStep: 0,
      paused: false,
      stoppedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await col("sequences").insertOne(doc);
    return reply.status(201).send(doc);
  });

  app.patch("/api/sequences/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.paused === "boolean") update.paused = body.paused;
    if (typeof body.stoppedReason === "string") update.stoppedReason = body.stoppedReason;
    if (body.stoppedReason === null) update.stoppedReason = null;
    if (typeof body.currentStep === "number") update.currentStep = body.currentStep;

    const result = await col("sequences").findOneAndUpdate(
      { _id: id, tenantId: req.user!.tenantId },
      { $set: update },
      { returnDocument: "after" },
    );
    if (!result) return reply.status(404).send({ error: "not_found" });
    return reply.send(result);
  });
}
