/**
 * Distance Intelligence Layer v2.
 *
 * Local heuristic only - no external maps API. Computes:
 *   - km (haversine when coords known, else area centroid table fallback)
 *   - travel time @ normal & peak hours
 *   - walkability index (0..100)
 *   - campus / office tag (Christ, Manyata, Whitefield, Marathahalli, Indiranagar, Koramangala, Outer Ring)
 *   - decision driver banding ("walk", "short hop", "commutable", "far")
 *
 * Designed so a Maps API can be slotted in later behind the same surface.
 */
import type { PG } from "@/supply-hub/data/types";
import { LANDMARKS } from "@/supply-hub/data/landmarks";
import { AREA_CENTROID, DISTANCE } from "@/supply-hub/data/areas";

export type DistanceBand = "walk" | "short" | "commutable" | "far" | "unknown";
export type CampusTag =
  | "Christ Belt"
  | "Manyata Tech"
  | "Whitefield IT"
  | "Marathahalli ORR"
  | "Outer Ring"
  | "Koramangala Hub"
  | "Indiranagar"
  | "City Core"
  | "-";

export interface Distance {
  km: number | null;
  walkMins: number | null;     // 5 km/h walking pace
  autoMins: number | null;     // ~22 km/h normal
  peakMins: number | null;     // ~13 km/h peak
  walkability: number;         // 0..100
  band: DistanceBand;
  campusTag: CampusTag;
  oneLiner: string;
}

const norm = (s: string) => (s || "").toLowerCase().trim();

function hav(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function leadCoords(area: string): { lat: number; lng: number } | null {
  const n = norm(area);
  if (!n) return null;
  const lm = LANDMARKS.find(
    (l) => l.lat && l.lng && (l.n.toLowerCase().includes(n) || n.includes(l.n.toLowerCase().split(" ")[0])),
  );
  if (lm && lm.lat && lm.lng) return { lat: lm.lat, lng: lm.lng };
  for (const [k, v] of Object.entries(AREA_CENTROID)) {
    if (k.toLowerCase().includes(n) || n.includes(k.toLowerCase())) return v;
  }
  return null;
}

function band(km: number | null): DistanceBand {
  if (km == null) return "unknown";
  if (km <= 1.2) return "walk";
  if (km <= 5) return "short";
  if (km <= 12) return "commutable";
  return "far";
}

function campusTagForLead(area: string): CampusTag {
  const n = norm(area);
  if (/christ|jain|bms|college/.test(n)) return "Christ Belt";
  if (/manyata|hebbal/.test(n)) return "Manyata Tech";
  if (/whitefield|itpl|brookefield/.test(n)) return "Whitefield IT";
  if (/marathahalli|mahadevpura|kr puram|ecospace/.test(n)) return "Marathahalli ORR";
  if (/outer ring|orr|bellandur|sarjapur|electronic city/.test(n)) return "Outer Ring";
  if (/koramangala/.test(n)) return "Koramangala Hub";
  if (/indiranagar/.test(n)) return "Indiranagar";
  if (/mg road|brigade|cubbon/.test(n)) return "City Core";
  return "-";
}

export function distanceLeadToPg(leadArea: string, pg: PG): Distance {
  const c = leadCoords(leadArea);
  let km: number | null = null;

  if (c && pg.lat != null && pg.lng != null) {
    km = hav(c.lat, c.lng, pg.lat, pg.lng);
  } else {
    // fallback to static distance matrix
    const f = Object.keys(DISTANCE).find(
      (k) => norm(k) === norm(leadArea) || norm(leadArea).includes(norm(k)),
    );
    if (f) {
      const row = DISTANCE[f];
      const t = Object.keys(row).find(
        (k) => norm(k) === norm(pg.area) || norm(pg.area).includes(norm(k)),
      );
      if (t) km = row[t];
    }
  }

  const walkMins = km != null ? Math.round(km * 12) : null;
  const autoMins = km != null ? Math.max(5, Math.round(km * 2.7)) : null;
  const peakMins = km != null ? Math.max(8, Math.round(km * 4.6)) : null;

  // Walkability proxy: the closer + the more nearby landmarks the PG has, the higher.
  const landmarkBoost = Math.min(20, (pg.nearbyLandmarks?.length ?? 0) * 2);
  let walkability = 0;
  if (km != null) {
    if (km <= 1) walkability = 95;
    else if (km <= 2) walkability = 80;
    else if (km <= 4) walkability = 60;
    else if (km <= 8) walkability = 35;
    else walkability = 15;
    walkability = Math.min(100, walkability + landmarkBoost);
  }

  const b = band(km);
  const tag = campusTagForLead(leadArea);
  const oneLiner =
    km == null
      ? "Distance unknown - confirm with lead"
      : b === "walk"
        ? `${walkMins} min walk · ${km < 1 ? Math.round(km * 1000) + "m" : km + " km"}`
        : b === "short"
          ? `Auto ${autoMins} min · peak ${peakMins} min · ${km} km`
          : b === "commutable"
            ? `Commutable · ${km} km · peak ${peakMins} min`
            : `Far - ${km} km · peak ${peakMins} min`;

  return { km, walkMins, autoMins, peakMins, walkability, band: b, campusTag: tag, oneLiner };
}
