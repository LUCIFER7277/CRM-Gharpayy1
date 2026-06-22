import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { ulid } from "../../../../src/contracts/ids.js";

export interface ZoneDoc {
  _id: string;
  tenantId: string;
  name: string;
  city: string;
  areas: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

const ZoneFields = {
  name: z.string().min(1).max(80),
  city: z.string().max(80).optional().default(""),
  areas: z.array(z.string().min(1).max(80)).max(100).optional().default([]),
  color: z.string().max(20).optional().default(""),
};
const CreateBody = z.object(ZoneFields);
const UpdateBody = z.object(ZoneFields);

const SEED_ZONES = ["Zone1", "Zone2", "Zone3", "Zone4", "Zone5"];

export async function ensureSeedZones(tenantId: string): Promise<void> {
  const zones = col<ZoneDoc>("zones");
  const count = await zones.countDocuments({ tenantId });
  if (count > 0) return;
  const now = new Date().toISOString();
  await zones.insertMany(
    SEED_ZONES.map((name) => ({
      _id: ulid(),
      tenantId,
      name,
      city: "",
      areas: [],
      color: "",
      createdAt: now,
      updatedAt: now,
    })),
  );
}

function zoneOut(z: ZoneDoc) {
  return {
    id: z._id,
    name: z.name,
    city: z.city ?? "",
    areas: Array.isArray(z.areas) ? z.areas : [],
    color: z.color ?? "",
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

export function registerZoneRoutes(app: FastifyInstance) {
  const zones = () => col<ZoneDoc>("zones");

  // List zones — any authed user (forms need them)
  app.get("/api/zones", { preHandler: [requireAuth] }, async (req, reply) => {
    await ensureSeedZones(req.user!.tenantId);
    const list = await zones()
      .find({ tenantId: req.user!.tenantId })
      .sort({ name: 1 })
      .toArray();
    return reply.send(list.map(zoneOut));
  });

  // Create zone — super_admin only
  app.post("/api/zones", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    try {
      const body = CreateBody.parse(req.body);
      const name = body.name.trim();
      const exists = await zones().findOne({ tenantId: req.user!.tenantId, name });
      if (exists) return reply.code(409).send({ code: "CONFLICT", message: "Zone name already exists" });
      const now = new Date().toISOString();
      const doc: ZoneDoc = {
        _id: ulid(),
        tenantId: req.user!.tenantId,
        name,
        city: (body.city ?? "").trim(),
        areas: (body.areas ?? []).map((a) => a.trim()).filter(Boolean),
        color: (body.color ?? "").trim(),
        createdAt: now,
        updatedAt: now,
      };
      await zones().insertOne(doc);
      return reply.code(201).send(zoneOut(doc));
    } catch (e) {
      const err = e as Error;
      return reply.code(400).send({ code: "BAD_REQUEST", message: err.message });
    }
  });

  // Update zone — super_admin
  app.put("/api/zones/:id", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = UpdateBody.parse(req.body);
      const name = body.name.trim();
      const dupe = await zones().findOne({ tenantId: req.user!.tenantId, name, _id: { $ne: id } });
      if (dupe) return reply.code(409).send({ code: "CONFLICT", message: "Zone name already exists" });
      const r = await zones().findOneAndUpdate(
        { _id: id, tenantId: req.user!.tenantId },
        {
          $set: {
            name,
            city: (body.city ?? "").trim(),
            areas: (body.areas ?? []).map((a) => a.trim()).filter(Boolean),
            color: (body.color ?? "").trim(),
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: "after" },
      );
      if (!r) return reply.code(404).send({ code: "NOT_FOUND", message: "Zone not found" });
      return reply.send(zoneOut(r));
    } catch (e) {
      const err = e as Error;
      return reply.code(400).send({ code: "BAD_REQUEST", message: err.message });
    }
  });

  // Delete zone — super_admin
  app.delete("/api/zones/:id", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await zones().deleteOne({ _id: id, tenantId: req.user!.tenantId });
    if (r.deletedCount === 0) return reply.code(404).send({ code: "NOT_FOUND", message: "Zone not found" });
    return reply.send({ ok: true });
  });
}
