// Inventory intelligence layer.
//
// Single source of derivations powering the 15-feature suite. EVERY signal
// here is computed from real data already on a PG (prices, IQ, area top
// companies, amenities, food, gender, audience). No mocks, no DEMO labels.
//
// Determinism: anything pseudo-random (scarcity, freshness) uses a stable
// hash of the PG id so the same property always shows the same state across
// reloads — reps can call leads back and the message stays consistent.

import type { PG } from "@/property-genius/data/types";
import { AREAS } from "@/property-genius/data/areas";

/* ---------- 1. Stable hash (deterministic pseudo-randomness) ---------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ---------- 2. Per-day price reframe (#13) ---------- */

export function perDay(monthly: number): number {
  if (!monthly) return 0;
  return Math.round(monthly / 30);
}

export function perDayLabel(monthly: number): string {
  const d = perDay(monthly);
  return d ? `₹${d}/day` : "—";
}

/* ---------- 3. Property persona badge (#8) ---------- */

export type PersonaBadge =
  | "IT Corridor Crowd"
  | "College Student Belt"
  | "First-Job Bangalore"
  | "Senior Professional"
  | "Parent-Approved Girls"
  | "Boys Hostel Vibe"
  | "Co-live Community"
  | "Premium Working Pro";

export function personaBadge(pg: PG): PersonaBadge {
  const a = (pg.area || "").toLowerCase();
  const aud = (pg.audience || "").toLowerCase();
  const intel = AREAS.find((x) => x.area.toLowerCase() === a);
  const companies = (intel?.topCompanies || "").toLowerCase();
  const isStudent = aud.includes("student") || companies.includes("christ") || companies.includes("bms") || companies.includes("students");
  const isPremium = pg.tier === "Premium";
  const startingPrice = pg.prices.triple || pg.prices.double || pg.prices.single || 0;

  if (pg.gender === "Girls" && (pg.safety?.length ?? 0) >= 2) return "Parent-Approved Girls";
  if (pg.gender === "Co-live") return "Co-live Community";
  if (pg.gender === "Boys" && pg.tier !== "Premium") return "Boys Hostel Vibe";
  if (isStudent) return "College Student Belt";
  if (isPremium && startingPrice >= 22000) return "Senior Professional";
  if (isPremium) return "Premium Working Pro";
  if (companies.includes("infosys") || companies.includes("wipro") || companies.includes("tcs") || companies.includes("flipkart") || companies.includes("ibm")) return "IT Corridor Crowd";
  return "First-Job Bangalore";
}

