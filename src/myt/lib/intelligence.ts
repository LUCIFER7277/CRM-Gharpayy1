import type { Tour } from "./types";
import type { CustomerFeedback, TCMReport, TourEvent } from "./tour-data-context";
import type { ScoreWeights } from "./settings-context";

// --------- Mismatch detection ---------
export interface Mismatch {
  tourId: string;
  severity: "low" | "med" | "high";
  reason: string;
}

export function detectMismatches(
  tour: Tour,
  feedback?: CustomerFeedback,
  report?: TCMReport,
): Mismatch[] {
  const out: Mismatch[] = [];
  if (!feedback || !report) return out;

  // Customer says "not_fit" but TCM marks high interest
  if (feedback.sentiment === "not_fit" && report.interestLevel === "high") {
    out.push({ tourId: tour.id, severity: "high", reason: "Customer: not a fit · TCM: high interest" });
  }
  // Customer "loved" but TCM "low"
  if (feedback.sentiment === "loved" && report.interestLevel === "low") {
    out.push({ tourId: tour.id, severity: "med", reason: "Customer: loved · TCM: low interest" });
  }
  // Price mismatch - comment mentions expensive but TCM says exact
  const priceWords = (feedback.comment ?? "").toLowerCase();
  if (
    (priceWords.includes("expensive") || priceWords.includes("costly") || priceWords.includes("too much")) &&
    report.budgetAlignment === "exact"
  ) {
    out.push({ tourId: tour.id, severity: "high", reason: "Customer: too expensive · TCM: budget exact match" });
  }
  // Customer needs better but TCM marked booked/hot
  if (feedback.sentiment === "need_better" && (report.outcome === "booked" || report.outcome === "hot")) {
    out.push({ tourId: tour.id, severity: "high", reason: `Customer: need better options · TCM: ${report.outcome}` });
  }
  return out;
}

// --------- Tour Score (weighted, 0-100) ---------
export interface TourScoreBreakdown {
  total: number;
  parts: Record<keyof ScoreWeights, { earned: number; max: number }>;
}

export function computeTourScore(
  tour: Tour,
  events: TourEvent[],
  weights: ScoreWeights,
  feedback?: CustomerFeedback,
  report?: TCMReport,
): TourScoreBreakdown {
  const has = (k: TourEvent["kind"]) => events.some((e) => e.kind === k);

  // Confirmation: did customer reply YES (we approximate via 'confirmed_by_customer' event)
  const confirmation = has("confirmed_by_customer") ? 1 : has("confirmation_sent") ? 0.4 : 0;
  // Show-up
  const showUp =
    tour.status === "completed" || has("tour_started") ? 1 : tour.showUp === false || has("no_show") ? 0 : 0.3;
  // Engagement (proxy: feedback length + report objection captured)
  const engagement = Math.min(
    1,
    (feedback?.comment ? 0.5 : 0) + (report?.firstObjection ? 0.3 : 0) + (report?.priceReactionWords ? 0.2 : 0),
  );
  // Property fit
  const fitMap = { exact: 1, stretch: 0.6, mismatch: 0.1 } as const;
  const propertyFit = report ? fitMap[report.budgetAlignment] : 0.5;
  // TCM report quality
  const tcmReportQuality = report
    ? Math.min(
        1,
        0.3 +
          (report.firstObjection ? 0.2 : 0) +
          (report.priceReactionWords ? 0.2 : 0) +
          (report.nextStep ? 0.2 : 0) +
          (report.notes ? 0.1 : 0),
      )
    : 0;
  // Conversion likelihood
  const outcomeMap: Record<string, number> = { booked: 1, hot: 0.8, warm: 0.5, cold: 0.2, dropped: 0 };
  const conversionLikelihood = report ? (outcomeMap[report.outcome] ?? 0.3) : tour.tokenPaid ? 1 : 0.3;

  const factors = {
    confirmation,
    showUp,
    engagement,
    propertyFit,
    tcmReportQuality,
    conversionLikelihood,
  };

  const parts = {} as TourScoreBreakdown["parts"];
  let total = 0;
  (Object.keys(weights) as Array<keyof ScoreWeights>).forEach((k) => {
    const earned = Math.round(factors[k] * weights[k]);
    parts[k] = { earned, max: weights[k] };
    total += earned;
  });
  return { total: Math.min(100, total), parts };
}

// --------- Aggregations ---------
export function aggregateBy<T, K extends string | number>(
  rows: T[],
  keyFn: (r: T) => K,
  scoreFn: (r: T) => number,
) {
  const m = new Map<K, { count: number; sum: number; avg: number }>();
  rows.forEach((r) => {
    const k = keyFn(r);
    const cur = m.get(k) ?? { count: 0, sum: 0, avg: 0 };
    cur.count += 1;
    cur.sum += scoreFn(r);
    cur.avg = cur.sum / cur.count;
    m.set(k, cur);
  });
  return Array.from(m.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.avg - a.avg);
}
