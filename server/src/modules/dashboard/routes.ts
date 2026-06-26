import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { col } from "../../db/mongo.js";

export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: [requireAuth] }, async (req, reply) => {
    const tenantId = req.user!.tenantId;
    const limit = parseInt((req.query as any).limit) || 50;
    const now = new Date().toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString();
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const todayEndStr = todayEnd.toISOString();

    const [
      leadCountsRaw,
      tcmRankRaw,
      zonePipelineRaw,
      leadsToCallTodayCount,
      overdueFollowUpsCount,
      rawActivities
    ] = await Promise.all([
      // 1. Lead counts by status
      col("leads").aggregate([
        { $match: { tenantId } },
        { $group: { _id: "$stage", count: { $sum: 1 } } }
      ]).toArray(),

      // 2. TCM Rank (Team performance)
      col("tours").aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: "$assignedTo",
            toursCompleted: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            toursScheduled: { $sum: 1 },
            bookings: { $sum: { $cond: [{ $eq: ["$postTour.outcome", "booked"] }, 1, 0] } }
          }
        },
        { $sort: { bookings: -1, toursCompleted: -1, _id: 1 } }
      ]).toArray(),

      // 3. Zone Pipeline Summary & Leaks
      col("leads").aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: { zoneId: "$zoneId", stage: "$stage" },
            count: { $sum: 1 }
          }
        }
      ]).toArray(),

      // 4. Leads to call today
      col("leads").countDocuments({
        tenantId,
        nextFollowUpAt: { $gte: todayStartStr, $lte: todayEndStr }
      }),

      // 5. Overdue follow-ups
      col("follow_ups").countDocuments({
        tenantId,
        done: false,
        dueAt: { $lt: now }
      }),

      // 6. Live Feed
      col("activities").find({ tenantId }).sort({ occurredAt: -1 }).limit(limit).toArray()
    ]);

    const leadCountsByStatus = leadCountsRaw.reduce((acc: Record<string, number>, curr) => {
      acc[curr._id || "unknown"] = curr.count;
      return acc;
    }, {});

    // Enrich Activities
    const actorIds = [...new Set(rawActivities.map((a: any) => a.actor).filter(Boolean))];
    const leadIds = [...new Set(rawActivities.map((a: any) => a.entityId).filter(Boolean))];
    const tcmIds = [...new Set(tcmRankRaw.map((t: any) => t._id).filter(Boolean))];
    const zoneIds = [...new Set(zonePipelineRaw.map((z: any) => z._id?.zoneId).filter(Boolean))];
    
    // Extract property and tour IDs from meta
    const propertyIds = [...new Set(rawActivities.map((a: any) => a.meta?.propertyId).filter(Boolean))];
    const tourIds = [...new Set(rawActivities.map((a: any) => a.meta?.tourId).filter(Boolean))];
    const assignedUserIds = [...new Set(rawActivities.map((a: any) => a.meta?.ownerId || a.meta?.tcmId || a.meta?.assignedToId).filter(Boolean))];

    // Combine all user IDs we need to fetch
    const allUserIds = [...new Set([...actorIds, ...tcmIds, ...assignedUserIds])];

    const [users, leads, zones, properties, tours] = await Promise.all([
      col("users").find({ _id: { $in: allUserIds } }).project({ fullName: 1, email: 1, role: 1, isTcm: 1 }).toArray(),
      col("leads").find({ _id: { $in: leadIds } }).project({ name: 1, propertyName: 1, phone: 1, stage: 1, budget: 1, preferredArea: 1 }).toArray(),
      col("zones").find({ _id: { $in: zoneIds } }).project({ name: 1 }).toArray(),
      col("properties").find({ _id: { $in: propertyIds } }).project({ name: 1, address: 1, area: 1 }).toArray(),
      col("tours").find({ _id: { $in: tourIds } }).project({ propertyId: 1, status: 1, scheduledAt: 1, completedAt: 1, outcome: 1 }).toArray(),
    ]);

    const userMap = new Map(users.map(u => [u._id, u.fullName || u.email || "Unknown User"]));
    
    // Exact mapping based on user role definitions
    const roleMap = new Map(users.map(u => {
      if (u.role === "admin" || u.role === "super-admin") return [u._id, "admin"];
      if (u.role === "manager") return [u._id, "hr"];
      if (u.role === "tcm" || (u.role === "member" && u.isTcm)) return [u._id, "tcm"];
      if (u.role === "member" && !u.isTcm) return [u._id, "flow-ops"];
      return [u._id, u.role || "system"];
    }));
    
    const leadMap = new Map(leads.map(l => [l._id, { 
      name: l.name, 
      propertyName: l.propertyName,
      phone: l.phone,
      stage: l.stage,
      budget: l.budget,
      preferredArea: l.preferredArea
    }]));
    const zoneMap = new Map(zones.map(z => [z._id, z.name || "Unknown Zone"]));
    const propertyMap = new Map(properties.map(p => [p._id, { name: p.name, area: p.area }]));
    const tourMap = new Map(tours.map(t => [t._id, t]));

    const enrichedActivities = rawActivities.map((a: any) => {
      // If the actor starts with "sales:" it's a legacy or system-driven format
      const actorId = (a.actor && typeof a.actor === "string" && a.actor.startsWith("sales:")) 
        ? a.actor.replace("sales:", "") 
        : a.actor;

      const actorName = userMap.get(actorId) || (a.actor === "system" ? "Gharpayy" : "System");
      const actorRole = roleMap.get(actorId) || "system";
      const leadDetails = leadMap.get(a.entityId) || { name: "Unknown Lead", propertyName: "Unknown Property" };

      const propertyInfo = a.meta?.propertyId ? propertyMap.get(a.meta.propertyId) : undefined;
      const tourInfo = a.meta?.tourId ? tourMap.get(a.meta.tourId) : undefined;
      
      const assignedToId = a.meta?.ownerId || a.meta?.tcmId || a.meta?.assignedToId;
      const assignedToName = assignedToId ? userMap.get(assignedToId) : undefined;

      return {
        id: a._id,
        entityId: a.entityId,
        entityType: a.entityType,
        ts: a.occurredAt,
        kind: a.kind,
        actorName,
        actorRole,
        leadName: leadDetails.name,
        leadPhone: leadDetails.phone,
        leadStage: leadDetails.stage,
        leadBudget: leadDetails.budget,
        leadArea: leadDetails.preferredArea,
        propertyName: leadDetails.propertyName,
        subject: a.subject,
        body: a.body,
        meta: {
          ...a.meta,
          propertyDetails: propertyInfo,
          tourDetails: tourInfo,
          assignedToName
        }
      };
    });

    const categorized = {
      flowOps: enrichedActivities.filter(a => a.actorRole === "flow-ops"),
      tcm: enrichedActivities.filter(a => a.actorRole === "tcm"),
      adminAndHr: enrichedActivities.filter(a => ["admin", "hr"].includes(a.actorRole)),
      system: enrichedActivities.filter(a => a.actorRole === "system" || !["flow-ops", "tcm", "admin", "hr"].includes(a.actorRole))
    };

    // Enrich tcmRank
    const tcmRank = tcmRankRaw.map((t: any) => ({
      ...t,
      tcmName: userMap.get(t._id) || "Unknown TCM"
    }));

    // Enrich zonePipelineSummary
    const zonePipelineSummary = zonePipelineRaw.map((z: any) => ({
      ...z,
      zoneName: zoneMap.get(z._id?.zoneId) || "Unknown Zone"
    }));

    return reply.send({
      message: "Super Admin Dashboard metrics & live feed",
      metrics: {
        leadCountsByStatus,
        tcmRank,
        zonePipelineSummary,
        leadsToCallTodayCount,
        overdueFollowUpsCount
      },
      liveFeed: {
        items: enrichedActivities,
        categorized
      }
    });
  });
}