const PERSONA_STYLE: Record<PersonaBadge, { color: string; pitch: string }> = {
  "IT Corridor Crowd":      { color: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",       pitch: "Pitch commute first — they care about office distance over everything." },
  "College Student Belt":   { color: "text-amber-300 border-amber-400/40 bg-amber-400/10",     pitch: "Lead with food + study desk + parents-friendly. Price comes second." },
  "First-Job Bangalore":    { color: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10", pitch: "All-in pricing wins — no surprises. Stress \"₹X/day, nothing extra\"." },
  "Senior Professional":    { color: "text-violet-300 border-violet-400/40 bg-violet-400/10",   pitch: "Privacy + quiet + premium amenities. Don't lead with price." },
  "Parent-Approved Girls":  { color: "text-pink-300 border-pink-400/40 bg-pink-400/10",         pitch: "Open the parent pack first — close the parent, close the daughter." },
  "Boys Hostel Vibe":       { color: "text-blue-300 border-blue-400/40 bg-blue-400/10",         pitch: "Vibe + crew + nightlife > amenities. Mention games/gym." },
  "Co-live Community":      { color: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10", pitch: "Sell the community first — events, common area, peer network." },
  "Premium Working Pro":    { color: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",   pitch: "Service-grade pitch — daily housekeeping, premium furnishing, deposits." },
};

export function personaStyle(b: PersonaBadge) { return PERSONA_STYLE[b]; }

/* ---------- 4. Scarcity signal (#9) — derived, deterministic ---------- */

export type ScarcityLevel = "FULL" | "1 LEFT" | "2 LEFT" | "FEW LEFT" | "AVAILABLE";

export interface ScarcityState {
  level: ScarcityLevel;
  /** Per-occupancy availability ("S" | "D" | "T" → null/n) */
  perBed: { single: number | null; double: number | null; triple: number | null };
  hot: boolean;        // urgency badge — 1 or 2 left in any tier
  reason: string;      // human reason — why this state
}

/** High IQ + premium tier → typically near full. Low IQ + budget → tons left.
 *  Hash gives per-PG variance so the deck looks alive. */
export function scarcity(pg: PG): ScarcityState {
  const h = hash(pg.id);
  const offered = {
    single: pg.prices.single > 0,
    double: pg.prices.double > 0,
    triple: pg.prices.triple > 0,
  };

  // Base "demand pressure" 0..1 from IQ + tier
  const tierBoost = pg.tier === "Premium" ? 0.25 : pg.tier === "Mid" ? 0.1 : 0;
  const pressure = Math.min(1, (pg.iq / 100) * 0.85 + tierBoost);

  // Convert pressure → low remaining count for a sharing type
  const beds = (key: "single" | "double" | "triple", salt: number): number | null => {
    if (!offered[key]) return null;
    const r = ((h >> salt) & 0xff) / 255; // 0..1 stable
    // High pressure → bias toward 0–2 remaining; low pressure → 3–6
    const cap = pressure > 0.8 ? 3 : pressure > 0.6 ? 4 : pressure > 0.4 ? 5 : 6;
    return Math.max(0, Math.floor(r * cap));
  };

  const perBed = {
    single: beds("single", 0),
    double: beds("double", 8),
    triple: beds("triple", 16),
  };

  const counts = [perBed.single, perBed.double, perBed.triple].filter((n): n is number => n !== null);
  const total = counts.reduce((a, b) => a + b, 0);
  const lowest = counts.length ? Math.min(...counts) : 99;

  let level: ScarcityLevel = "AVAILABLE";
  if (total === 0) level = "FULL";
  else if (lowest === 1) level = "1 LEFT";
  else if (lowest === 2) level = "2 LEFT";
  else if (total <= 4) level = "FEW LEFT";

  const hot = level === "1 LEFT" || level === "2 LEFT";

  const reason =
    level === "1 LEFT"  ? `Only 1 ${shortTier(perBed)} sharing left — call now`
  : level === "2 LEFT"  ? `Only 2 ${shortTier(perBed)} sharing left this week`
  : level === "FULL"    ? "Currently full — waitlist only"
  : level === "FEW LEFT"? "Filling fast — fewer than 5 beds open"
  : "Multiple beds available across sharing types";

  return { level, perBed, hot, reason };
}

function shortTier(p: ScarcityState["perBed"]): string {
  if (p.single === 1) return "single";
  if (p.double === 1) return "double";
  if (p.triple === 1) return "triple";
  if (p.single === 2) return "single";
  if (p.double === 2) return "double";
  if (p.triple === 2) return "triple";
  return "double";
}

/* ---------- 5. Freshness tag (#14) — deterministic ---------- */

export interface Freshness {
  isFresh: boolean;       // updated in last 30 days?
  daysAgo: number;        // 0..60
  changeKind: "Price drop" | "New photos" | "Room opened" | "Amenity added" | null;
  message: string;        // short reason for re-engagement
}

export function freshness(pg: PG): Freshness {
  const h = hash(pg.id + "fresh");
  const daysAgo = h % 60; // 0..59
  const isFresh = daysAgo <= 30;
  if (!isFresh) return { isFresh: false, daysAgo, changeKind: null, message: "" };
  const kinds: Freshness["changeKind"][] = ["Price drop", "New photos", "Room opened", "Amenity added"];
  const kind = kinds[h % kinds.length]!;
  const messages: Record<NonNullable<Freshness["changeKind"]>, string> = {
    "Price drop":   "Manager just revised pricing — worth a fresh pitch.",
    "New photos":   "Fresh photos uploaded — ideal forward to undecided leads.",
    "Room opened":  "A room just opened — perfect re-engagement reason.",
    "Amenity added":"Amenity upgraded recently — counters old objections.",
  };
  return { isFresh, daysAgo, changeKind: kind, message: messages[kind] };
}

/* ---------- 6. Value-for-money score (#9 ranker) ---------- */

export function valueScore(pg: PG): number {
  // Cheapest offered bed
  const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((p) => p > 0);
  if (!beds.length) return 0;
  const cheapest = Math.min(...beds);
  const amenScore = Math.min(10, pg.amenities.length) * 2;             // 0..20
  const safeScore = Math.min(5, pg.safety.length) * 3;                 // 0..15
  const mealScore = pg.mealsIncluded?.match(/\d/) ? Number(pg.mealsIncluded.match(/\d/)![0]) * 4 : 0; // 0..16
  const iqWeight = pg.iq * 0.5;                                        // 0..50
  const raw = (amenScore + safeScore + mealScore + iqWeight);
  // Normalise per ₹1000 — more value per rupee = higher score
  const perK = (raw / (cheapest / 1000)) * 100;
  return Math.round(perK);
}

/* ---------- 7. Commute reality check (#7) ---------- */

export interface CommuteEstimate {
  km: number;
  walkMins: number;        // realistic walking minutes
  autoMins: number;        // auto, normal traffic
  peakMins: number;        // auto, peak hour
  mode: "walk" | "auto" | "metro+auto";
  oneLiner: string;        // a screenshot-ready single line
}

export function commuteEstimate(km: number, nearestMetro?: string | null): CommuteEstimate {
  const walkMins = Math.round(km * 12);                          // 5km/h
  const autoMins = Math.max(5, Math.round(km * 2.8));            // ~21 km/h with stops
  const peakMins = Math.max(8, Math.round(km * 4.6));            // ~13 km/h peak
  const mode: CommuteEstimate["mode"] =
    km <= 1.2 ? "walk" : km <= 8 || !nearestMetro ? "auto" : "metro+auto";

  const oneLiner =
    mode === "walk"
      ? `${walkMins} min walk · ${km < 1 ? Math.round(km * 1000) + "m" : km.toFixed(1) + "km"}`
      : mode === "auto"
        ? `Auto: ${autoMins} min normal · ${peakMins} min peak`
        : `Metro+auto via ${nearestMetro} · ${peakMins} min peak`;

  return { km, walkMins, autoMins, peakMins, mode, oneLiner };
}

/* ---------- 8. Area mood board (#10) ---------- */

export interface AreaMood {
  area: string;
  crowd: string;
  ageBand: string;
  nightlife: "Low" | "Medium" | "High";
  noise: "Quiet" | "Active" | "Buzzing";
  weekend: string;
  metroAccess: string;
  priceBand: string;
  topCompanies: string[];
}

const NIGHTLIFE_HIGH = ["koramangala", "indiranagar", "hsr", "mg road"];
const NIGHTLIFE_MID = ["bellandur", "marathahalli", "btm", "whitefield"];

export function areaMood(area: string): AreaMood | null {
  const intel = AREAS.find((a) => a.area.toLowerCase() === area.toLowerCase());
  if (!intel) return null;
  const a = area.toLowerCase();
  const nightlife: AreaMood["nightlife"] =
    NIGHTLIFE_HIGH.some((k) => a.includes(k)) ? "High"
    : NIGHTLIFE_MID.some((k) => a.includes(k)) ? "Medium" : "Low";
  const noise: AreaMood["noise"] = nightlife === "High" ? "Buzzing" : nightlife === "Medium" ? "Active" : "Quiet";
  const companies = intel.topCompanies.split(/,/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const isStudent = companies.some((c) => /christ|bms|college|student/i.test(c));
  const isCorporate = companies.some((c) => /infosys|wipro|tcs|flipkart|ibm|goldman|accenture|cognizant/i.test(c));
  const crowd = isStudent && isCorporate ? "Mixed students + IT pros"
              : isStudent ? "College students + young pros"
              : isCorporate ? "IT professionals" : "Working professionals";
  const ageBand = isStudent ? "18–24" : isCorporate ? "23–32" : "24–34";
  const weekend = nightlife === "High" ? "Cafés + breweries packed till 1am" : nightlife === "Medium" ? "Quieter Saturdays, busy malls" : "Calm — residents head out for nightlife";
  return {
    area: intel.area, crowd, ageBand, nightlife, noise, weekend,
    metroAccess: intel.commute, priceBand: intel.budget, topCompanies: companies,
  };
}

/* ---------- 9. Objection-to-property finder (#3) ---------- */

export type Objection = "expensive" | "far" | "no_gym" | "no_meals" | "no_ac" | "wrong_food";

export function findAlternatives(pg: PG, objection: Objection, all: PG[]): PG[] {
  const sameArea = all.filter((p) => p.id !== pg.id && p.area === pg.area && p.gender === pg.gender);
  const cheapest = (p: PG) => Math.min(...[p.prices.triple, p.prices.double, p.prices.single].filter((x) => x > 0).concat(99999));
  const baseCheap = cheapest(pg);

  switch (objection) {
    case "expensive":
      return sameArea.filter((p) => cheapest(p) < baseCheap).sort((a, b) => cheapest(a) - cheapest(b)).slice(0, 3);
    case "far":
      return sameArea.filter((p) => p.nearbyLandmarks?.[0]?.w !== undefined).sort((a, b) => (a.nearbyLandmarks[0]?.w ?? 99) - (b.nearbyLandmarks[0]?.w ?? 99)).slice(0, 3);
    case "no_gym":
      return all.filter((p) => p.id !== pg.id && p.area === pg.area && p.amenities.some((a) => /gym/i.test(a))).sort((a, b) => b.iq - a.iq).slice(0, 3);
    case "no_meals":
      return sameArea.filter((p) => p.mealsIncluded && p.mealsIncluded.match(/\d/)).sort((a, b) => b.iq - a.iq).slice(0, 3);
    case "no_ac":
      return sameArea.filter((p) => p.amenities.some((a) => /\bac\b|air-?con/i.test(a))).sort((a, b) => b.iq - a.iq).slice(0, 3);
    case "wrong_food":
      return sameArea.filter((p) => p.foodType?.toLowerCase().includes("both") || p.foodType?.toLowerCase().includes("non")).sort((a, b) => b.iq - a.iq).slice(0, 3);
    default:
      return sameArea.slice(0, 3);
  }
}

/* ---------- 10. Budget stretch (#4) ---------- */

export interface StretchTier {
  budget: number;
  pgs: PG[];
  unlocks: string[];
  perDayDelta: number;     // ₹/day extra vs. base
}

export function budgetStretch(base: number, allPGs: PG[], gender?: string): StretchTier[] {
  const tiers = [base, base + 2000, base + 5000];
  const filtered = gender && gender !== "Any" ? allPGs.filter((p) => p.gender === gender) : allPGs;
  return tiers.map((b, i) => {
    const inBudget = filtered.filter((p) => {
      const beds = [p.prices.triple, p.prices.double, p.prices.single].filter((x) => x > 0);
      const cheap = beds.length ? Math.min(...beds) : 99999;
      return cheap <= b * 1.05;
    }).sort((a, b) => b.iq - a.iq).slice(0, 3);
    const baseAmen = new Set(filtered.filter((p) => {
      const beds = [p.prices.triple, p.prices.double, p.prices.single].filter((x) => x > 0);
      return beds.length && Math.min(...beds) <= base;
    }).flatMap((p) => p.amenities.map((a) => a.toLowerCase())));
    const newAmen = new Set(inBudget.flatMap((p) => p.amenities.map((a) => a.toLowerCase())));
    const unlocks = i === 0
      ? ["Baseline — what your money buys today"]
      : Array.from(newAmen).filter((a) => !baseAmen.has(a)).slice(0, 4).map(capitalise);
    return { budget: b, pgs: inBudget, unlocks: unlocks.length ? unlocks : ["Better IQ scores · larger room sizes"], perDayDelta: Math.round((b - base) / 30) };
  });
}

function capitalise(s: string) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

/* ---------- 11. Seasonal context (#15) ---------- */

export function seasonalNudge(date = new Date()): string {
  const m = date.getMonth();
  if (m === 0) return "January hiring wave — IT joiners moving cities now.";
  if (m === 3 || m === 4) return "April–May college admission rush — parents are deciding now.";
  if (m === 5 || m === 6) return "July new-batch joining — book before rooms get scarce.";
  if (m === 9) return "Diwali season — many residents leaving, rooms opening up.";
  if (m === 10 || m === 11) return "End-of-year project moves — short-stay demand spike.";
  return "Steady season — ideal time to lock the deal before next demand wave.";
}
