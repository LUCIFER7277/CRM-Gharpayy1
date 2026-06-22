import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { col } from "../db/mongo.js";
import { ulid } from "../../../src/contracts/ids.js";
import {
  DEFAULT_SCOPES,
  type TopRole,
  type UserStatus,
  type Scope,
} from "../../../src/contracts/roles.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface UserDoc {
  _id: string;
  username: string; // lowercase, unique
  email: string; // lowercase, unique
  phone?: string;
  isTcm?: boolean;
  passwordHash: string;
  fullName: string;
  role: TopRole;
  status: UserStatus;
  zones: string[];
  managerId?: string | null; // for admin
  adminId?: string | null; // for member
  adminIds?: string[]; // for manager
  memberIds?: string[]; // for admin
  tenantId: string;
  invitedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JwtClaims {
  sub: string;
  email: string;
  username: string;
  fullName: string;
  role: TopRole;
  zones: string[];
  tenantId: string;
  scopes: Scope[];
  // legacy fields kept optional so existing handlers compile
  subRole?: null;
  zoneId?: string | null;
}

export function normalizeUsername(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function buildClaims(u: UserDoc): JwtClaims {
  return {
    sub: u._id,
    email: u.email,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    zones: u.zones ?? [],
    tenantId: u.tenantId,
    scopes: DEFAULT_SCOPES[u.role],
    subRole: null,
    zoneId: null,
  };
}

export async function signAccessToken(claims: JwtClaims): Promise<string> {
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtClaims;
}

/**
 * Idempotent bootstrap of the canonical Super Admin account.
 * Credentials come from environment variables (SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
 * or fall back to defaults for local development.
 */
export async function ensureDefaultSuperAdmin(): Promise<void> {
  const username = env.SUPER_ADMIN_EMAIL;
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;
  const fullName = env.SUPER_ADMIN_NAME;

  const users = col<UserDoc>("users");
  const existing = await users.findOne({
    $or: [
      { username },
      { email },
      { username: "superadmin@gharpayy" },
      { email: "superadmin@gharpayy" },
    ],
  });

  const now = new Date().toISOString();

  if (existing) {
    const patch: Partial<UserDoc> = {};
    if (existing.username !== username) patch.username = username;
    if (existing.email !== email) patch.email = email;
    if (existing.role !== "super_admin") patch.role = "super_admin";
    if (existing.status !== "active") patch.status = "active";
    if (!existing.fullName) patch.fullName = fullName;
    if (!existing.tenantId) patch.tenantId = env.DEFAULT_TENANT;

    // Self-heal the password: if the canonical password no longer verifies
    // against the stored hash (e.g. an older bootstrap created it with a
    // different secret, or the doc was tampered with), reset it. This makes
    // every redeploy guarantee the documented credentials work.
    let passwordOk = false;
    try {
      passwordOk = await argon2.verify(existing.passwordHash, password);
    } catch {
      passwordOk = false;
    }
    if (!passwordOk) patch.passwordHash = await argon2.hash(password);

    if (Object.keys(patch).length) {
      patch.updatedAt = now;
      await users.updateOne({ _id: existing._id }, { $set: patch });
    }
    return;
  }

  await users.insertOne({
    _id: ulid(),
    username,
    email,
    phone: "",
    passwordHash: await argon2.hash(password),
    fullName,
    role: "super_admin",
    status: "active",
    zones: [],
    managerId: null,
    adminId: null,
    adminIds: [],
    memberIds: [],
    tenantId: env.DEFAULT_TENANT,
    invitedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function loginUser(identifier: string, password: string): Promise<JwtClaims> {
  const users = col<UserDoc>("users");
  const id = normalizeUsername(identifier);
  const user = await users.findOne({ $or: [{ username: id }, { email: id }] });
  if (!user) throw Object.assign(new Error("Invalid credentials"), { code: "UNAUTHENTICATED" });

  if (user.status === "inactive") {
    throw Object.assign(new Error("Account is deactivated. Contact your administrator."), {
      code: "FORBIDDEN",
    });
  }
  if (user.status === "deleted") {
    throw Object.assign(new Error("Account is no longer available."), { code: "FORBIDDEN" });
  }

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw Object.assign(new Error("Invalid credentials"), { code: "UNAUTHENTICATED" });

  if (user.status === "invited") {
    await users.updateOne(
      { _id: user._id },
      { $set: { status: "active", updatedAt: new Date().toISOString() } },
    );
    user.status = "active";
  }

  return buildClaims(user);
}

export async function getUserById(id: string): Promise<UserDoc | null> {
  return col<UserDoc>("users").findOne({ _id: id });
}

/**
 * Used by the Super Admin "Add User" form. Caller authorization happens at the
 * route level (super_admin only).
 */
export async function createManagedUser(opts: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: TopRole;
  zones?: string[];
}): Promise<UserDoc> {
  const users = col<UserDoc>("users");
  const email = normalizeUsername(opts.email);
  const username = email; // username == email for managed users
  const exists = await users.findOne({ $or: [{ email }, { username }] });
  if (exists) throw Object.assign(new Error("Email already registered"), { code: "CONFLICT" });

  const now = new Date().toISOString();
  const doc: UserDoc = {
    _id: ulid(),
    username,
    email,
    phone: opts.phone?.trim() ?? "",
    passwordHash: await argon2.hash(opts.password),
    fullName: opts.fullName.trim(),
    role: opts.role,
    isTcm: opts.role === "tcm" ? true : undefined,
    status: "active",
    zones: opts.zones ?? [],
    managerId: null,
    adminId: null,
    adminIds: [],
    memberIds: [],
    tenantId: env.DEFAULT_TENANT,
    invitedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await users.insertOne(doc);
  return doc;
}

export { buildClaims };
