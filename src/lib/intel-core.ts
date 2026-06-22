/**
 * Intel Core - single source of truth for live-lead intelligence.
 *
 * Pure, deterministic, tree-shakeable. Everything that ranks, scores,
 * times or recommends action against a `contracts.Lead` should call into
 * here, so dashboards, dossiers, action queues and the WS-driven
 * /live-leads view all stay consistent.
 *
 * Inputs are the realtime contracts (Lead / Activity / Todo). No legacy
 * useApp store. Safe to call in render.
 */

import type { Lead, Activity, Todo } from "@/contracts";

// ─────────────────────────── Lead Score ───────────────────────────

export interface LeadScoreSignal {
  label: string;
  impact: number;
}
export interface LeadScore {
  score: number; // 0..100 booking probability
  band: "hot" | "warm" | "cold";
  signals: LeadScoreSignal[];
  recommendation: string;
  nextBestAction: NextAction;
}

const DAY = 86_400_000;

export function scoreLead(lead: Lead, activities: Activity[] = [], todos: Todo[] = []): LeadScore {
  const now = Date.now();
  let score = 30;
  const signals: LeadScoreSignal[] = [];

  // Move-in proximity (urgency)
  const daysToMove = (new Date(lead.moveInDate).getTime() - now) / DAY;
  if (daysToMove <= 7) {
    score += 22;
    signals.push({ label: "Move-in ≤ 7d", impact: 22 });
  } else if (daysToMove <= 15) {
    score += 14;
    signals.push({ label: "Move-in ≤ 15d", impact: 14 });
  } else if (daysToMove <= 30) {
    score += 7;
    signals.push({ label: "Move-in ≤ 30d", impact: 7 });
  } else if (daysToMove > 60) {
    score -= 6;
    signals.push({ label: "Move-in > 60d", impact: -6 });
  }

  // Stage progression
  const stageBoost: Record<Lead["stage"], number> = {
    new: 0,
    contacted: 4,
    "tour-scheduled": 12,
    "on-tour": 14,
    "tour-done": 18,
    negotiation: 24,
    "quote-sent": 28,
    "not-responding-3d": -10,
    "not-responding-7d": -20,
    booked: 40,
    dropped: -30,
  };
  const sb = stageBoost[lead.stage] ?? 0;
  if (sb !== 0) {
    score += sb;
    signals.push({ label: `Stage: ${lead.stage}`, impact: sb });
  }

  // Intent self-declared
  if (lead.intent === "hot") {
    score += 10;
    signals.push({ label: "Intent hot", impact: 10 });
  }
  if (lead.intent === "cold") {
    score -= 8;
    signals.push({ label: "Intent cold", impact: -8 });
  }

  // Response speed (lower = better)
  if (lead.responseSpeedMins > 0 && lead.responseSpeedMins <= 5) {
    score += 6;
    signals.push({ label: "Replied < 5 min", impact: 6 });
  } else if (lead.responseSpeedMins > 60) {
    score -= 4;
    signals.push({ label: "Slow responder", impact: -4 });
  }

  // Engagement: count meaningful inbound activities in last 7d
  const recent = activities.filter((a) => now - new Date(a.occurredAt).getTime() < 7 * DAY);
  const inbound = recent.filter((a) => a.direction === "inbound").length;
  const calls = recent.filter((a) => a.kind === "call").length;
  if (inbound >= 3) {
    score += 8;
    signals.push({ label: `${inbound} inbound msgs/7d`, impact: 8 });
  }
  if (calls >= 1) {
    score += 5;
    signals.push({ label: "Connected on call", impact: 5 });
  }

  // Staleness penalty - last touch
  const lastTouch = activities[0]
    ? new Date(activities[0].occurredAt).getTime()
    : new Date(lead.updatedAt).getTime();
  const stalenessDays = (now - lastTouch) / DAY;
  if (stalenessDays > 7) {
    score -= 10;
    signals.push({ label: `${Math.round(stalenessDays)}d since touch`, impact: -10 });
  } else if (stalenessDays > 3) {
    score -= 4;
    signals.push({ label: "Going cold", impact: -4 });
  }

  // Outstanding todos = active relationship
  const openTodos = todos.filter(
    (t) => t.entityId === lead._id && (t.status === "open" || t.status === "pending-accept"),
  ).length;
  if (openTodos >= 1) {
    score += 3;
    signals.push({ label: `${openTodos} open task(s)`, impact: 3 });
  }

  // Tag heuristics
  const tagSet = new Set(lead.tags.map((t) => t.toLowerCase()));
  if (tagSet.has("urgent")) {
    score += 6;
    signals.push({ label: "Tagged urgent", impact: 6 });
  }
  if (tagSet.has("price-issue") || tagSet.has("budget-low")) {
    score -= 6;
    signals.push({ label: "Price objection", impact: -6 });
  }
  if (tagSet.has("parents-involved")) {
    score -= 3;
    signals.push({ label: "Decision shared", impact: -3 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: LeadScore["band"] = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";

  return {
    score,
    band,
    signals,
    recommendation: recommendationFor(lead, score, stalenessDays),
    nextBestAction: nextActionFor(lead, score, stalenessDays, daysToMove),
  };
}

function recommendationFor(lead: Lead, score: number, stalenessDays: number): string {
  if (lead.stage === "booked") return "🎉 Booked - schedule onboarding.";
  if (lead.stage === "dropped") return "Cold list - drop into 14-day revival sequence.";
  if (score >= 70 && lead.stage === "new") return "Hot lead, untouched - call within 5 min.";
  if (score >= 70) return "Hot - push for tour confirmation today.";
  if (stalenessDays > 5) return "Going cold - send WhatsApp re-engage template.";
  if (lead.stage === "tour-done") return "Tour done - close decision in next 24h.";
  return "Maintain cadence: 1 message every 2 days.";
}

// ─────────────────────────── Next-Best Action ───────────────────────────

export type NextActionKind =
  | "call"
  | "whatsapp"
  | "schedule_tour"
  | "follow_up"
  | "close"
  | "revive"
  | "qualify";
export interface NextAction {
  kind: NextActionKind;
  label: string;
  urgency: "now" | "today" | "this-week";
  reason: string;
}

function nextActionFor(
  lead: Lead,
  score: number,
  stalenessDays: number,
  daysToMove: number,
): NextAction {
  if (lead.stage === "new") {
    return {
      kind: "call",
      label: "Call now",
      urgency: "now",
      reason: "Speed-to-lead drives conversion 4×",
    };
  }
  if (lead.stage === "contacted" && score >= 60) {
    return {
      kind: "schedule_tour",
      label: "Book tour",
      urgency: "today",
      reason: "Engaged + qualified",
    };
  }
  if (lead.stage === "tour-scheduled") {
    return {
      kind: "whatsapp",
      label: "Send tour confirmation",
      urgency: "today",
      reason: "Reduce no-shows",
    };
  }
  if (lead.stage === "tour-done") {
    return {
      kind: "close",
      label: "Ask for the booking",
      urgency: "now",
      reason: "Tour-done window closes in 24h",
    };
  }
  if (lead.stage === "negotiation") {
    return {
      kind: "close",
      label: "Send floor-price + lock fee",
      urgency: "today",
      reason: "In negotiation",
    };
  }
  if (stalenessDays > 7) {
    return {
      kind: "revive",
      label: "Drop into revival",
      urgency: "this-week",
      reason: `Quiet for ${Math.round(stalenessDays)} days`,
    };
  }
  if (daysToMove < 0) {
    return {
      kind: "qualify",
      label: "Re-qualify move-in date",
      urgency: "today",
      reason: "Original move-in passed",
    };
  }
  return {
    kind: "follow_up",
    label: "Send follow-up",
    urgency: "today",
    reason: "Maintain cadence",
  };
}

// ─────────────────────────── SLA / Timing ───────────────────────────

export interface SlaState {
  status: "ok" | "warn" | "breach" | "n/a";
  msToBreach: number;
  message: string;
}

/** Stage-specific SLAs (ms). New leads must be touched in 5 min, etc. */
const STAGE_SLA_MS: Partial<Record<Lead["stage"], number>> = {
  new: 5 * 60_000,
  contacted: 24 * 3_600_000,
  "tour-scheduled": 2 * 3_600_000,
  "tour-done": 24 * 3_600_000,
  negotiation: 12 * 3_600_000,
};

export function slaFor(lead: Lead, lastActivityAt?: string | null): SlaState {
  const sla = STAGE_SLA_MS[lead.stage];
  if (!sla) return { status: "n/a", msToBreach: 0, message: "-" };
  const anchor = lastActivityAt
    ? new Date(lastActivityAt).getTime()
    : new Date(lead.updatedAt).getTime();
  const elapsed = Date.now() - anchor;
  const msToBreach = sla - elapsed;
  if (msToBreach < 0)
    return { status: "breach", msToBreach, message: `SLA breached by ${fmtDur(-msToBreach)}` };
  if (msToBreach < sla * 0.25)
    return { status: "warn", msToBreach, message: `${fmtDur(msToBreach)} left` };
  return { status: "ok", msToBreach, message: `${fmtDur(msToBreach)} left` };
}

function fmtDur(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// ─────────────────────────── Best Time to Call ───────────────────────────

export interface BestTimeWindow {
  hourStart: number;
  hourEnd: number;
  label: string;
  confidence: number;
}

/**
 * Infer best contact window from prior inbound activity timestamps.
 * Falls back to a sensible default (7-9 PM IST) when we have no data.
 */
export function bestTimeToContact(activities: Activity[]): BestTimeWindow {
  const inbound = activities.filter((a) => a.direction === "inbound");
  if (inbound.length < 3) {
    return { hourStart: 19, hourEnd: 21, label: "7-9 PM (default)", confidence: 30 };
  }
  const buckets = new Array(24).fill(0);
  for (const a of inbound) buckets[new Date(a.occurredAt).getHours()]++;
  // 3-hour rolling window with the highest sum
  let best = 0,
    idx = 0;
  for (let h = 0; h < 24; h++) {
    const sum = buckets[h] + buckets[(h + 1) % 24] + buckets[(h + 2) % 24];
    if (sum > best) {
      best = sum;
      idx = h;
    }
  }
  const conf = Math.min(100, Math.round((best / inbound.length) * 100));
  return {
    hourStart: idx,
    hourEnd: (idx + 3) % 24,
    label: `${fmtHour(idx)}–${fmtHour((idx + 3) % 24)}`,
    confidence: conf,
  };
}

const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

// ─────────────────────────── Auto Dossier ───────────────────────────

export interface DossierSummary {
  headline: string;
  bullets: string[];
  warnings: string[];
}

export function summariseLead(lead: Lead, activities: Activity[], todos: Todo[]): DossierSummary {
  const score = scoreLead(lead, activities, todos);
  const last = activities[0];
  const calls = activities.filter((a) => a.kind === "call").length;
  const messages = activities.filter(
    (a) => a.kind === "whatsapp" || a.kind === "sms" || a.kind === "email",
  ).length;
  const objections = activities.filter((a) => /objection/i.test(a.subject ?? "")).length;

  const bullets = [
    `${score.score}/100 booking probability (${score.band})`,
    `Budget ₹${lead.budget.toLocaleString("en-IN")} · ${lead.preferredArea} · move-in ${lead.moveInDate}`,
    `${calls} call(s) · ${messages} message(s) · ${objections} objection(s) logged`,
    last
      ? `Last touch: ${last.subject} (${new Date(last.occurredAt).toLocaleString()})`
      : "No activities logged yet",
  ];
  const warnings: string[] = [];
  const sla = slaFor(lead, last?.occurredAt);
  if (sla.status === "breach") warnings.push(`SLA breached for stage "${lead.stage}"`);
  if (score.band === "cold" && lead.stage !== "dropped")
    warnings.push("Lead going cold - consider revival");

  return {
    headline: `${lead.name} - ${score.recommendation}`,
    bullets,
    warnings,
  };
}

// ─────────────────────────── Action Queue ───────────────────────────

export interface QueuedAction {
  lead: Lead;
  score: LeadScore;
  sla: SlaState;
  priority: number; // higher = more urgent
}

/**
 * Build a prioritised work queue for an agent: combines lead score with
 * SLA pressure and stage urgency. Returns top-N.
 */
export function buildActionQueue(
  leads: Lead[],
  activitiesByLead: Record<string, Activity[]>,
  todosByLead: Record<string, Todo[]>,
  limit = 10,
): QueuedAction[] {
  const items = leads
    .filter((l) => l.stage !== "booked" && l.stage !== "dropped")
    .map((lead) => {
      const acts = activitiesByLead[lead._id] ?? [];
      const tds = todosByLead[lead._id] ?? [];
      const score = scoreLead(lead, acts, tds);
      const sla = slaFor(lead, acts[0]?.occurredAt);
      let priority = score.score;
      if (sla.status === "breach") priority += 50;
      else if (sla.status === "warn") priority += 20;
      if (score.nextBestAction.urgency === "now") priority += 15;
      return { lead, score, sla, priority };
    })
    .sort((a, b) => b.priority - a.priority);
  return items.slice(0, limit);
}
