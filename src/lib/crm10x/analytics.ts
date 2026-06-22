/**
 * CRM 10x · advanced analytics layer.
 * Pure functions consumed by Conversion Intelligence Engine, Zone Brain
 * and the Smart WhatsApp Layer.
 *
 * Everything here is deterministic from store data - no side-effects, safe
 * to call inside React render via useMemo.
 */

import type { Lead, Tour, TCM, Booking } from "@/lib/types";
import type { CallRecord, ObjectionRecord, MessageOutcome } from "./types";

/* ============================================================
 * FUNNEL VELOCITY - average days between consecutive stages.
 * Powers the "where leads slow down" timeline on Manager Dash.
 * ============================================================ */
const STAGE_ORDER: Lead["stage"][] = [
  "new", "contacted", "tour-scheduled", "tour-done", "negotiation", "booked",
];

export interface FunnelVelocityRow {
  fromStage: Lead["stage"];
  toStage: Lead["stage"];
  avgDays: number;     // average dwell time at fromStage
  sample: number;      // number of leads observed
  dropOffPct: number;  // % of leads that never reached toStage
  cohortConv: number;  // % of leads that DID reach toStage
}

export function funnelVelocity(leads: Lead[]): FunnelVelocityRow[] {
  return STAGE_ORDER.slice(0, -1).map((from, i) => {
    const to = STAGE_ORDER[i + 1];
    const reachedFrom = leads.filter((l) => STAGE_ORDER.indexOf(l.stage) >= i);
    const reachedTo = leads.filter((l) => STAGE_ORDER.indexOf(l.stage) >= i + 1);
    const sample = reachedFrom.length;
    const cohortConv = sample === 0 ? 0 : Math.round((reachedTo.length / sample) * 100);
    const dropOffPct = 100 - cohortConv;
    // Approximate dwell using updatedAt − createdAt for those that advanced.
    const advanced = reachedTo;
    const avgDays = advanced.length === 0
      ? 0
      : Math.round(
          advanced.reduce((acc, l) => acc + (
            +new Date(l.updatedAt) - +new Date(l.createdAt)
          ) / 86_400_000, 0) / advanced.length / Math.max(1, i + 1),
        );
    return { fromStage: from, toStage: to, avgDays, sample, dropOffPct, cohortConv };
  });
}

/* ============================================================
 * OBJECTION ↔ LOSS CORRELATION
 * For each objection code: how many of the leads that raised it
 * were ultimately dropped vs booked. Surfaces what is actually
 * killing your conversion.
 * ============================================================ */
export interface ObjectionLossRow {
  code: string;
  raised: number;
  lost: number;
  booked: number;
  lossRate: number; // %
}

export function objectionLossCorrelation(
  leads: Lead[],
  objections: ObjectionRecord[],
): ObjectionLossRow[] {
  const byCode = new Map<string, ObjectionRecord[]>();
  objections
    .filter((o) => o.code !== "none")
    .forEach((o) => {
      const arr = byCode.get(o.code) ?? [];
      arr.push(o);
      byCode.set(o.code, arr);
    });

  const rows: ObjectionLossRow[] = [];
  byCode.forEach((records, code) => {
    const leadIds = new Set(records.map((r) => r.leadId));
    const cohort = leads.filter((l) => leadIds.has(l.id));
    const lost = cohort.filter((l) => l.stage === "dropped").length;
    const booked = cohort.filter((l) => l.stage === "booked").length;
    rows.push({
      code,
      raised: cohort.length,
      lost,
      booked,
      lossRate: cohort.length === 0 ? 0 : Math.round((lost / cohort.length) * 100),
    });
  });
  return rows.sort((a, b) => b.lossRate - a.lossRate);
}

/* ============================================================
 * AGENT COHORT ANALYSIS - apples-to-apples agent compare.
 * Normalises by lead count so a TCM with 3 leads doesn't look
 * better than one with 30 just because of small numbers.
 * ============================================================ */
export interface AgentCohortRow {
  tcmId: string;
  name: string;
  zone: string;
  leads: number;
  bookings: number;
  conv: number;          // %
  objectionsLogged: number;
  objectionsResolved: number;
  resolutionRate: number; // %
  callsPerLead: number;
  avgFirstResponseMins: number;
  cohortRank: number;     // 1 = best
}

