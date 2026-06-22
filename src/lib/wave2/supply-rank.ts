/**
 * Supply ranking v2 - combines match score, distance band, occupancy and
 * recency-of-availability into a single "fit score" for the lead, plus a
 * one-line WhatsApp pitch generator.
 */
import type { Lead } from "@/contracts";
import type { PG } from "@/supply-hub/data/types";
import { distanceLeadToPg } from "@/lib/distance";
import { commuteVerdict, costFor } from "./distance-plus";

export interface FitResult {
  pg: PG;
  fitScore: number;         // 0..100
  signals: string[];
  whatsappPitch: string;
  commuteOneLine: string;
  cheapestMode: string;
}

const BAND_W = { walk: 30, short: 22, commutable: 12, far: 0, unknown: 5 } as const;

export function rankSupplyForLead(lead: Lead, pgs: PG[]): FitResult[] {
  const out: FitResult[] = [];
  for (const pg of pgs) {
    const d = distanceLeadToPg(lead.preferredArea, pg);
    const v = commuteVerdict(d);
    const c = costFor(d);
    const signals: string[] = [];
    let score = 30;

    score += BAND_W[d.band];
    signals.push(v.oneLine);

    // Budget fit
    const minPrice = pg.prices?.min ?? 0;
    if (minPrice > 0 && lead.budget >= minPrice && lead.budget <= minPrice * 1.3) {
      score += 18; signals.push(`In budget · ₹${minPrice.toLocaleString("en-IN")}`);
    } else if (minPrice > 0 && lead.budget < minPrice) {
      score -= 15; signals.push(`Above budget by ₹${(minPrice - lead.budget).toLocaleString("en-IN")}`);
    }

    // Gender / audience match
    const tags = new Set(lead.tags.map((t) => t.toLowerCase()));
    const g = pg.gender?.toLowerCase() ?? "";
    if (tags.has("girls") && g.includes("girl")) { score += 6; signals.push("Girls-only match"); }
    if (tags.has("boys")  && g.includes("boy"))  { score += 6; signals.push("Boys-only match"); }
    const aud = pg.audience?.toLowerCase() ?? "";
    if (tags.has("student") && aud.includes("student")) { score += 4; signals.push("Student-friendly"); }
    if (tags.has("working") && aud.includes("working")) { score += 4; signals.push("Working-pro friendly"); }

    // Availability freshness (assume pg.updatedAt or fallback)
    const upd = (pg as unknown as { updatedAt?: string }).updatedAt;
    if (upd) {
      const days = (Date.now() - new Date(upd).getTime()) / 86_400_000;
      if (days < 3)        { score += 5; signals.push("Just-listed inventory"); }
      else if (days > 30)  { score -= 6; signals.push("Stale inventory - reverify"); }
    }

    // Landmark density
    const landmarks = pg.nearbyLandmarks?.length ?? 0;
    if (landmarks >= 3) { score += 4; signals.push(`${landmarks} landmarks nearby`); }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const pitch = `Hi ${lead.name}! Based on your need (${lead.preferredArea}, ₹${lead.budget.toLocaleString("en-IN")}), ${pg.name} in ${pg.area} fits you well. ${v.oneLine}. Cheapest commute: ${c.cheapest.mode} ~₹${c.cheapest.inr}. Want to visit?`;

    out.push({ pg, fitScore: score, signals, whatsappPitch: pitch, commuteOneLine: v.oneLine, cheapestMode: `${c.cheapest.mode} ₹${c.cheapest.inr}` });
  }
  return out.sort((a, b) => b.fitScore - a.fitScore);
}
