import type { Role } from "@/lib/types";
import type { VisitRecord, VisitStage, Reaction, Decision } from "./war-store";

export type Lens = "flow-ops" | "tcm" | "hr" | "owner" | "leadership";

const REACTION_WEIGHT: Record<Reaction, number> = {
  loved: 0.45, interested: 0.25, comparing: 0.10, average: 0, rejected: -0.40,
};
const DECISION_WEIGHT: Record<Decision, number> = {
  "ready-to-book": 0.35, "needs-discussion": 0.10, "comparing-options": 0,
  "parent-approval": -0.05, "budget-pending": -0.10, "not-interested": -0.40,
};

export function probability01(v: VisitRecord): number {
  if (v.stage === "booked") return 1;
  if (v.stage === "lost") return 0;
  let p = 0.15;
  if (v.reaction) p += REACTION_WEIGHT[v.reaction] ?? 0;
  if (v.decision) p += DECISION_WEIGHT[v.decision] ?? 0;
  const unresolved = v.objections.filter((o) => o.resolution !== "resolved").length;
  p -= Math.min(0.3, unresolved * 0.08);
  if (v.followUpStage === "booking-expected") p += 0.1;
  return Math.max(0, Math.min(0.98, p));
}

export function selectByLens(
  records: Record<string, VisitRecord>,
  lens: Lens,
  ctx: { tcmId?: string; ownerCode?: string },
): VisitRecord[] {
  const all = Object.values(records);
  if (lens === "tcm" && ctx.tcmId) return all.filter((v) => v.tcmId === ctx.tcmId);
  if (lens === "owner" && ctx.ownerCode) return all.filter((v) => v.ownerCode === ctx.ownerCode);
  return all;
}

export function defaultLensFor(role: Role): Lens {
  if (role === "tcm") return "tcm";
  if (role === "hr") return "hr";
  if (role === "owner") return "owner";
  return "flow-ops";
}

export interface TeamPulseRow {
  tcmId: string;
  tcmName: string;
  live: number;
  scheduled: number;
  completed: number;
  booked: number;
  lost: number;
  conv: number;
  slaBreaches: number;
  topObjection?: string;
}

export function selectTeamPulse(records: Record<string, VisitRecord>, now: number): TeamPulseRow[] {
  const byTcm = new Map<string, VisitRecord[]>();
  Object.values(records).forEach((v) => {
    if (!byTcm.has(v.tcmId)) byTcm.set(v.tcmId, []);
    byTcm.get(v.tcmId)!.push(v);
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = +today;
  const rows: TeamPulseRow[] = [];
  byTcm.forEach((list, tcmId) => {
    const todays = list.filter((v) => v.scheduledAt >= todayMs);
    const completed = todays.filter((v) => v.completedAt).length;
    const booked = todays.filter((v) => v.outcome === "booked").length;
    const lost = todays.filter((v) => v.outcome === "lost").length;
    const live = todays.filter((v) => ["started", "at-property", "tour-ongoing"].includes(v.stage)).length;
    const slaBreaches = todays.filter((v) => v.escalated || v.warnedGhost || v.warnedAtRisk).length;
    const objCount: Record<string, number> = {};
    todays.forEach((v) => v.objections.forEach((o) => { objCount[o.subType] = (objCount[o.subType] ?? 0) + 1; }));
    const topObj = Object.entries(objCount).sort((a, b) => b[1] - a[1])[0];
    rows.push({
      tcmId,
      tcmName: list[0].tcmName,
      live,
      scheduled: todays.length,
      completed,
      booked,
      lost,
      conv: completed > 0 ? Math.round((booked / completed) * 100) : 0,
      slaBreaches,
      topObjection: topObj?.[0],
    });
  });
  return rows.sort((a, b) => b.live - a.live || b.scheduled - a.scheduled);
}

export interface ZoneRollup {
  area: string;
  total: number;
  live: number;
  booked: number;
  walking: number;
  topObjection?: string;
}

export function selectZoneRollups(
  records: Record<string, VisitRecord>,
  priceFor: (propId: string) => number,
): ZoneRollup[] {
  const by = new Map<string, VisitRecord[]>();
  Object.values(records).forEach((v) => {
    if (!by.has(v.propertyArea)) by.set(v.propertyArea, []);
    by.get(v.propertyArea)!.push(v);
  });
  return Array.from(by.entries()).map(([area, list]) => {
    const live = list.filter((v) => ["started", "at-property", "tour-ongoing"].includes(v.stage)).length;
    const booked = list.filter((v) => v.outcome === "booked").length;
    const walking = list.reduce((s, v) => s + priceFor(v.propertyId) * probability01(v), 0);
    const objCount: Record<string, number> = {};
    list.forEach((v) => v.objections.forEach((o) => { objCount[o.subType] = (objCount[o.subType] ?? 0) + 1; }));
    const topObj = Object.entries(objCount).sort((a, b) => b[1] - a[1])[0];
    return { area, total: list.length, live, booked, walking, topObjection: topObj?.[0] };
  }).sort((a, b) => b.walking - a.walking);
}

export function selectRevenueWalking(records: Record<string, VisitRecord>, priceFor: (id: string) => number, now: number) {
  return Object.values(records).reduce((sum, v) => {
    const live = ["started", "at-property", "tour-ongoing"].includes(v.stage);
    const hot  = v.stage === "completed" && v.completedAt && (now - v.completedAt) < 24 * 3600_000 && v.outcome !== "booked";
    if (!live && !hot) return sum;
    return sum + priceFor(v.propertyId) * probability01(v);
  }, 0);
}

export function selectExpectedBookings(records: Record<string, VisitRecord>, now: number) {
  return Math.round(
    Object.values(records)
      .filter((v) => v.completedAt && (now - v.completedAt) < 24 * 3600_000)
      .reduce((s, v) => s + probability01(v), 0),
  );
}

export function selectTopLostReasons(records: Record<string, VisitRecord>, limit = 3) {
  const counts: Record<string, number> = {};
  Object.values(records).forEach((v) => {
    if (v.outcome === "lost" && v.lostReason) counts[v.lostReason] = (counts[v.lostReason] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function selectInterventionQueue(records: Record<string, VisitRecord>, now: number): VisitRecord[] {
  return Object.values(records).filter((v) => {
    if (v.interventionFlag) return true;
    if (v.escalated) return true;
    if (v.objections.some((o) => o.resolution === "unresolved")) return true;
    if (v.startedAt && !v.completedAt && (now - v.startedAt) > 30 * 60_000) return true;
    return probability01(v) >= 0.8 && v.stage === "completed";
  });
}

export interface BufferConflict {
  tourId: string;
  tcmName: string;
  conflictWith: string;
  gapMin: number;
}

export function selectBufferConflicts(
  records: Record<string, VisitRecord>,
  bufferMin = 30,
): BufferConflict[] {
  const all = Object.values(records)
    .filter((v) => v.stage !== "lost" && v.stage !== "booked")
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const out: BufferConflict[] = [];
  const byTcm = new Map<string, VisitRecord[]>();
  all.forEach((v) => {
    if (!byTcm.has(v.tcmId)) byTcm.set(v.tcmId, []);
    byTcm.get(v.tcmId)!.push(v);
  });
  byTcm.forEach((list) => {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      const prevEnd = prev.scheduledAt + 60 * 60_000;
      const gapMin = (curr.scheduledAt - prevEnd) / 60_000;
      if (gapMin < bufferMin) {
        out.push({
          tourId: curr.tourId,
          tcmName: curr.tcmName,
          conflictWith: prev.tourId,
          gapMin: Math.round(gapMin),
        });
      }
    }
  });
  return out;
}