export function agentCohort(
  tcms: TCM[],
  leads: Lead[],
  calls: CallRecord[],
  objections: ObjectionRecord[],
): AgentCohortRow[] {
  const rows: AgentCohortRow[] = tcms.map((t) => {
    const myLeads = leads.filter((l) => l.assignedTcmId === t.id);
    const myBookings = myLeads.filter((l) => l.stage === "booked").length;
    const myCalls = calls.filter((c) => myLeads.some((l) => l.id === c.leadId));
    const myObj = objections.filter((o) => myLeads.some((l) => l.id === o.leadId));
    const resolved = myObj.filter((o) => o.resolution === "yes").length;
    const avgResp = myLeads.length === 0
      ? 0
      : Math.round(myLeads.reduce((acc, l) => acc + l.responseSpeedMins, 0) / myLeads.length);
    return {
      tcmId: t.id,
      name: t.name,
      zone: t.zone,
      leads: myLeads.length,
      bookings: myBookings,
      conv: myLeads.length === 0 ? 0 : Math.round((myBookings / myLeads.length) * 100),
      objectionsLogged: myObj.length,
      objectionsResolved: resolved,
      resolutionRate: myObj.length === 0 ? 0 : Math.round((resolved / myObj.length) * 100),
      callsPerLead: myLeads.length === 0 ? 0 : +(myCalls.length / myLeads.length).toFixed(1),
      avgFirstResponseMins: avgResp,
      cohortRank: 0,
    };
  });
  // Composite rank: conv (60%), resolution (25%), responsiveness (15% inverse).
  const scored = rows.map((r) => ({
    ...r,
    _score: r.conv * 0.6 + r.resolutionRate * 0.25 + Math.max(0, 100 - r.avgFirstResponseMins * 4) * 0.15,
  }));
  scored.sort((a, b) => b._score - a._score);
  return scored.map((r, i) => ({ ...r, cohortRank: i + 1, _score: undefined as never }));
}

/* ============================================================
 * "WHAT TO FIX THIS WEEK" - auto-recommendations for managers.
 * Reads funnel + objections + agents and produces concrete moves.
 * ============================================================ */
export interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  detail: string;
  expectedImpact: string;
}

