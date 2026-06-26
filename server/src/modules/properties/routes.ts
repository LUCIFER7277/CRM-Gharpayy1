import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { emit, newEventId } from "../../realtime/event-bus.js";

export interface PropertyDoc {
  _id: string;
  tenantId: string;
  name: string;
  zoneId: string;
  area: string;
  address: string;
  totalBeds: number;
  vacantBeds: number;
  pricePerBed: number;
  /** MongoDB _id of the owner user (role: "owner"). Optional — populated via admin or migration. */
  ownerId?: string | null;
  /** Display name cache — denormalised from the owner user doc for read performance. */
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

const PropertyFields = {
  name: z.string().min(1).max(120),
  zoneId: z.string().min(1),
  area: z.string().max(120),
  address: z.string().max(250).optional().default(""),
  totalBeds: z.number().int().min(0).default(0),
  vacantBeds: z.number().int().min(0).default(0),
  pricePerBed: z.number().int().min(0).default(0),
  ownerId: z.string().nullable().optional(),
};

const CreateBody = z.object(PropertyFields);
const UpdateBody = z.object(PropertyFields);

function propertyOut(p: PropertyDoc) {
  return {
    id: p._id,
    name: p.name,
    zoneId: p.zoneId,
    area: p.area,
    address: p.address,
    totalBeds: p.totalBeds,
    vacantBeds: p.vacantBeds,
    pricePerBed: p.pricePerBed,
    ownerId: p.ownerId ?? null,
    ownerName: p.ownerName ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function registerPropertyRoutes(app: FastifyInstance) {
  const properties = () => col<PropertyDoc>("properties");

  // List properties
  app.get("/api/v1/properties", { preHandler: [requireAuth] }, async (req, reply) => {
    const list = await properties()
      .find({ tenantId: req.user!.tenantId })
      .sort({ name: 1 })
      .toArray();
    return reply.send(list.map(propertyOut));
  });

  // Create property
  app.post("/api/v1/properties", { preHandler: [requireAuth, requireScope("inventory.block")] }, async (req, reply) => {
    try {
      const body = CreateBody.parse(req.body);
      const name = body.name.trim();
      const exists = await properties().findOne({ tenantId: req.user!.tenantId, name });
      if (exists) return reply.code(409).send({ code: "CONFLICT", message: "Property name already exists" });

      // Resolve owner display name if ownerId provided
      let ownerName: string | null = null;
      if (body.ownerId) {
        const ownerUser = await col<import("../../auth/auth.js").UserDoc>("users").findOne({ _id: body.ownerId, tenantId: req.user!.tenantId, role: "owner" });
        ownerName = ownerUser?.fullName ?? null;
      }

      const now = new Date().toISOString();
      const doc: PropertyDoc = {
        _id: ulid(),
        tenantId: req.user!.tenantId,
        name,
        zoneId: body.zoneId,
        area: body.area.trim(),
        address: body.address.trim(),
        totalBeds: body.totalBeds,
        vacantBeds: body.vacantBeds,
        pricePerBed: body.pricePerBed,
        ownerId: body.ownerId ?? null,
        ownerName,
        createdAt: now,
        updatedAt: now,
      };
      await properties().insertOne(doc);
      await emit({
        _id: newEventId(),
        type: "evt.property.created",
        occurredAt: now,
        actor: req.user!.sub,
        tenantId: req.user!.tenantId,
        correlationId: req.id,
        causationId: null,
        version: 1,
        payload: { propertyId: doc._id },
      });

      const { autoLogActivity } = await import("../activities/command-handlers.js");
      await autoLogActivity({
        entityType: "unit",
        entityId: doc._id,
        kind: "created",
        subject: `Property Created`,
        body: `Property ${name} created in zone ${body.zoneId}`,
        meta: { propertyId: doc._id },
        user: req.user!,
        correlationId: req.id,
      });

      return reply.code(201).send(propertyOut(doc));
    } catch (e) {
      const err = e as Error;
      return reply.code(400).send({ code: "BAD_REQUEST", message: err.message });
    }
  });

  // Update property
  app.put("/api/v1/properties/:id", { preHandler: [requireAuth, requireScope("inventory.block")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = UpdateBody.parse(req.body);
      const name = body.name.trim();

      const dupe = await properties().findOne({ tenantId: req.user!.tenantId, name, _id: { $ne: id } });
      if (dupe) return reply.code(409).send({ code: "CONFLICT", message: "Property name already exists" });

      // Resolve owner display name if ownerId provided
      let ownerName: string | null | undefined;
      if (body.ownerId !== undefined) {
        if (body.ownerId) {
          const ownerUser = await col<import("../../auth/auth.js").UserDoc>("users").findOne({ _id: body.ownerId, tenantId: req.user!.tenantId, role: "owner" });
          ownerName = ownerUser?.fullName ?? null;
        } else {
          ownerName = null;
        }
      }

      const setFields: Partial<PropertyDoc> = {
        name,
        zoneId: body.zoneId,
        area: body.area.trim(),
        address: body.address.trim(),
        totalBeds: body.totalBeds,
        vacantBeds: body.vacantBeds,
        pricePerBed: body.pricePerBed,
        updatedAt: new Date().toISOString(),
      };
      if (body.ownerId !== undefined) {
        setFields.ownerId = body.ownerId ?? null;
        if (ownerName !== undefined) setFields.ownerName = ownerName;
      }

      const r = await properties().findOneAndUpdate(
        { _id: id, tenantId: req.user!.tenantId },
        { $set: setFields },
        { returnDocument: "after" },
      );
      if (!r) return reply.code(404).send({ code: "NOT_FOUND", message: "Property not found" });
      await emit({
        _id: newEventId(),
        type: "evt.property.updated",
        occurredAt: new Date().toISOString(),
        actor: req.user!.sub,
        tenantId: req.user!.tenantId,
        correlationId: req.id,
        causationId: null,
        version: 1,
        payload: { propertyId: r._id },
      });

      const { autoLogActivity } = await import("../activities/command-handlers.js");
      await autoLogActivity({
        entityType: "unit",
        entityId: r._id,
        kind: "field_changed",
        subject: `Property Updated`,
        body: `Property ${name} updated (beds: ${body.totalBeds}, vacant: ${body.vacantBeds}, price: ₹${body.pricePerBed})`,
        meta: { propertyId: r._id, totalBeds: body.totalBeds, vacantBeds: body.vacantBeds, pricePerBed: body.pricePerBed },
        user: req.user!,
        correlationId: req.id,
      });

      return reply.send(propertyOut(r));
    } catch (e) {
      const err = e as Error;
      return reply.code(400).send({ code: "BAD_REQUEST", message: err.message });
    }
  });

  // Assign owner to property (admin shortcut endpoint)
  app.patch("/api/v1/properties/:id/owner", { preHandler: [requireAuth, requireScope("inventory.block")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.body as { ownerId: string | null };

    let ownerName: string | null = null;
    if (ownerId) {
      const ownerUser = await col<import("../../auth/auth.js").UserDoc>("users").findOne({ _id: ownerId, tenantId: req.user!.tenantId, role: "owner" });
      if (!ownerUser) return reply.code(404).send({ code: "NOT_FOUND", message: "Owner user not found" });
      ownerName = ownerUser.fullName;
    }

    const r = await properties().findOneAndUpdate(
      { _id: id, tenantId: req.user!.tenantId },
      { $set: { ownerId: ownerId ?? null, ownerName, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    if (!r) return reply.code(404).send({ code: "NOT_FOUND", message: "Property not found" });
    await emit({
      _id: newEventId(),
      type: "evt.property.updated",
      occurredAt: new Date().toISOString(),
      actor: req.user!.sub,
      tenantId: req.user!.tenantId,
      correlationId: req.id,
      causationId: null,
      version: 1,
      payload: { propertyId: r._id },
    });

    const { autoLogActivity } = await import("../activities/command-handlers.js");
    await autoLogActivity({
      entityType: "unit",
      entityId: r._id,
      kind: "assigned",
      subject: ownerId ? `Property Assigned` : `Property Unassigned`,
      body: ownerId ? `Property assigned to owner: ${ownerName || ownerId}` : `Property unassigned from owner`,
      meta: { propertyId: r._id, ownerId },
      user: req.user!,
      correlationId: req.id,
    });

    return reply.send(propertyOut(r));
  });

  // Delete property
  app.delete("/api/v1/properties/:id", { preHandler: [requireAuth, requireScope("inventory.block")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await properties().deleteOne({ _id: id, tenantId: req.user!.tenantId });
    if (r.deletedCount === 0) return reply.code(404).send({ code: "NOT_FOUND", message: "Property not found" });
    await emit({
      _id: newEventId(),
      type: "evt.property.deleted",
      occurredAt: new Date().toISOString(),
      actor: req.user!.sub,
      tenantId: req.user!.tenantId,
      correlationId: req.id,
      causationId: null,
      version: 1,
      payload: { propertyId: id },
    });

    const { autoLogActivity: logDelete } = await import("../activities/command-handlers.js");
    await logDelete({
      entityType: "unit",
      entityId: id,
      kind: "stage_changed",
      subject: `Property Deleted`,
      body: `Property ${id} was deleted`,
      meta: { propertyId: id },
      user: req.user!,
      correlationId: req.id,
    });

    return reply.send({ ok: true });
  });
}
