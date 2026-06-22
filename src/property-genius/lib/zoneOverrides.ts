// Zone editor — local overrides for zone phone numbers.
// Persists in localStorage; sidebar/closer pick up via getZonePhone().
import { ZONES, type ZoneId } from "@/property-genius/data/zones";

const K = "gh_zone_overrides_v1";
export type ZoneOverrides = Partial<Record<ZoneId, { phone?: string }>>;

export function loadZoneOverrides(): ZoneOverrides {
  try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch { return {}; }
}
export function saveZoneOverrides(o: ZoneOverrides) {
  localStorage.setItem(K, JSON.stringify(o));
  window.dispatchEvent(new CustomEvent("zone:override"));
}
export function getZonePhone(id: ZoneId): string {
  const ov = loadZoneOverrides();
  return ov[id]?.phone || ZONES.find((z) => z.id === id)?.phone || "";
}
