import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { col } from "../../db/mongo.js";
import { requireAuth } from "../../middleware/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import type { Lead } from "../../../../src/contracts/entities.js";
import type { Tour } from "../../../../src/contracts/entities.js";
import { buildIstDayRange, getPeriodBounds, GOALS, type LeaderboardPeriod } from "./ist.js";

const STAFF_ROLES = ["super_admin", "manager", "admin", "member", "tcm"] as const;

async function getScopedMemberIdsForAdmin(tenantId: string, adminId: string) {
  const adminUser = await col<UserDoc>("users").findOne({ _id: adminId, tenantId });
  const adminZones = new Set(
    (adminUser?.zones ?? []).map((zone) => String(zone).trim().toLowerCase()).filter(Boolean),
  );

  if (adminZones.size === 0) return [] as string[];

  const allMembers = await col<UserDoc>("users")
    .find({ tenantId, role: { $in: ["member", "tcm"] }, status: { $in: ["active", "inactive"] } })
    .project({ _id: 1, zones: 1 })
    .toArray();

  return allMembers
    .filter((member) => {
      const memberZones = (member.zones ?? [])
        .map((z: string) => String(z).trim().toLowerCase())
        .filter(Boolean);
      return memberZones.some((z: string) => adminZones.has(z));
    })
    .map((member) => member._id);
}

