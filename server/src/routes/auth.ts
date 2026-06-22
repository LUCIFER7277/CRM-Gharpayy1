import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { col } from "../db/mongo.js";
import {
  loginUser,
  signAccessToken,
  ensureDefaultSuperAdmin,
  getUserById,
  createManagedUser,
  type UserDoc,
} from "../auth/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { newEventId } from "../realtime/event-bus.js";

// Auth audit events live outside the strict DomainEvent union; write directly.
async function auditAuthEvent(doc: {
  type: "evt.user.login" | "evt.user.logout";
  actor: string;
  tenantId: string;
  payload: Record<string, unknown>;
}) {
  const id = newEventId();
  await col("entity_event").insertOne({
    _id: id,
    type: doc.type,
    occurredAt: new Date().toISOString(),
    actor: doc.actor,
    tenantId: doc.tenantId,
    correlationId: id,
    causationId: null,
    version: 1,
    payload: doc.payload,
    aggregateType: "user",
    aggregateId: doc.actor,
    seq: null,
    publishedAt: null,
    publishAttempts: 0,
  } as never);
}

const LoginBody = z.object({
  email: z.string().min(1).max(120).optional(),
  username: z.string().min(1).max(120).optional(),
  password: z.string().min(1).max(72),
}).refine((v) => !!(v.email || v.username), { message: "email or username required" });

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(120),
  role: z.enum(["super_admin", "manager", "admin", "member", "tcm"]).optional(),
});

const UpdateMeBody = z.object({
  password: z.string().min(8).max(72).optional(),
  phone: z.string().max(40).optional(),
  fullName: z.string().min(1).max(120).optional(),
  isTcm: z.boolean().optional(),
});

export function registerAuthRoutes(app: FastifyInstance) {
  // First request after boot triggers the bootstrap. Idempotent.
  let bootstrapped = false;
  app.addHook("preHandler", async (req) => {
    if (!bootstrapped && req.url.startsWith("/api/auth/")) {
      try {
        await ensureDefaultSuperAdmin();
      } catch (err) {
        req.log.warn({ err }, "ensureDefaultSuperAdmin failed");
      }
      bootstrapped = true;
    }
  });

  // ---------- LOGIN ----------
  app.post("/api/auth/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);
    const identifier = (body.email ?? body.username ?? "").trim();
    try {
      const claims = await loginUser(identifier, body.password);
      const token = await signAccessToken(claims);
      reply.setCookie("access_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      // Audit
      await auditAuthEvent({
        type: "evt.user.login",
        actor: claims.sub,
        tenantId: claims.tenantId,
        payload: {
          userId: claims.sub,
          email: claims.email,
          role: claims.role,
          ip: req.ip,
          ua: req.headers["user-agent"] ?? "",
        },
      }).catch(() => undefined);

      return reply.send({
        token,
        user: {
          id: claims.sub,
          username: claims.username,
          email: claims.email,
          fullName: claims.fullName,
          role: claims.role,
          zones: claims.zones,
          scopes: claims.scopes,
        },
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      const status = err.code === "FORBIDDEN" ? 403 : 401;
      return reply.code(status).send({ code: err.code ?? "UNAUTHENTICATED", message: err.message });
    }
  });

  // ---------- SIGNUP (kept; super_admin path requires existing super_admin token to use; otherwise rejects) ----------
  app.post("/api/auth/signup", async (req, reply) => {
    const body = SignupBody.parse(req.body);
    try {
      const role = body.role ?? "member";
      // Block public super_admin self-creation
      if (role === "super_admin") {
        return reply.code(403).send({ code: "FORBIDDEN", message: "Super admin cannot self-register" });
      }
      const u = await createManagedUser({
        fullName: body.name,
        email: body.email,
        password: body.password,
        role,
      });
      return reply.send({ ok: true, userId: u._id });
    } catch (e) {
      const err = e as Error & { code?: string };
      return reply.code(409).send({ code: err.code ?? "CONFLICT", message: err.message });
    }
  });

  // ---------- LOGOUT ----------
  app.post("/api/auth/logout", { preHandler: [requireAuth] }, async (req, reply) => {
    reply.clearCookie("access_token", { path: "/" });
    if (req.user) {
      await auditAuthEvent({
        type: "evt.user.logout",
        actor: req.user.sub,
        tenantId: req.user.tenantId,
        payload: { userId: req.user.sub, ip: req.ip },
      }).catch(() => undefined);
    }
    return reply.send({ ok: true });
  });

  // ---------- ME ----------
  app.get("/api/auth/me", { preHandler: [requireAuth] }, async (req, reply) => {
    const u = await getUserById(req.user!.sub);
    if (!u) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
    return reply.send({
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone ?? "",
        role: u.role,
        isTcm: u.isTcm ?? (u.role === "member" || u.role === "tcm"),
        status: u.status,
        zones: u.zones ?? [],
        scopes: req.user!.scopes,
      },
    });
  });

  // ---------- UPDATE ME ----------
  app.patch("/api/auth/update", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = UpdateMeBody.parse(req.body);
    const patch: Partial<UserDoc> = { updatedAt: new Date().toISOString() };
    if (body.phone !== undefined) patch.phone = body.phone.trim();
    if (body.fullName !== undefined) patch.fullName = body.fullName.trim();
    if (body.isTcm !== undefined) {
      const current = await col<UserDoc>("users").findOne({ _id: req.user!.sub });
      if (!current) return reply.code(404).send({ code: "NOT_FOUND", message: "User not found" });
      if (current.role !== "member") {
        return reply.code(403).send({ code: "FORBIDDEN", message: "TCM toggle is available for member accounts only" });
      }
      patch.isTcm = body.isTcm;
    }
    if (body.password) patch.passwordHash = await argon2.hash(body.password);
    await col<UserDoc>("users").updateOne({ _id: req.user!.sub }, { $set: patch });
    return reply.send({ ok: true });
  });
}
