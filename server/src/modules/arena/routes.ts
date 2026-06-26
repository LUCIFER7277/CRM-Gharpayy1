import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { getArenaHomeData, getArenaTodayData } from "./arena.service.js";

export function registerArenaRoutes(app: FastifyInstance) {
  app.get("/api/v1/arena/home", { preHandler: [requireAuth] }, async (req, reply) => {
    const tenantId = req.user!.tenantId;
    const role = req.user!.role;
    const userId = req.user!.id;
    return getArenaHomeData(tenantId, role, userId);
  });

  app.get("/api/v1/arena/today", { preHandler: [requireAuth] }, async (req, reply) => {
    const tenantId = req.user!.tenantId;
    const role = req.user!.role;
    const userId = req.user!.id;
    return getArenaTodayData(tenantId, role, userId);
  });
}
