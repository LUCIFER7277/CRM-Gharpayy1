/**
 * Pure functions for booking probability, best-time inference, lost-reason
 * analytics, and stage velocity. No side effects, safe to call in render.
 */

import type { Lead, Tour } from "@/lib/types";
import type { CallRecord, DeepLeadProfile, ObjectionRecord, VisitIntel } from "./types";

export interface ProbabilityInput {
  lead: Lead;
  profile?: DeepLeadProfile;
  tours: Tour[];
  visits: VisitIntel[];
  objections: ObjectionRecord[];
  calls: CallRecord[];
}

export interface ProbabilityBreakdown {
  score: number;            // 0-100 booking probability
  signals: { label: string; impact: number }[];
  recommendation: string;
}

export function computeBookingProbability(input: ProbabilityInput): ProbabilityBreakdown {
  const { lead, profile, tours, visits, objections, calls } = input;
  let score = 25; // baseline
  const signals: { label: string; impact: number }[] = [];

  // Move-in proximity
  const days = (new Date(lead.moveInDate).getTime() - Date.now()) / 86400000;
  if (days <= 7) { score += 20; signals.push({ label: "Move-in ≤7d", impact: 20 }); }
  else if (days <= 15) { score += 12; signals.push({ label: "Move-in ≤15d", impact: 12 }); }
  else if (days <= 30) { score += 6; signals.push({ label: "Move-in ≤30d", impact: 6 }); }
  else { score -= 4; signals.push({ label: "Move-in >30d", impact: -4 }); }

  // Verified budget / move-in
  if (profile?.verifiedBudget) { score += 8; signals.push({ label: "Budget verified", impact: 8 }); }
  if (profile?.verifiedMoveIn) { score += 6; signals.push({ label: "Move-in verified", impact: 6 }); }

  // Decision authority
  if (profile?.decisionMaker === "self") { score += 8; signals.push({ label: "Self-deciding", impact: 8 }); }
  else if (profile?.decisionMaker === "parents") { score -= 4; signals.push({ label: "Needs parental approval", impact: -4 }); }
  else if (profile?.decisionMaker === "company-hr") { score -= 6; signals.push({ label: "Needs HR approval", impact: -6 }); }

  // Competing PGs
  const competing = profile?.shortlistedCount ?? 0;
  if (competing >= 4) { score -= 10; signals.push({ label: `${competing} competing PGs`, impact: -10 }); }
  else if (competing === 0) { score += 4; signals.push({ label: "No competition", impact: 4 }); }

  // Tours done
  const completedTours = tours.filter((t) => t.status === "completed").length;
  if (completedTours >= 1) { score += 12; signals.push({ label: "Visit done", impact: 12 }); }

  // Visit reaction
  const lastVisit = visits.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  if (lastVisit?.reaction === "loved") { score += 12; signals.push({ label: "Loved the property", impact: 12 }); }
  if (lastVisit?.reaction === "disappointed") { score -= 14; signals.push({ label: "Disappointed at visit", impact: -14 }); }

  // Unresolved objections
  const unresolved = objections.filter((o) => o.code !== "none" && o.resolution !== "yes");
  if (unresolved.length > 0) {
    const drop = Math.min(15, unresolved.length * 6);
    score -= drop;
    signals.push({ label: `${unresolved.length} open objection(s)`, impact: -drop });
  }

  // Recent contact
  const lastCall = calls[0];
  const lastCallDays = lastCall ? (Date.now() - new Date(lastCall.ts).getTime()) / 86400000 : Infinity;
  if (lastCallDays <= 1) { score += 4; signals.push({ label: "Contacted today", impact: 4 }); }
  else if (lastCallDays >= 7) { score -= 8; signals.push({ label: "No contact in 7d+", impact: -8 }); }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const recommendation =
    score >= 75 ? "Push for token now - call within 2h."
    : score >= 50 ? "Send fresh property options + price reassurance."
    : score >= 30 ? "Re-qualify on call: budget, move-in, decision-maker."
    : "Cold - drop into 30/60/90d revival sequence.";

  return { score, signals, recommendation };
}

export function inferBestCallTime(calls: CallRecord[]): string | null {
  const answered = calls.filter((c) => c.outcome === "answered");
  if (answered.length === 0) return null;
  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  answered.forEach((c) => {
    const h = new Date(c.ts).getHours();
    if (h < 12) buckets.morning++;
    else if (h < 17) buckets.afternoon++;
    else if (h < 21) buckets.evening++;
    else buckets.night++;
  });
  const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  if (top[1] === 0) return null;
  return top[0];
}

/** Aggregate top objections across all leads. */
export function topObjections(objections: ObjectionRecord[]): { code: string; count: number; pct: number }[] {
  const filtered = objections.filter((o) => o.code !== "none");
  const total = filtered.length || 1;
  const map = new Map<string, number>();
  filtered.forEach((o) => map.set(o.code, (map.get(o.code) ?? 0) + 1));
  return Array.from(map.entries())
    .map(([code, count]) => ({ code, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/** Days from createdAt → first booked tour (or now if not booked). */
export function avgStageVelocity(leads: Lead[]): number {
  const booked = leads.filter((l) => l.stage === "booked");
  if (booked.length === 0) return 0;
  const totalDays = booked.reduce((acc, l) => {
    const d = (new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime()) / 86400000;
    return acc + d;
  }, 0);
  return Math.round(totalDays / booked.length);
}

/** Conversion funnel between consecutive stages. */
export function funnelMetrics(leads: Lead[]) {
  const order: Lead["stage"][] = ["new","contacted","tour-scheduled","tour-done","negotiation","booked"];
  const counts = order.map((stage) => leads.filter((l) =>
    order.indexOf(l.stage) >= order.indexOf(stage)).length);
  return order.map((stage, i) => {
    const next = i < order.length - 1 ? counts[i + 1] : counts[i];
    const conv = counts[i] === 0 ? 0 : Math.round((next / counts[i]) * 100);
    return { stage, count: counts[i], conversionToNext: conv };
  });
}
