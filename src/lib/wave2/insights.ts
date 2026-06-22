/**
 * Insights - funnel, conversion, response-speed, and stage age analytics
 * computed in-browser from live leads + activities. Pure & memo-friendly.
 */
import type { Lead, Activity } from "@/contracts";

const STAGE_ORDER: Lead["stage"][] = [
  "new", "contacted", "tour-scheduled", "tour-done", "negotiation", "booked",
];

export interface FunnelRow { stage: Lead["stage"]; count: number; pctOfTop: number; pctConvert: number; }

export function funnel(leads: Lead[]): FunnelRow[] {
  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
  // Cumulative: anyone in `negotiation` already passed `new`
  const cumulative = new Array(STAGE_ORDER.length).fill(0);
  STAGE_ORDER.forEach((s, i) => {
    let sum = 0;
    for (let j = i; j < STAGE_ORDER.length; j++) sum += counts[STAGE_ORDER[j]] ?? 0;
    cumulative[i] = sum;
  });
  const top = cumulative[0] || 1;
  return STAGE_ORDER.map((s, i) => ({
    stage: s,
    count: cumulative[i],
    pctOfTop: Math.round((cumulative[i] / top) * 100),
    pctConvert: i === 0 ? 100 : Math.round((cumulative[i] / Math.max(1, cumulative[i - 1])) * 100),
  }));
}

export interface ConversionStats {
  total: number;
  booked: number;
  dropped: number;
  conversionRate: number;
  dropRate: number;
  avgResponseMins: number;
  medianResponseMins: number;
}
export function conversionStats(leads: Lead[]): ConversionStats {
  const total = leads.length || 1;
  const booked = leads.filter((l) => l.stage === "booked").length;
  const dropped = leads.filter((l) => l.stage === "dropped").length;
  const responses = leads.map((l) => l.responseSpeedMins).filter((v) => v > 0).sort((a, b) => a - b);
  const avg = responses.length ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : 0;
  const median = responses.length ? responses[Math.floor(responses.length / 2)] : 0;
  return {
    total: leads.length, booked, dropped,
    conversionRate: Math.round((booked / total) * 100),
    dropRate: Math.round((dropped / total) * 100),
    avgResponseMins: avg, medianResponseMins: median,
  };
}

export interface StageAge { stage: Lead["stage"]; avgDays: number; oldestDays: number; count: number; }
export function stageAges(leads: Lead[]): StageAge[] {
  const map = new Map<Lead["stage"], number[]>();
  const now = Date.now();
  for (const l of leads) {
    const days = (now - new Date(l.updatedAt).getTime()) / 86_400_000;
    if (!map.has(l.stage)) map.set(l.stage, []);
    map.get(l.stage)!.push(days);
  }
  return Array.from(map.entries()).map(([stage, arr]) => ({
    stage,
    avgDays: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
    oldestDays: Math.round(Math.max(...arr) * 10) / 10,
    count: arr.length,
  })).sort((a, b) => b.avgDays - a.avgDays);
}

/** 24-bucket activity heatmap (IST hour). */
export function activityHeatmap(activities: Activity[]): number[] {
  const b = new Array(24).fill(0);
  for (const a of activities) {
    const h = new Date(a.occurredAt).getHours();
    b[h]++;
  }
  return b;
}

export interface SourceROI { source: string; total: number; booked: number; rate: number; }
export function sourceROI(leads: Lead[]): SourceROI[] {
  const map = new Map<string, { total: number; booked: number }>();
  for (const l of leads) {
    const key = l.source || "manual";
    if (!map.has(key)) map.set(key, { total: 0, booked: 0 });
    const r = map.get(key)!; r.total++;
    if (l.stage === "booked") r.booked++;
  }
  return Array.from(map.entries())
    .map(([source, v]) => ({ source, ...v, rate: Math.round((v.booked / v.total) * 100) }))
    .sort((a, b) => b.rate - a.rate);
}
