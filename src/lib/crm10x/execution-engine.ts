/**
 * 100X Date-Anchored Execution Engine.
 *
 * Pure functions: given a UnifiedLead + now, compute the single Next Action
 * the TCM must execute. Also derives breach state for manager escalations.
 *
 * Anchors:
 *   L  = leadDate         (createdAt fallback)
 *   T  = anchors.tourDate (when scheduled)
 *   CI = anchors.checkInDate / earliestCheckIn / moveInDate (best available)
 */

import type { UnifiedLead } from "@/lib/lead-identity/types";
import { SCRIPTS, type ScriptTemplate, type ScriptTimeBucket } from "./scripts";

export type LeadPhase = 1 | 2 | 3 | 4;
export type LeadStage =
  | "NEW" | "CONTACTED" | "TOUR_SCHEDULED" | "TOURED"
  | "NEGOTIATING" | "CLOSED" | "COLD" | "LOST";

export type ObjectionTag =
  | "PRICE-HIGH" | "LOCATION-MISMATCH" | "COMPARING" | "FAMILY-APPROVAL"
  | "TIMING" | "AMENITY-GAP" | "UNRESPONSIVE" | "SWITCHED-PLATFORM"
  | "PLANS-CHANGED" | "UNKNOWN";

export const OBJECTION_TAGS: ObjectionTag[] = [
  "PRICE-HIGH", "LOCATION-MISMATCH", "COMPARING", "FAMILY-APPROVAL",
  "TIMING", "AMENITY-GAP", "UNRESPONSIVE", "SWITCHED-PLATFORM",
  "PLANS-CHANGED", "UNKNOWN",
];

export type BreachState = "ok" | "due" | "breached" | "escalated";

export interface NextAction {
  templateId: string;
  label: string;
  body: string;
  dueAt: string;            // ISO
  reason: string;           // why this action right now
  kind: ScriptTemplate["followUpKind"];
  phase: LeadPhase;
  anchor: "L" | "T" | "CI";
  dayOffset: number;
}

