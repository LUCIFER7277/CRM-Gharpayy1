import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";

const AddQuoteBody = z.object({
  leadId: z.string(),
  tcmId: z.string().optional(),
  propertyId: z.string().optional(),
  propertyName: z.string(),
  roomType: z.string(),
  roomNumber: z.string().optional(),
  actualRent: z.number(),
  discountedPrice: z.number(),
  deposit: z.number(),
  prebook: z.number(),
  maintenance: z.number(),
  maintenanceType: z.string(),
  lockIn: z.string(),
  notice: z.string(),
  validityMinutes: z.number(),
  validUntilISO: z.string(),
  message: z.string(),
});

const SetStatusBody = z.object({ status: z.enum(["sent", "paid", "not-paid", "expired", "cancelled"]), note: z.string().optional() });

export function registerQuotationsRoutes(app: FastifyInstance) {
  // List quotations (optionally filter by leadId)
  // Support both /api/quotations and /api/v1/quotations for client compatibility
  const listHandler = async (req: any, reply: any) => {
    const leadId = (req.query as any)?.leadId as string | undefined;
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId };
    if (leadId) filter.leadId = leadId;
    const items = await col("quotations").find(filter).sort({ _id: -1 }).limit(200).toArray();
    return reply.send(items);
  };

  app.get("/api/quotations", { preHandler: [requireAuth] }, listHandler);
  app.get("/api/v1/quotations", { preHandler: [requireAuth] }, listHandler);
  

  // Add quotation
  const postHandler = async (req: any, reply: any) => {
    const body = AddQuoteBody.parse(req.body);
    const now = new Date().toISOString();
    const rec = {
      ...body,
      tenantId: req.user!.tenantId,
      status: "sent",
      sentAt: now,
      paidAt: null,
      paymentNote: null,
    } as any;
    const r = await col("quotations").insertOne(rec as any);
    // include generated _id as id for backward compatibility
    const created = { ...rec, id: r.insertedId.toString() };
    // store _id as well
    await col("quotations").updateOne({ _id: r.insertedId }, { $set: { id: r.insertedId.toString() } });
    return reply.code(201).send(created);
  };

  app.post("/api/quotations", { preHandler: [requireAuth] }, postHandler);
  app.post("/api/v1/quotations", { preHandler: [requireAuth] }, postHandler);
  

  // Update status
  const putHandler = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = SetStatusBody.parse(req.body);
    const filter = { tenantId: req.user!.tenantId, $or: [{ id }, { _id: id }] } as any;
    const existing = await col("quotations").findOne(filter);
    if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "Quotation not found" });
    const updates: any = { status: body.status };
    if (body.status === "paid") updates.paidAt = new Date().toISOString();
    if (body.note) updates.paymentNote = body.note;
    await col("quotations").updateOne(filter, { $set: updates });
    const updated = await col("quotations").findOne(filter);
    return reply.send(updated);
  };

  app.put("/api/quotations/:id/status", { preHandler: [requireAuth] }, putHandler);
  app.put("/api/v1/quotations/:id/status", { preHandler: [requireAuth] }, putHandler);
}
