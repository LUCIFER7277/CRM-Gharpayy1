import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, type JwtClaims } from "../auth/auth.js";
import type { Scope } from "../../../src/contracts/roles.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtClaims;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (req.cookies?.access_token ?? null);
  if (!token) {
    reply.code(401).send({ code: "UNAUTHENTICATED", message: "Missing token" });
    return;
  }
  try {
    req.user = await verifyToken(token);
  } catch {
    reply.code(401).send({ code: "UNAUTHENTICATED", message: "Invalid token" });
  }
}

export function requireScope(...scopes: Scope[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "No user" });
    const ok = scopes.every((s) => req.user!.scopes.includes(s));
    if (!ok) reply.code(403).send({ code: "FORBIDDEN", message: `Missing scope: ${scopes.join(", ")}` });
  };
}