const HR = 60 * 60 * 1000;
const DAY = 24 * HR;

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}
function bucketForHour(h: number): ScriptTimeBucket {
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/** Best-effort current phase derivation from lead fields. */
export function derivePhase(lead: UnifiedLead): LeadPhase {
  const ext = (lead as unknown as { phase?: LeadPhase; stage?: LeadStage });
  if (ext.phase) return ext.phase;
  const anchors = (lead as unknown as { anchors?: { tourDate?: string } }).anchors;
  if (ext.stage === "TOURED" || ext.stage === "NEGOTIATING") return 3;
  if (ext.stage === "TOUR_SCHEDULED" || anchors?.tourDate) return 2;
  if (ext.stage === "COLD" || ext.stage === "LOST") return 4;
  return 1;
}

export function deriveStage(lead: UnifiedLead): LeadStage {
  const s = (lead as unknown as { stage?: LeadStage }).stage;
  if (s) return s;
  switch (lead.state) {
    case "visit-scheduled": return "TOUR_SCHEDULED";
    case "visit-done":      return "TOURED";
    case "converted":       return "CLOSED";
    case "dropped":         return "LOST";
    case "dormant":         return "COLD";
    case "contacted":
    case "interested":      return "CONTACTED";
    default:                return "NEW";
  }
}

function leadAnchor(lead: UnifiedLead): Date {
  return new Date((lead as unknown as { anchors?: { leadDate?: string } }).anchors?.leadDate
    ?? lead.createdAt);
}
function tourAnchor(lead: UnifiedLead): Date | null {
  const t = (lead as unknown as { anchors?: { tourDate?: string } }).anchors?.tourDate;
  return t ? new Date(t) : null;
}
function ciAnchor(lead: UnifiedLead): Date | null {
  const ci =
    (lead as unknown as { anchors?: { checkInDate?: string } }).anchors?.checkInDate
    ?? lead.earliestCheckIn
    ?? lead.moveInDate;
  if (!ci) return null;
  const d = new Date(ci);
  return isNaN(+d) ? null : d;
}

function hasReplied(lead: UnifiedLead): boolean {
  return Boolean((lead as unknown as { replied?: boolean }).replied);
}
function lastContactAt(lead: UnifiedLead): number | null {
  const lc = (lead as unknown as { lastContactAt?: string }).lastContactAt;
  if (lc) return +new Date(lc);
  return lead.lastActivityAt ? +new Date(lead.lastActivityAt) : null;
}
function interestLevel(lead: UnifiedLead): "HOT" | "WARM" | "COLD" | null {
  const v = (lead as unknown as { interestLevel?: "HOT"|"WARM"|"COLD"|null }).interestLevel;
  return v ?? null;
}

function pick(
  phase: LeadPhase, anchor: "L"|"T"|"CI", offset: number,
  bucket: ScriptTimeBucket,
  cond?: ScriptTemplate["condition"],
): ScriptTemplate | undefined {
  return SCRIPTS.find((s) =>
    s.phase === phase && s.anchor === anchor && s.dayOffset === offset
    && (s.timeBucket === bucket || s.timeBucket === "any")
    && (cond ? s.condition === cond : !s.condition));
}

/** Core: compute the single Next Action for a lead. */
export function computeNextAction(lead: UnifiedLead, now: Date = new Date()): NextAction | null {
  const phase = derivePhase(lead);
  const stage = deriveStage(lead);
  if (stage === "CLOSED" || stage === "LOST") return null;

  const bucket = bucketForHour(now.getHours());
  const lastCt = lastContactAt(lead);

  // ───────── PHASE 1 ─────────
  if (phase === 1) {
    const dL = daysBetween(leadAnchor(lead), now);

    // 15-min law: brand new lead with no contact yet
    if (!lastCt && dL === 0) {
      const tpl = pick(1, "L", 0, bucket, "first-touch")!;
      const due = new Date(+leadAnchor(lead) + 15 * 60 * 1000);
      return mkAction(tpl, due, "15-minute law: first contact");
    }

    if (dL === 0) {
      if (!hasReplied(lead) && lastCt && now.getTime() - lastCt > HR) {
        const tpl = pick(1, "L", 0, bucket, "no-reply")
                 ?? pick(1, "L", 0, "afternoon", "no-reply")!;
        return mkAction(tpl, new Date(lastCt + HR), "1h after first message, no reply");
      }
      if (hasReplied(lead)) {
        const tpl = pick(1, "L", 0, bucket, "replied")!;
        return mkAction(tpl, now, "Lead replied — send shortlist");
      }
      if (bucket === "evening") {
        const tpl = pick(1, "L", 0, "evening")!;
        return mkAction(tpl, now, "End-of-day check");
      }
    }

    if (dL === 1) {
      const cond = hasReplied(lead) ? "replied" : "no-reply";
      const tpl =
        (bucket === "morning"   && pick(1, "L", 1, "morning", cond))
     || (bucket === "evening"   && pick(1, "L", 1, "evening"))
     || pick(1, "L", 1, "afternoon")!;
      return mkAction(tpl, now, `L+1 ${bucket}`);
    }

    if (dL === 2) {
      const tpl =
        (bucket === "afternoon" && hasReplied(lead) && pick(1, "L", 2, "afternoon", "replied"))
     || pick(1, "L", 2, "morning")!;
      return mkAction(tpl, now, "L+2 final active push");
    }

    if (dL >= 3) {
      // cold treatment — only re-touch at L+7 or CI drip
      if (dL === 7) {
        const tpl = pick(1, "L", 7, "any", "ci-drip");
        if (tpl) return mkAction(tpl, now, "L+7 cold re-touch");
      }
      // otherwise fall through to CI drip handled at end
    }
  }

  // ───────── PHASE 2 ─────────
  if (phase === 2) {
    const t = tourAnchor(lead);
    if (t) {
      const dT = daysBetween(now, t); // positive = future
      if (dT === 2) return mkAction(pick(2, "T", -2, "any")!, t, "T-2 reminder");
      if (dT === 1) {
        const tpl = pick(2, "T", -1, "evening")!;
        const dueAt = new Date(t); dueAt.setDate(dueAt.getDate() - 1); dueAt.setHours(18,0,0,0);
        return mkAction(tpl, dueAt, "T-1 evening reminder");
      }
      if (dT === 0) {
        // no-show flow
        const isNoShow = (lead as unknown as { noShowFlag?: boolean }).noShowFlag === true;
        const minsPast = (now.getTime() - +t) / 60000;
        if (isNoShow && minsPast >= 30 && minsPast < 180) {
          return mkAction(pick(2, "T", 0, "any", "no-show")!, now, "No-show — 30 min check");
        }
        if (isNoShow && minsPast >= 180) {
          return mkAction(pick(2, "T", 0, "any", "no-show-3h")!, now, "No-show — 3h follow-up");
        }
        // standard morning confirm 2h before
        return mkAction(pick(2, "T", 0, "morning")!, new Date(+t - 2 * HR), "T-0 morning confirm");
      }
      // Tour booked far out — confirmation lives once
      if (dT > 2) {
        return mkAction(pick(2, "T", -99, "any")!, now, "Send booking confirmation");
      }
    }
  }

  // ───────── PHASE 3 ─────────
  if (phase === 3) {
    const t = tourAnchor(lead);
    if (t) {
      const dT = daysBetween(t, now); // positive = days after tour
      const interest = interestLevel(lead);

      if (dT === 0) {
        if (!lastCt || lastCt < +t) {
          // within 2h
          return mkAction(pick(3, "T", 0, "any", "post-visit-good")!, new Date(+t + 2 * HR), "Post-visit within 2h");
        }
        if (bucket === "evening" && !hasReplied(lead)) {
          return mkAction(pick(3, "T", 0, "evening", "post-visit-eod")!, now, "EOD if no reply");
        }
      }

      if (dT === 1) {
        const cond = interest === "HOT" ? "hot" : interest === "COLD" ? "cold" : "warm";
        const tpl = (bucket === "morning" && pick(3, "T", 1, "morning", cond))
                 || pick(3, "T", 1, "afternoon", `objection-${(objKey(lead) ?? "price")}` as ScriptTemplate["condition"])
                 || pick(3, "T", 1, "morning", cond)!;
        return mkAction(tpl, now, `T+1 ${cond}`);
      }

      if (dT === 2) {
        const tpl = bucket === "evening"
          ? pick(3, "T", 2, "evening")!
          : pick(3, "T", 2, "morning", "last-window")!;
        return mkAction(tpl, now, "T+2 one-day-hold push");
      }

      if (dT === 3) {
        return mkAction(pick(3, "T", 3, "any", "final-close")!, now, "T+3 final ask");
      }
    }
  }

  // ───────── PHASE 4 / CI drip ─────────
  const ci = ciAnchor(lead);
  if (ci) {
    const dCI = -daysBetween(now, ci); // negative if future → flip sign so -30..-1
    const drip = SCRIPTS.find((s) => s.phase === 4 && s.dayOffset === dCI);
    if (drip) return mkAction(drip, now, `CI${dCI}`);
  }

  return null;
}

function objKey(lead: UnifiedLead): string | null {
  const t = (lead as unknown as { primaryObjection?: ObjectionTag | null }).primaryObjection;
  if (!t) return null;
  if (t === "PRICE-HIGH") return "price";
  if (t === "LOCATION-MISMATCH") return "location";
  if (t === "FAMILY-APPROVAL") return "family";
  if (t === "AMENITY-GAP") return "size";
  return null;
}

function mkAction(tpl: ScriptTemplate, dueAt: Date, reason: string): NextAction {
  return {
    templateId: tpl.id,
    label: tpl.label,
    body: tpl.body,
    dueAt: dueAt.toISOString(),
    reason,
    kind: tpl.followUpKind,
    phase: tpl.phase,
    anchor: tpl.anchor,
    dayOffset: tpl.dayOffset,
  };
}

/** Render the script body with lead-derived variables. */
export function renderForLead(body: string, lead: UnifiedLead, agentName = "Agent") {
  const ci = ciAnchor(lead);
  const t = tourAnchor(lead);
  const vars: Record<string, string> = {
    name: lead.name?.split(" ")[0] ?? lead.name ?? "there",
    agent: agentName,
    area: lead.area || (lead.areas?.[0] ?? "your area"),
    portal: lead.rawSource?.split(/\s/)[0] ?? "the portal",
    budget: lead.budget ? String(lead.budget) : "your budget",
    property: (lead as unknown as { propertyName?: string }).propertyName ?? "the property",
    address: lead.fullAddress ?? "the address",
    date: t ? t.toLocaleDateString() : "",
    time: t ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    month: ci ? ci.toLocaleString("default", { month: "long" }) : (lead.moveInDate ?? "your month"),
    altArea: "a nearby area",
    altProperty: "an alternative property",
    price: "₹—",
    strength: "its location",
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** Breach state for the manager dashboard. */
export function breachState(lead: UnifiedLead, now: Date = new Date()): BreachState {
  const action = computeNextAction(lead, now);
  if (!action) return "ok";
  const due = +new Date(action.dueAt);
  const diff = now.getTime() - due;
  if (diff < 0) return "ok";
  if (diff < 30 * 60 * 1000) return "due";
  if (diff < 4 * HR) return "breached";
  return "escalated";
}

/** Pretty `L+1 · Afternoon` style label. */
export function phaseDayLabel(action: NextAction): string {
  const sign = action.dayOffset >= 0 ? "+" : "";
  const bucketHint = action.label.includes("·") ? action.label.split("·").slice(1).join("·").trim() : "";
  return `${action.anchor}${sign}${action.dayOffset}${bucketHint ? " · " + bucketHint : ""}`;
}

/** Used by manager 8:30 AM review. */
export function morningReviewBuckets(
  leads: UnifiedLead[],
  now: Date = new Date(),
) {
  const yesterdayStart = startOfDay(new Date(+now - DAY));
  const todayStart = startOfDay(now);

  const newYesterday = leads.filter((l) => {
    const c = +new Date(l.createdAt);
    return c >= +yesterdayStart && c < +todayStart;
  });

  const firstContactMissed = newYesterday.filter((l) => {
    const lc = lastContactAt(l);
    const created = +new Date(l.createdAt);
    return !lc || lc - created > 15 * 60 * 1000;
  });

  const tourScheduled = leads.filter((l) => deriveStage(l) === "TOUR_SCHEDULED");
  const noT1Sent = tourScheduled.filter((l) => {
    const t = tourAnchor(l);
    if (!t) return false;
    const tMinus1 = +t - DAY;
    const lc = lastContactAt(l) ?? 0;
    return now.getTime() >= tMinus1 && lc < tMinus1;
  });

  const noShowYesterday = leads.filter((l) => {
    const t = tourAnchor(l);
    if (!t) return false;
    return (l as unknown as { noShowFlag?: boolean }).noShowFlag === true
      && +t >= +yesterdayStart && +t < +todayStart;
  });

  const toured = leads.filter((l) => deriveStage(l) === "TOURED");
  const stuckAtT3 = toured.filter((l) => {
    const t = tourAnchor(l);
    if (!t) return false;
    return daysBetween(t, now) >= 3;
  });

  const ci7NoActivity = leads.filter((l) => {
    const ci = ciAnchor(l);
    if (!ci) return false;
    const dCI = -daysBetween(now, ci);
    if (dCI < -7 || dCI > 0) return false;
    const lc = lastContactAt(l) ?? 0;
    return now.getTime() - lc > 10 * DAY;
  });

  const lostWithoutTag = leads.filter((l) => {
    const stage = deriveStage(l);
    const obj = (l as unknown as { primaryObjection?: ObjectionTag | null }).primaryObjection;
    return stage === "LOST" && !obj;
  });

  return {
    firstContactMissed,
    noT1Sent,
    noShowYesterday,
    postVisitMissed: toured.filter((l) => {
      const t = tourAnchor(l); if (!t) return false;
      const lc = lastContactAt(l) ?? 0;
      return lc < +t + 2 * HR && daysBetween(t, now) >= 0;
    }),
    stuckAtT3,
    ci7NoActivity,
    lostWithoutTag,
  };
}

export { ymd };
