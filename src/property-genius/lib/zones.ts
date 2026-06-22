// Zone state hook + filter helpers. localStorage-backed, cross-tab synced.
import { useEffect, useState } from "react";
import { areaToZone, ZONES, type ZoneId } from "@/property-genius/data/zones";
import type { PG } from "@/property-genius/data/types";

const K = "gh_zone_v1";

export type ActiveZone = ZoneId | "all";

export function loadZone(): ActiveZone {
  try {
    const r = localStorage.getItem(K);
    if (!r) return "all";
    if (r === "all") return "all";
    return ZONES.some((z) => z.id === r) ? (r as ZoneId) : "all";
  } catch { return "all"; }
}

export function saveZone(z: ActiveZone) {
  localStorage.setItem(K, z);
  window.dispatchEvent(new CustomEvent("zone:change"));
}

export function useZone() {
  const [zone, set] = useState<ActiveZone>(() => loadZone());
  useEffect(() => {
    const r = () => set(loadZone());
    window.addEventListener("zone:change", r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener("zone:change", r);
      window.removeEventListener("storage", r);
    };
  }, []);
  return {
    zone,
    setZone: (z: ActiveZone) => { saveZone(z); set(z); },
    isAll: zone === "all",
  };
}

/** Filter a PG list by the currently active zone. No-op when "all". */
export function filterByZone<T extends { area: string }>(items: T[], zone: ActiveZone): T[] {
  if (zone === "all") return items;
  return items.filter((p) => areaToZone(p.area) === zone);
}

/** Count PGs per zone. */
export function zoneCounts(pgs: PG[]): Record<ZoneId, number> {
  const out: Record<string, number> = { koramangala: 0, "orr-south": 0, whitefield: 0, manyata: 0, anywhere: 0 };
  for (const p of pgs) out[areaToZone(p.area)]++;
  return out as Record<ZoneId, number>;
}
