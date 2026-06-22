/**
 * Matching Engine v2 - BRD R26-aligned.
 *
 * Produces:
 *   - Top-6 ranked supply matches per lead (filters disqualified)
 *   - 2 PRIMARY picks (A = highest score, B = best score whose dominant
 *     decision driver differs from A)
 *   - SECONDARY picks (remaining ranks)
 *   - Per-match score breakdown + dominant driver + diversity reason
 *
 * Configurable via Settings.matching weights + radius caps + visibility.
 * Falls back to defaults if Settings hasn't loaded yet.
 */
import type { Lead as AppLead } from "@/lib/types";
import type { PG } from "@/supply-hub/data/types";
import { PGS } from "@/supply-hub/data/pgs";
import { distanceLeadToPg, type Distance } from "@/lib/distance";
import { scarcity, valueScore } from "@/supply-hub/lib/intel";
import { toSupplyLead } from "@/lib/lead-supply";
import type { MatchingV2Settings } from "@/myt/lib/settings-context";

export type Driver = "commute" | "budget" | "quality" | "scarcity" | "compliance";

export interface MatchPart {
  label: Driver | "audience";
  pts: number;
  max: number;
  reason: string;
}

export interface MatchV2 {
  pg: PG;
  rank: number;
  score: number;
  parts: MatchPart[];
  bedPrice: number | null;
  bedLabel: string;
  distance: Distance;
  dominantDriver: Driver;
  reasoning: string;
  disqualified?: string;
  /** Set on the picked Primary B; explains why it was paired with A. */
  diversityReason?: string;
  /** Visual ranking band - drives the colour ramp in the UI. */
  band: "primary" | "strong" | "secondary";
}

export interface MatchPair {
  primary: [MatchV2 | null, MatchV2 | null];
  secondary: MatchV2[];
  all: MatchV2[]; // every viable match (Top-6 cap applied via slice)
  disqualified: MatchV2[];
  /** True when the engine could only find one viable match. */
  singleton: boolean;
}

export const DEFAULT_MATCHING: MatchingV2Settings = {
  // Weights - total ~100, sliders in Settings adjust
  wDistance: 35,
  wBudget: 25,
  wAvailability: 12,
  wConversion: 10,
  wCompliance: 8,
  wAudience: 10,
  // Radius caps (km)
  radiusStudent: 3,
  radiusWorking: 8,
  radiusDefault: 12,
  // Output
  topMatchCount: 6,
  primaryCount: 2,
  diversityWeight: 12,
  showOnlyVerified: false,
  hideLowCompliance: false,
  // Drawer
  drawerDefaultTab: "best-fit",
  autoExpandTopMatch: true,
  showAmenitiesPreview: true,
  showManagerContacts: true,
  showMapsAction: true,
  showScoreBreakdown: true,
};

function pickBedPrice(pg: PG, occupancy: string | undefined): { price: number | null; label: string } {
  const p = pg.prices;
  if (occupancy === "Single") return { price: p.single || null, label: p.single ? `Single ₹${(p.single / 1000).toFixed(0)}k` : "No single" };
  if (occupancy === "Double") return { price: p.double || null, label: p.double ? `Double ₹${(p.double / 1000).toFixed(0)}k` : "No double" };
  if (occupancy === "Triple") return { price: p.triple || null, label: p.triple ? `Triple ₹${(p.triple / 1000).toFixed(0)}k` : "No triple" };
  const candidates = [p.triple, p.double, p.single].filter((v) => v > 0);
  if (!candidates.length) return { price: null, label: "Pricing TBC" };
  const cheapest = Math.min(...candidates);
  const which = cheapest === p.triple ? "Triple" : cheapest === p.double ? "Double" : "Single";
  return { price: cheapest, label: `${which} ₹${(cheapest / 1000).toFixed(0)}k` };
}

function audienceTag(lead: AppLead): "Student" | "Working" | "Both" {
  const tags = lead.tags.map((t) => t.toLowerCase());
  if (tags.includes("student")) return "Student";
  if (tags.includes("working")) return "Working";
  return "Both";
}

function radiusForLead(lead: AppLead, m: MatchingV2Settings): number {
  const aud = audienceTag(lead);
  if (aud === "Student") return m.radiusStudent;
  if (aud === "Working") return m.radiusWorking;
  return m.radiusDefault;
}

