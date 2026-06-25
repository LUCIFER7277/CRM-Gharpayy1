import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";

export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", { preHandler: [requireAuth] }, async (req, reply) => {
    // Return dummy dashboard data to fix the 404 issue mentioned in the audit.
    // This allows the manager view to load instead of crashing.
    return reply.send({
      message: "Dashboard endpoint stub",
      stats: { totalLeads: 0, activeTours: 0, tcms: [] },
    });
  });
}