export function weeklyRecommendations(input: {
  leads: Lead[];
  funnel: FunnelVelocityRow[];
  objections: ObjectionRecord[];
  agents: AgentCohortRow[];
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Funnel bottleneck
  const worstStage = [...input.funnel].sort((a, b) => a.cohortConv - b.cohortConv)[0];
  if (worstStage && worstStage.cohortConv < 35 && worstStage.sample >= 3) {
    recs.push({
      id: "funnel-bottleneck",
      priority: worstStage.cohortConv < 20 ? "critical" : "high",
      title: `Fix ${worstStage.fromStage} → ${worstStage.toStage}`,
      detail: `Only ${worstStage.cohortConv}% of leads cross this stage (${worstStage.sample} sample). This is your single biggest revenue leak.`,
      expectedImpact: `Lifting this 15pp adds ~${Math.round(worstStage.sample * 0.15)} bookings.`,
    });
  }

  // 2. Top objection
  const objLoss = objectionLossCorrelation(input.leads, input.objections);
  const topObj = objLoss[0];
  if (topObj && topObj.lossRate >= 50 && topObj.raised >= 3) {
    recs.push({
      id: "objection-killer",
      priority: "high",
      title: `Address "${topObj.code}" objection`,
      detail: `${topObj.lossRate}% of leads who raised this dropped (${topObj.lost}/${topObj.raised}). Build a counter-script + train all TCMs this week.`,
      expectedImpact: `Reducing loss by half saves ~${Math.round(topObj.lost / 2)} leads.`,
    });
  }

  // 3. Outlier agent (negative)
  const sorted = [...input.agents].filter((a) => a.leads >= 3).sort((a, b) => a.conv - b.conv);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (worst && best && best.conv - worst.conv > 15) {
    recs.push({
      id: "agent-coaching",
      priority: "medium",
      title: `Coach ${worst.name}`,
      detail: `${worst.name} converts at ${worst.conv}% vs ${best.name} at ${best.conv}%. Same zone challenge - ride along on 3 calls.`,
      expectedImpact: `Closing half the gap = +${Math.round((best.conv - worst.conv) / 2)}pp on ${worst.leads} leads.`,
    });
  }

  // 4. Never-called pile-up
  const idle = input.leads.filter(
    (l) => l.stage === "new" && (Date.now() - +new Date(l.createdAt)) > 24 * 3_600_000,
  );
  if (idle.length >= 3) {
    recs.push({
      id: "first-response",
      priority: "critical",
      title: `${idle.length} leads never contacted (24h+)`,
      detail: `These are guaranteed losses if not called today. Highest-intent leads decay fastest in the first 24h.`,
      expectedImpact: `Industry data: every hour of delay = -10% conversion.`,
    });
  }

  return recs.slice(0, 6);
}

/* ============================================================
 * ZONE INTELLIGENCE - per-zone P&L and capacity signals.
 * ============================================================ */
export interface ZoneSnapshot {
  zoneId: string;
  zoneName: string;
  city: string;
  tcmIds: string[];
  leadCount: number;
  activeLeads: number;
  bookings: number;
  revenueINR: number;          // sum of monthly rents booked
  conversion: number;          // %
  avgFirstResponseMins: number;
  loadPerTcm: number;          // active leads / tcm count
  slaBreaches: number;         // never-contacted >24h leads
  recommendation: string;
  pressureLevel: "balanced" | "overloaded" | "underloaded" | "leaking";
}

export function zoneSnapshots(input: {
  zones: { id: string; name: string; city: string; tcmIds: string[] }[];
  tcms: TCM[];
  leads: Lead[];
  bookings: Booking[];
}): ZoneSnapshot[] {
  const { zones, tcms, leads, bookings } = input;
  return zones.map((z) => {
    const zoneTcms = tcms.filter((t) => z.tcmIds.includes(t.id));
    const myLeads = leads.filter((l) => z.tcmIds.includes(l.assignedTcmId));
    const active = myLeads.filter((l) => l.stage !== "booked" && l.stage !== "dropped");
    const myBookings = bookings.filter((b) => z.tcmIds.includes(b.tcmId));
    const revenueINR = myBookings.reduce((acc, b) => acc + b.amount, 0);
    const conv = myLeads.length === 0 ? 0 : Math.round((myBookings.length / myLeads.length) * 100);
    const avgResp = myLeads.length === 0
      ? 0
      : Math.round(myLeads.reduce((a, l) => a + l.responseSpeedMins, 0) / myLeads.length);
    const loadPerTcm = zoneTcms.length === 0 ? active.length : +(active.length / zoneTcms.length).toFixed(1);
    const slaBreaches = myLeads.filter(
      (l) => l.stage === "new" && (Date.now() - +new Date(l.createdAt)) > 24 * 3_600_000,
    ).length;

    let pressureLevel: ZoneSnapshot["pressureLevel"] = "balanced";
    let recommendation = "Holding steady - monitor weekly.";
    if (zoneTcms.length === 0 && myLeads.length > 0) {
      pressureLevel = "leaking";
      recommendation = `No TCMs assigned to ${z.name}. Reassign existing leads or hire.`;
    } else if (loadPerTcm > 25) {
      pressureLevel = "overloaded";
      recommendation = `Load ${loadPerTcm}/TCM is high. Add 1 TCM or rebalance ~${Math.round(active.length - 25 * zoneTcms.length)} leads.`;
    } else if (loadPerTcm < 5 && active.length > 0) {
      pressureLevel = "underloaded";
      recommendation = `Capacity available - pull leads from overloaded zones or boost demand.`;
    } else if (slaBreaches >= 3) {
      pressureLevel = "leaking";
      recommendation = `${slaBreaches} leads never contacted 24h+. Hard SLA breach - escalate today.`;
    } else if (conv < 15 && myLeads.length >= 5) {
      pressureLevel = "leaking";
      recommendation = `Conversion ${conv}% is low. Audit calls + objections this week.`;
    }

    return {
      zoneId: z.id,
      zoneName: z.name,
      city: z.city,
      tcmIds: z.tcmIds,
      leadCount: myLeads.length,
      activeLeads: active.length,
      bookings: myBookings.length,
      revenueINR,
      conversion: conv,
      avgFirstResponseMins: avgResp,
      loadPerTcm,
      slaBreaches,
      recommendation,
      pressureLevel,
    };
  });
}

/* ============================================================
 * SMART TEMPLATE PICKER - for a given lead state, recommend
 * the highest-leverage WhatsApp template + a "why" reason.
 * ============================================================ */
export type TemplateRecommendation = {
  stage:
    | "first-intro" | "follow-up" | "visit-confirm" | "post-visit"
    | "price-offer" | "booking-confirm" | "check-in-welcome"
    | "revival-30d" | "revival-60d" | "revival-90d";
  reason: string;
  urgency: "high" | "medium" | "low";
};

export function recommendTemplate(input: {
  lead: Lead;
  tours: Tour[];
  lastContactDays: number;
}): TemplateRecommendation {
  const { lead, tours, lastContactDays } = input;
  const completedTour = tours.find((t) => t.status === "completed");
  const upcomingTour = tours.find((t) => t.status === "scheduled");
  const moveDays = (+new Date(lead.moveInDate) - Date.now()) / 86_400_000;

  if (lead.stage === "booked") {
    return { stage: "booking-confirm", reason: "Lead just booked - send confirmation + welcome.", urgency: "high" };
  }
  if (upcomingTour) {
    return { stage: "visit-confirm", reason: "Upcoming visit - auto-confirm to reduce no-show.", urgency: "high" };
  }
  if (completedTour && lastContactDays >= 1) {
    return { stage: "post-visit", reason: "Tour done - check reaction + push for decision.", urgency: "high" };
  }
  if (lead.stage === "negotiation") {
    return { stage: "price-offer", reason: "In negotiation - send time-bound price offer.", urgency: "high" };
  }
  if (lead.stage === "new" || lastContactDays === Infinity) {
    return { stage: "first-intro", reason: "First touch - open with intro + budget hook.", urgency: "high" };
  }
  if (lastContactDays >= 90) {
    return { stage: "revival-90d", reason: "Cold 90d+ - last-attempt revival.", urgency: "low" };
  }
  if (lastContactDays >= 60) {
    return { stage: "revival-60d", reason: "Cold 60d - fresh inventory bait.", urgency: "low" };
  }
  if (lastContactDays >= 30) {
    return { stage: "revival-30d", reason: "Cold 30d - re-engage with price-drop angle.", urgency: "medium" };
  }
  if (moveDays <= 7) {
    return { stage: "follow-up", reason: "Move-in close - push follow-up before they decide elsewhere.", urgency: "high" };
  }
  return { stage: "follow-up", reason: "Standard follow-up cadence.", urgency: "medium" };
}

/* ============================================================
 * TEMPLATE PERFORMANCE - per-template send-to-book conversion.
 * Reads message-outcome log (CRM10x store).
 * ============================================================ */
export interface TemplatePerf {
  stage: string;
  sent: number;
  replies: number;
  bookings: number;
  replyRate: number;   // %
  bookRate: number;    // %
}

export function templatePerformance(outcomes: MessageOutcome[]): TemplatePerf[] {
  const byStage = new Map<string, MessageOutcome[]>();
  outcomes.forEach((m) => {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  });
  const rows: TemplatePerf[] = [];
  byStage.forEach((records, stage) => {
    const sent = records.length;
    const replies = records.filter((r) => r.replied).length;
    const bookings = records.filter((r) => r.bookedAfter).length;
    rows.push({
      stage,
      sent,
      replies,
      bookings,
      replyRate: sent === 0 ? 0 : Math.round((replies / sent) * 100),
      bookRate: sent === 0 ? 0 : Math.round((bookings / sent) * 100),
    });
  });
  return rows.sort((a, b) => b.bookRate - a.bookRate);
}
