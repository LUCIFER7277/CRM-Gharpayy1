import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { col } from "../../db/mongo.js";
import { requireAuth, requireScope } from "../../middleware/auth.js";
import { createManagedUser, type UserDoc } from "../../auth/auth.js";
import type { TopRole } from "../../../../src/contracts/roles.js";

const CreateBody = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(0).max(40).optional(),
  password: z.string().min(8).max(72),
  role: z.enum(["manager", "admin", "member", "owner", "tcm"]),
  zones: z.array(z.string()).optional(),
});

const UpdateBody = z.object({
  fullName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  zones: z.array(z.string()).optional(),
  managerId: z.string().nullable().optional(),
  adminId: z.string().nullable().optional(),
  isTcm: z.boolean().optional(),
});

const PatchBody = z.object({
  password: z.string().min(8).max(72).optional(),
});

const StatusBody = z.object({
  action: z.enum(["activate", "deactivate", "delete"]),
});

function userOut(u: UserDoc) {
  return {
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? "",
    username: u.username,
    role: u.role,
    isTcm: u.isTcm ?? (u.role === "member" || u.role === "tcm"),
    status: u.status,
    zones: u.zones ?? [],
    managerId: u.managerId ?? null,
    adminId: u.adminId ?? null,
    adminIds: u.adminIds ?? [],
    memberIds: u.memberIds ?? [],
    invitedAt: u.invitedAt ?? null,
    deletedAt: u.deletedAt ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function registerUserRoutes(app: FastifyInstance) {
  const users = () => col<UserDoc>("users");

  // ---------- LIST USERS (super_admin) ----------
  app.get("/api/users", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const q = z.object({ status: z.enum(["active", "inactive", "invited", "deleted"]).optional() }).parse(req.query);
    const filter: Record<string, unknown> = { tenantId: req.user!.tenantId, role: { $ne: "super_admin" } };
    if (q.status) filter.status = q.status;
    const list = await users().find(filter).sort({ createdAt: -1 }).toArray();
    return reply.send(list.map(userOut));
  });

  // Lightweight list for in-app consumers (e.g. assignment dropdowns)
  app.get("/api/users/list", { preHandler: [requireAuth] }, async (req, reply) => {
    const list = await users()
      .find({ tenantId: req.user!.tenantId, status: "active" })
      .project({ _id: 1, fullName: 1, email: 1, role: 1, isTcm: 1 })
      .toArray();
    return reply.send({ items: list.map((u) => ({ _id: u._id, name: u.fullName, email: u.email, role: u.role, isTcm: u.isTcm ?? (u.role === "member" || u.role === "tcm") })) });
  });

  // ---------- ROLE-FILTERED LISTS ----------
  const roleList = async (req: import("fastify").FastifyRequest, role: TopRole) => {
    return users()
      .find({ tenantId: req.user!.tenantId, role, status: { $in: ["active", "inactive", "invited"] } })
      .sort({ createdAt: -1 })
      .toArray();
  };

  app.get("/api/managers", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const managers = await roleList(req, "manager");
    const admins = await roleList(req, "admin");
    const out = managers.map((m) => ({
      ...userOut(m),
      admins: admins.filter((a) => a.managerId === m._id).map(userOut),
    }));
    return reply.send(out);
  });

  app.get("/api/admins", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const list = await roleList(req, "admin");
    return reply.send(list.map(userOut));
  });

  app.get("/api/members", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const list = await roleList(req, "member");
    return reply.send(list.map(userOut));
  });

  app.get("/api/tcms", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const list = await users()
      .find({
        tenantId: req.user!.tenantId,
        status: { $in: ["active", "inactive", "invited"] },
        $or: [{ role: "tcm" }, { role: "member", isTcm: true }],
      })
      .sort({ createdAt: -1 })
      .toArray();
    return reply.send(list.map(userOut));
  });

  app.get("/api/owners", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const list = await roleList(req, "owner");
    return reply.send(list.map(userOut));
  });

  // ---------- CREATE USER (super_admin) ----------
  app.post("/api/users", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    try {
      const body = CreateBody.parse(req.body);
      if ((body.role === "admin" || body.role === "member" || body.role === "tcm") && (!body.zones || body.zones.length === 0)) {
        return reply.code(400).send({ code: "VALIDATION_FAILED", message: "Zones required for admin/member/tcm" });
      }
      const u = await createManagedUser(body);
      return reply.code(201).send(userOut(u));
    } catch (e) {
      const err = e as Error & { code?: string };
      const status = err.code === "CONFLICT" ? 409 : 400;
      return reply.code(status).send({ code: err.code ?? "BAD_REQUEST", message: err.message });
    }
  });

  // ---------- GET SINGLE ----------
  app.get("/api/users/:id", { preHandler: [requireAuth, requireScope("user.read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = await users().findOne({ _id: id, tenantId: req.user!.tenantId });
    if (!u) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
    return reply.send(userOut(u));
  });

  // ---------- UPDATE PROFILE ----------
  app.put("/api/users/:id", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateBody.parse(req.body);
    const patch: Partial<UserDoc> = { updatedAt: new Date().toISOString() };
    if (body.fullName !== undefined) patch.fullName = body.fullName.trim();
    if (body.email !== undefined) patch.email = body.email.trim().toLowerCase();
    if (body.phone !== undefined) patch.phone = body.phone.trim();
    if (body.zones !== undefined) patch.zones = body.zones;
    if (body.managerId !== undefined) patch.managerId = body.managerId;
    if (body.adminId !== undefined) patch.adminId = body.adminId;
    if (body.isTcm !== undefined) patch.isTcm = body.isTcm;
    const r = await users().findOneAndUpdate(
      { _id: id, tenantId: req.user!.tenantId },
      { $set: patch },
      { returnDocument: "after" },
    );
    if (!r) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
    return reply.send(userOut(r));
  });

  // ---------- RESET PASSWORD ----------
  app.patch("/api/users/:id", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = PatchBody.parse(req.body);
    if (!body.password) return reply.code(400).send({ code: "VALIDATION_FAILED", message: "password required" });
    await users().updateOne(
      { _id: id, tenantId: req.user!.tenantId },
      { $set: { passwordHash: await argon2.hash(body.password), updatedAt: new Date().toISOString() } },
    );
    return reply.send({ ok: true });
  });

  // ---------- STATUS (activate/deactivate/delete) ----------
  app.patch("/api/users/:id/status", { preHandler: [requireAuth, requireScope("user.admin")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { action } = StatusBody.parse(req.body);
    const target = await users().findOne({ _id: id, tenantId: req.user!.tenantId });
    if (!target) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
    if (target.role === "super_admin") {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Cannot change Super Admin status" });
    }
    const now = new Date().toISOString();
    const patch: Partial<UserDoc> = { updatedAt: now };
    if (action === "activate") patch.status = "active";
    else if (action === "deactivate") patch.status = "inactive";
    else if (action === "delete") {
      patch.status = "deleted";
      patch.deletedAt = now;
    }
    await users().updateOne({ _id: id }, { $set: patch });
    return reply.send({ ok: true });
  });
}
