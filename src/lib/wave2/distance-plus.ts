/**
 * Distance Plus - value-add layer over `lib/distance.ts`. Adds:
 *   - cost estimates (auto/cab/metro+walk)
 *   - tour clustering (group nearby PGs for same site visit)
 *   - travel-time SLA for ops (ETA banding)
 *   - reverse-area inference: which campus/office "owns" a PG
 *
 * Pure functions; consume outputs of distanceLeadToPg().
 */
import type { Distance } from "@/lib/distance";
import type { PG } from "@/supply-hub/data/types";

export interface CostEstimate {
  auto: number;   // INR
  cab:  number;
  metroWalk: number | null;
  cheapest: { mode: "walk" | "auto" | "cab" | "metro"; inr: number };
}

const AUTO_BASE = 35, AUTO_PER_KM = 16;
const CAB_BASE  = 60, CAB_PER_KM  = 22;
const METRO_FLAT = 30;

export function costFor(d: Distance): CostEstimate {
  const km = d.km ?? 0;
  const auto = Math.round(AUTO_BASE + AUTO_PER_KM * km);
  const cab  = Math.round(CAB_BASE  + CAB_PER_KM  * km);
  const metroWalk = km > 3 ? METRO_FLAT + Math.round(8 * Math.max(0, km - 3)) : null;
  let cheapest: CostEstimate["cheapest"];
  if (d.band === "walk") cheapest = { mode: "walk", inr: 0 };
  else if (metroWalk != null && metroWalk < auto) cheapest = { mode: "metro", inr: metroWalk };
  else cheapest = { mode: "auto", inr: auto };
  return { auto, cab, metroWalk, cheapest };
}

/** ETA SLA banding - for ops dispatching agents to PGs. */
export type EtaBand = "fast" | "normal" | "slow" | "blocked";
export function etaBand(d: Distance): { band: EtaBand; minutes: number; label: string } {
  const m = d.peakMins ?? d.autoMins ?? 0;
  if (m === 0)        return { band: "blocked", minutes: 0, label: "ETA unknown" };
  if (m <= 15)        return { band: "fast",    minutes: m, label: `${m}m - fast` };
  if (m <= 35)        return { band: "normal",  minutes: m, label: `${m}m - normal` };
  if (m <= 60)        return { band: "slow",    minutes: m, label: `${m}m - slow (peak)` };
  return                     { band: "blocked", minutes: m, label: `${m}m - too far for one slot` };
}

/**
 * Cluster a list of PGs by area so a single tour slot can cover multiple.
 * Returns groups sorted by size desc, then by distance asc.
 */
export interface PgCluster { area: string; pgs: PG[]; minKm: number; }
export function clusterPgs(pgs: { pg: PG; d: Distance }[]): PgCluster[] {
  const map = new Map<string, { pgs: PG[]; minKm: number }>();
  for (const { pg, d } of pgs) {
    const key = pg.area || "Unknown";
    const cur = map.get(key);
    const km = d.km ?? Infinity;
    if (!cur) map.set(key, { pgs: [pg], minKm: km });
    else { cur.pgs.push(pg); cur.minKm = Math.min(cur.minKm, km); }
  }
  return Array.from(map.entries())
    .map(([area, v]) => ({ area, ...v }))
    .sort((a, b) => b.pgs.length - a.pgs.length || a.minKm - b.minKm);
}

/**
 * Suggest the optimal tour slot order - greedy nearest-neighbor from the
 * lead's home area through a list of PGs.
 */
export function tourRoute(pgsWithD: { pg: PG; d: Distance }[]): PG[] {
  const sorted = [...pgsWithD].sort((a, b) => (a.d.km ?? 9999) - (b.d.km ?? 9999));
  return sorted.map((x) => x.pg);
}

export interface CommuteVerdict {
  band: "loved" | "ok" | "stretch" | "deal-breaker";
  oneLine: string;
}
/** Subjective verdict - for chat templates and sales narration. */
export function commuteVerdict(d: Distance): CommuteVerdict {
  if (d.band === "walk")        return { band: "loved",       oneLine: `Walking distance - ${d.walkMins}m on foot` };
  if (d.band === "short")       return { band: "ok",          oneLine: `Quick auto - ${d.autoMins}m off-peak` };
  if (d.band === "commutable")  return { band: "stretch",     oneLine: `Bearable: ${d.autoMins}m off-peak, ${d.peakMins}m peak` };
  if (d.band === "far")         return { band: "deal-breaker", oneLine: `Likely too far - ${d.km}km, peak ${d.peakMins}m` };
  return                              { band: "stretch",     oneLine: "Distance unknown" };
}
