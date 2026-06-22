/**
 * Auto-Assignment Engine.
 *
 * Pure scoring function: given a lead and the team, pick the TCM most likely
 * to close, factoring zone match, current load, conversion rate, and response speed.
 *
 * Reason chips are a first-class output - every routing decision is explainable.
 */
import type { Lead, TCM, Tour } from "./types";

export interface RouteSuggestion {
  tcmId: string;
  score: number;
  reasons: string[];
}

export function autoAssign(
  lead: Lead,
  tcms: TCM[],
  leads: Lead[],
  tours: Tour[],
): RouteSuggestion {
  const ranked = tcms.map((t) => {
    const reasons: string[] = [];
    let score = 0;

    // Zone match - biggest signal
    if (t.zone.toLowerCase() === lead.preferredArea.toLowerCase()) {
      score += 40;
      reasons.push(`Zone match · ${t.zone}`);
    }

    // Conversion rate (0-100 contribution)
    score += t.conversionRate * 60;
    reasons.push(`${Math.round(t.conversionRate * 100)}% conv`);

    // Response speed (5min = +20, 15min = +0)
    const respBoost = Math.max(0, 20 - t.avgResponseMins * 1.5);
    score += respBoost;
    if (t.avgResponseMins <= 5) reasons.push(`${t.avgResponseMins}m response`);

    // Load penalty: open leads not booked/dropped
    const open = leads.filter(
      (l) => l.assignedTcmId === t.id && l.stage !== "booked" && l.stage !== "dropped",
    ).length;
    score -= open * 2;
    reasons.push(`${open} open`);

    // Pending post-tour penalty (discipline)
    const pending = tours.filter(
      (x) => x.tcmId === t.id && x.status === "completed" && !x.postTour.filledAt,
    ).length;
    score -= pending * 5;
    if (pending > 0) reasons.push(`${pending} post-tour pending`);

    // Hot lead → top performer bonus
    if (lead.intent === "hot" && t.conversionRate >= 0.35) {
      score += 15;
      reasons.push("Top closer for hot lead");
    }

    return { tcmId: t.id, score: Math.round(score), reasons };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0];
}

export function rankAll(
  lead: Lead,
  tcms: TCM[],
  leads: Lead[],
  tours: Tour[],
): RouteSuggestion[] {
  return tcms
    .map(() => null)
    .map((_, i) => {
      const single = autoAssign(lead, [tcms[i]], leads, tours);
      return single;
    })
    .sort((a, b) => b.score - a.score);
}