export function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats/daily-progress", { preHandler: [requireAuth] }, async (req, reply) => {
    const role = req.user!.role;
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Forbidden" });
    }

    const q = z.object({ date: z.string().optional() }).parse(req.query);
    const { selectedDate, dayStart, dayEnd } = buildIstDayRange(q.date ?? null);
    const tenantId = req.user!.tenantId;

    let members: Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[] = [];

    if (role === "member" || role === "tcm") {
      const me = await col<UserDoc>("users").findOne(
        { _id: req.user!.sub, tenantId },
        { projection: { _id: 1, fullName: 1, zones: 1, role: 1 } },
      );
      members = me ? [me] : [];
    } else if (role === "admin") {
      const scopedMemberIds = await getScopedMemberIdsForAdmin(tenantId, req.user!.sub);
      if (scopedMemberIds.length === 0) {
        return reply.send({
          date: selectedDate,
          members: [],
          goals: GOALS,
          thresholds: GOALS,
        });
      }
      members = (await col<UserDoc>("users")
        .find({
          _id: { $in: scopedMemberIds },
          tenantId,
          role: { $in: ["member", "tcm"] },
          status: { $in: ["active", "inactive"] },
        })
        .project({ _id: 1, fullName: 1, zones: 1, role: 1 })
        .toArray()) as Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[];
    } else {
      members = (await col<UserDoc>("users")
        .find({ tenantId, role: { $in: ["member", "tcm"] }, status: { $in: ["active", "inactive"] } })
        .project({ _id: 1, fullName: 1, zones: 1, role: 1 })
        .toArray()) as Pick<UserDoc, "_id" | "fullName" | "zones" | "role">[];
    }

    if (!members.length) {
      return reply.send({
        date: selectedDate,
        members: [],
        goals: GOALS,
        thresholds: GOALS,
      });
    }

    const memberIds = members.map((m) => m._id);

    const leadsAgg = await col<Lead>("leads")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            createdBy: { $in: memberIds },
            createdAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$createdBy", count: { $sum: 1 } } },
      ])
      .toArray();

    const toursScheduledAgg = await col<Tour>("tours")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            scheduledBy: { $in: memberIds },
            scheduledAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$scheduledBy", count: { $sum: 1 } } },
      ])
      .toArray();

    const toursCompletedAgg = await col<Tour>("tours")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            assignedTo: { $in: memberIds },
            status: "completed",
            updatedAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
      ])
      .toArray();

    const toursMap = new Map<string, number>();
    toursScheduledAgg.forEach((x) => toursMap.set(x._id, x.count));
    toursCompletedAgg.forEach((x) => toursMap.set(x._id, (toursMap.get(x._id) ?? 0) + x.count));

    const quotesAgg = await col("quotations")
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            tenantId,
            tcmId: { $in: memberIds },
            sentAt: { $gte: dayStart, $lte: dayEnd },
          },
        },
        { $group: { _id: "$tcmId", count: { $sum: 1 } } },
      ])
      .toArray();

    const leadsMap = new Map(leadsAgg.map((x) => [x._id, x.count]));
    const quotesMap = new Map(quotesAgg.map((x) => [x._id, x.count]));

    const result = members.map((member) => {
      const id = member._id;
      const leadsAdded = leadsMap.get(id) ?? 0;
      const toursScheduled = toursMap.get(id) ?? 0;
      const quotesSent = quotesMap.get(id) ?? 0;
      const leadsDone = leadsAdded >= GOALS.leadsAdded;
      const toursDone = toursScheduled >= GOALS.toursScheduled;
      const quotesDone = quotesSent >= GOALS.quotesSent;

      return {
        id,
        name: member.fullName,
        zones: member.zones ?? [],
        role: member.role === "tcm" ? "tcm" : "member",
        leadsAdded,
        toursScheduled,
        quotesSent,
        leadsDone,
        toursDone,
        quotesDone,
        allDone: leadsDone && toursDone && quotesDone,
        newLeads: leadsAdded,
        visitConfirmed: toursScheduled,
      };
    });

    result.sort((a, b) => {
      if (a.allDone !== b.allDone) return a.allDone ? -1 : 1;
      if (b.toursScheduled !== a.toursScheduled) return b.toursScheduled - a.toursScheduled;
      if (b.leadsAdded !== a.leadsAdded) return b.leadsAdded - a.leadsAdded;
      return String(a.name).localeCompare(String(b.name));
    });

    return reply.send({
      date: selectedDate,
      members: result,
      goals: GOALS,
      thresholds: GOALS,
      visitStageLabel: "Tours Scheduled + Completed",
      targets: {
        newLeads: GOALS.leadsAdded,
        visitConfirmed: GOALS.toursScheduled,
      },
    });
  });

  app.get("/api/stats/leaderboard", { preHandler: [requireAuth] }, async (req, reply) => {
    const role = req.user!.role;
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      return reply.code(403).send({ code: "FORBIDDEN", message: "Forbidden" });
    }

    const q = z
      .object({
        period: z.enum(["this_month", "all_time", "today", "last_30_days", "custom"]).default("this_month"),
        zone: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);

    const period = q.period as LeaderboardPeriod;
    const tenantId = req.user!.tenantId;
    const zoneQuery = q.zone && q.zone !== "all" ? q.zone : null;

    let from: string | null = null;
    let to: string | null = null;

    if (period === "custom" && q.from && q.to) {
      const fromDate = new Date(q.from);
      const toDate = new Date(q.to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        from = fromDate.toISOString();
        toDate.setUTCHours(23, 59, 59, 999);
        to = toDate.toISOString();
      }
    } else if (period !== "custom") {
      const bounds = getPeriodBounds(period);
      from = bounds.from;
      to = bounds.to;
    }

    // We want to count both: who scheduled the tour AND who completed it.
    // For scheduling we use `scheduledAt`, for completions we use `updatedAt` when status === 'completed'.
    // Match any tour that was either scheduled in-range or completed in-range (when period bounds provided).
    const tourMatch: Record<string, unknown> = { tenantId };

    if (from && to) {
      tourMatch.$or = [
        { scheduledAt: { $gte: from, $lte: to } },
        { status: "completed", updatedAt: { $gte: from, $lte: to } },
      ];
    }

    type LeaderboardRow = {
      userId: string;
      name: string;
      role: string;
      scheduledCount: number;
      completedCount: number;
      toursCount: number;
      zones: { zone: string; count: number }[];
    };

    // Build contributors per tour: include `scheduledBy` when the tour was scheduled in-range,
    // and include `assignedTo` when the tour was completed in-range. Then unwind contributors
    // and aggregate counts per user (and per zone).
    const rows = (await col<Tour>("tours")
      .aggregate([
        { $match: tourMatch },
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
        ...(zoneQuery
          ? [
              { $match: { $or: [{ "lead.zoneCategory": zoneQuery }, { "lead.zoneId": zoneQuery }] } },
            ]
          : []),
        // Build an array of contributors for this tour depending on whether the
        // schedule/completion falls within the requested period.
        {
          $project: {
            scheduledBy: 1,
            assignedTo: 1,
            lead: 1,
            // include scheduledBy only if scheduledAt in range (or no range provided)
            schedInRange: {
              $cond: [
                { $and: [
                  { $ifNull: [from, false] },
                  { $ifNull: [to, false] },
                ] },
                { $and: [{ $gte: ["$scheduledAt", from] }, { $lte: ["$scheduledAt", to] }] },
                true,
              ],
            },
            // include completedBy (assignedTo) only if status is completed and updatedAt in range
            compInRange: {
              $cond: [
                { $and: [ { $eq: ["$status", "completed"] }, { $ifNull: [from, false] }, { $ifNull: [to, false] } ] },
                { $and: [{ $gte: ["$updatedAt", from] }, { $lte: ["$updatedAt", to] }] },
                { $eq: ["$status", "completed"] },
              ],
            },
          },
        },
        // Create contributions array with kind labels so we can count scheduled vs completed separately
        {
          $project: {
            contributions: {
              $concatArrays: [
                {
                  $cond: ["$schedInRange", [{ userId: "$scheduledBy", kind: "scheduled" }], []],
                },
                {
                  $cond: ["$compInRange", [{ userId: "$assignedTo", kind: "completed" }], []],
                },
              ],
            },
            zone: {
              $cond: [
                { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$lead.zoneCategory", ""] } } } }, 0] },
                "$lead.zoneCategory",
                null,
              ],
            },
          },
        },
        { $unwind: { path: "$contributions", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { userId: "$contributions.userId", kind: "$contributions.kind", zone: "$zone" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: { userId: "$_id.userId", zone: "$_id.zone" },
            scheduledCount: { $sum: { $cond: [{ $eq: ["$_id.kind", "scheduled"] }, "$count", 0] } },
            completedCount: { $sum: { $cond: [{ $eq: ["$_id.kind", "completed"] }, "$count", 0] } },
            totalCount: { $sum: "$count" },
          },
        },
        {
          $group: {
            _id: "$_id.userId",
            scheduledCount: { $sum: "$scheduledCount" },
            completedCount: { $sum: "$completedCount" },
            zones: { $push: { zone: "$_id.zone", count: "$totalCount" } },
          },
        },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $match: { "user.role": { $in: ["member", "tcm"] }, "user.status": { $ne: "deleted" }, "user.tenantId": tenantId } },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: { $ifNull: ["$user.fullName", "$user.username"] },
            role: "$user.role",
            scheduledCount: 1,
            completedCount: 1,
            toursCount: { $add: ["$scheduledCount", "$completedCount"] },
            zones: {
              $filter: { input: "$zones", as: "z", cond: { $ne: ["$$z.zone", null] } },
            },
          },
        },
        { $sort: { toursCount: -1, name: 1, userId: 1 } },
      ])
      .toArray()) as LeaderboardRow[];

    const rankings = rows.map((row, idx) => ({
      rank: idx + 1,
      userId: row.userId,
      name: row.name || "Unknown User",
      role: (row.role === "tcm" ? "tcm" : "member") as "tcm" | "member",
      scheduledCount: row.scheduledCount || 0,
      completedCount: row.completedCount || 0,
      toursCount: row.toursCount || ((row.scheduledCount || 0) + (row.completedCount || 0)),
      zones: (row.zones || []).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.zone).localeCompare(String(b.zone));
      }),
    }));

    return reply.send({
      period,
      from,
      to,
      generatedAt: new Date().toISOString(),
      rankings,
    });
  });
}
