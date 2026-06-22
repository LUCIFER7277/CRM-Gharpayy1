/**
 * Missed Opportunity / Revival Engine.
 *
 * Surfaces hidden revenue:
 *  - Cold leads in a high-vacancy area (re-pitch with new inventory)
 *  - High-intent leads that went silent >48h
 *  - Dropped leads where the original objection (budget) is now resolvable
 */
import type { Lead, Property, Tour } from "./types";

export interface RevivalCandidate {
  leadId: string;
  reason: string;
  matchPropertyId?: string;
  score: number; // higher = more revenue at risk
  signal: "cold-match" | "hot-silent" | "objection-resolved";
}

export function scanRevivals(
  leads: Lead[],
  properties: Property[],
  tours: Tour[],
  now: number,
): RevivalCandidate[] {
  const out: RevivalCandidate[] = [];

  for (const lead of leads) {
    const silentHrs = (now - +new Date(lead.updatedAt)) / 36e5;

    // Hot/warm went silent
    if (
      (lead.intent === "hot" || lead.intent === "warm") &&
      silentHrs >= 48 &&
      lead.stage !== "booked" &&
      lead.stage !== "dropped"
    ) {
      out.push({
        leadId: lead.id,
        reason: `${lead.intent === "hot" ? "Hot" : "Warm"} lead silent ${Math.round(silentHrs / 24)}d`,
        score: lead.intent === "hot" ? 90 : 60,
        signal: "hot-silent",
      });
      continue;
    }

    // Cold or dropped + matching available inventory in their area
    if ((lead.stage === "dropped" || lead.intent === "cold") && silentHrs >= 7 * 24) {
      const match = properties.find(
        (p) =>
          p.area.toLowerCase() === lead.preferredArea.toLowerCase() &&
          p.vacantBeds >= 2 &&
          p.pricePerBed <= lead.budget,
      );
      if (match) {
        out.push({
          leadId: lead.id,
          reason: `Inventory match · ${match.name} · ${match.vacantBeds} beds @ ₹${(match.pricePerBed / 1000).toFixed(0)}k`,
          matchPropertyId: match.id,
          score: 50,
          signal: "cold-match",
        });
        continue;
      }
    }

    // Objection: budget - find property that now fits
    const tour = tours.find((t) => t.leadId === lead.id && t.postTour.objection === "Budget");
    if (tour && lead.stage !== "booked") {
      const fit = properties.find(
        (p) =>
          p.area.toLowerCase() === lead.preferredArea.toLowerCase() &&
          p.pricePerBed <= lead.budget * 0.95,
      );
      if (fit) {
        out.push({
          leadId: lead.id,
          reason: `Budget objection now resolvable · ${fit.name} ₹${(fit.pricePerBed / 1000).toFixed(0)}k`,
          matchPropertyId: fit.id,
          score: 70,
          signal: "objection-resolved",
        });
      }
    }
  }

  return out.sort((a, b) => b.score - a.score);
}