function complianceScore(pg: PG): number {
  // Local proxy for "owner compliance" - combines IQ + safety + meals/cleaning disclosure.
  const iq = pg.iq;
  const safety = Math.min(20, pg.safety.length * 4);
  const disclosure = (pg.foodType ? 5 : 0) + (pg.mealsIncluded ? 5 : 0) + (pg.cleaning ? 5 : 0);
  return Math.min(100, Math.round(iq * 0.7 + safety + disclosure));
}

function conversionProxy(pg: PG): number {
  // Local proxy for "past conversion rate" - value score + scarcity hot.
  const v = valueScore(pg);
  const sc = scarcity(pg);
  return Math.min(100, Math.round(v * 0.4 + (sc.hot ? 30 : 10)));
}

function isVerified(pg: PG): boolean {
  return pg.iq >= 50;
}

export function runMatcherV2(lead: AppLead, settings?: MatchingV2Settings): MatchPair {
  const m = settings ?? DEFAULT_MATCHING;
  const supplyLead = toSupplyLead(lead);
  const radiusKm = radiusForLead(lead, m);

  const all: MatchV2[] = [];
  const disqualified: MatchV2[] = [];

  for (const pg of PGS) {
    if (m.showOnlyVerified && !isVerified(pg)) continue;

    const dist = distanceLeadToPg(lead.preferredArea, pg);
    const { price: bedPrice, label: bedLabel } = pickBedPrice(pg, supplyLead.occupancy);
    const sc = scarcity(pg);
    const compliance = complianceScore(pg);
    const conversion = conversionProxy(pg);

    if (m.hideLowCompliance && compliance < 50) continue;

    let dq: string | undefined;

    // Hard gates
    if (supplyLead.gender !== "Any" && pg.gender !== supplyLead.gender && pg.gender !== "Co-live") {
      dq = `Gender mismatch - lead ${supplyLead.gender}, PG ${pg.gender}`;
    }
    if (!dq && bedPrice !== null && bedPrice > supplyLead.budgetMax * 1.15) {
      dq = `Over budget by >15%`;
    }
    if (!dq && supplyLead.occupancy && supplyLead.occupancy !== "Any" && bedPrice === null) {
      dq = `${supplyLead.occupancy} sharing not offered`;
    }

    const parts: MatchPart[] = [];

    // 1) Distance - uses radius cap
    let dPts = 0;
    let dReason = "Distance unknown";
    if (dist.km != null) {
      if (dist.km <= radiusKm * 0.4) { dPts = m.wDistance; dReason = `${dist.km} km - within ideal radius`; }
      else if (dist.km <= radiusKm) { dPts = Math.round(m.wDistance * 0.75); dReason = `${dist.km} km - within ${radiusKm} km cap`; }
      else if (dist.km <= radiusKm * 1.6) { dPts = Math.round(m.wDistance * 0.4); dReason = `${dist.km} km - slightly outside radius`; }
      else { dPts = Math.round(m.wDistance * 0.1); dReason = `${dist.km} km - far`; }
    }
    parts.push({ label: "commute", pts: dPts, max: m.wDistance, reason: dReason });

    // 2) Budget
    let bPts = 0;
    let bReason = bedLabel;
    if (bedPrice != null) {
      if (bedPrice >= supplyLead.budgetMin && bedPrice <= supplyLead.budgetMax) { bPts = m.wBudget; bReason = `${bedLabel} fits budget`; }
      else if (bedPrice < supplyLead.budgetMin) { bPts = Math.round(m.wBudget * 0.7); bReason = `${bedLabel} below budget - under-served`; }
      else if (bedPrice <= supplyLead.budgetMax * 1.1) { bPts = Math.round(m.wBudget * 0.5); bReason = `${bedLabel} ~10% over`; }
    }
    parts.push({ label: "budget", pts: bPts, max: m.wBudget, reason: bReason });

    // 3) Availability (scarcity inverted - fewer beds → higher urgency, but full = 0)
    let aPts = 0;
    let aReason = sc.reason;
    if (sc.level === "FULL") { aPts = 0; aReason = "Full - waitlist only"; }
    else if (sc.level === "1 LEFT" || sc.level === "2 LEFT") { aPts = m.wAvailability; aReason = sc.reason; }
    else if (sc.level === "FEW LEFT") { aPts = Math.round(m.wAvailability * 0.7); }
    else { aPts = Math.round(m.wAvailability * 0.5); }
    parts.push({ label: "scarcity", pts: aPts, max: m.wAvailability, reason: aReason });

    // 4) Conversion (proxy)
    const cPts = Math.round((conversion / 100) * m.wConversion);
    parts.push({ label: "quality", pts: cPts, max: m.wConversion, reason: `Conversion proxy ${conversion}/100` });

    // 5) Compliance
    const oPts = Math.round((compliance / 100) * m.wCompliance);
    parts.push({ label: "compliance", pts: oPts, max: m.wCompliance, reason: `Owner compliance ${compliance}/100` });

    // 6) Audience
    const aud = audienceTag(lead);
    const pgAud = (pg.audience || "").toLowerCase();
    let audPts = Math.round(m.wAudience * 0.5);
    let audReason = "Audience open";
    if (aud === "Working" && /professional/.test(pgAud)) { audPts = m.wAudience; audReason = "Working professional fit"; }
    else if (aud === "Student" && /student/.test(pgAud)) { audPts = m.wAudience; audReason = "Student PG fit"; }
    else if (/both/.test(pgAud)) { audPts = Math.round(m.wAudience * 0.85); audReason = "Mixed audience"; }
    parts.push({ label: "audience", pts: audPts, max: m.wAudience, reason: audReason });

    const totalRaw = parts.reduce((s, p) => s + p.pts, 0);
    const totalMax = parts.reduce((s, p) => s + p.max, 0) || 1;
    const score = Math.round((totalRaw / totalMax) * 100);

    const driverParts = parts.filter((p) => p.label !== "audience") as Array<MatchPart & { label: Driver }>;
    const dominant: Driver = (driverParts
      .slice()
      .sort((a, b) => b.pts / b.max - a.pts / a.max)[0]?.label ?? "commute") as Driver;

    const reasoning = dq
      ? `DISQUALIFIED - ${dq}`
      : parts
          .filter((p) => p.pts >= p.max * 0.7)
          .map((p) => p.reason)
          .slice(0, 3)
          .join(" · ") || "Within range across signals";

    const match: MatchV2 = {
      pg,
      rank: 0,
      score: dq ? 0 : score,
      parts,
      bedPrice,
      bedLabel,
      distance: dist,
      dominantDriver: dominant,
      reasoning,
      disqualified: dq,
      band: "secondary",
    };

    if (dq) disqualified.push(match);
    else all.push(match);
  }

  all.sort((a, b) => b.score - a.score || b.pg.iq - a.pg.iq);
  all.forEach((x, i) => (x.rank = i + 1));

  // PRIMARY A - top score
  const primaryA = all[0] ?? null;

  // PRIMARY B - best score whose dominant driver differs from A,
  // also requires score within `diversityWeight` % of A.
  let primaryB: MatchV2 | null = null;
  if (primaryA) {
    const threshold = Math.max(0, primaryA.score - (100 - m.diversityWeight)); // generous default
    const rest = all.slice(1);
    primaryB =
      rest.find((x) => x.dominantDriver !== primaryA.dominantDriver && x.score >= threshold) ??
      rest.find((x) => x.dominantDriver !== primaryA.dominantDriver) ??
      null;

    if (primaryA) primaryA.band = "primary";
    if (primaryB) {
      primaryB.band = "primary";
      primaryB.diversityReason = `Different decision driver - leads on ${primaryB.dominantDriver}, A leads on ${primaryA.dominantDriver}.`;
    }
  }

  const primaryIds = new Set([primaryA?.pg.id, primaryB?.pg.id].filter(Boolean) as string[]);
  const secondary = all
    .filter((x) => !primaryIds.has(x.pg.id))
    .slice(0, Math.max(0, m.topMatchCount - primaryIds.size));
  secondary.forEach((x, i) => (x.band = i < 2 ? "strong" : "secondary"));

  return {
    primary: [primaryA, primaryB],
    secondary,
    all: all.slice(0, m.topMatchCount),
    disqualified,
    singleton: !!primaryA && !primaryB,
  };
}
