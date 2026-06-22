// Google-grade landmark + property search.
// Tiered scoring: exact, prefix, word-boundary, contains, fuzzy (Levenshtein).

import { LANDMARKS } from "@/property-genius/data/landmarks";
import { PGS } from "@/property-genius/data/pgs";
import type { Landmark, PG } from "@/property-genius/data/types";

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Common Bangalore aliases — people search by what they say, not what's written.
const ALIASES: Record<string, string[]> = {
  kora: ["koramangala"],
  hsr: ["hsr layout", "hsr"],
  btm: ["btm layout", "btm"],
  ecity: ["electronic city", "e city"],
  manyata: ["manyata embassy business park", "manyata tech park"],
  manytha: ["manyata"],
  mtp: ["manyata tech park", "manyata"],
  itpl: ["international tech park", "itpb", "whitefield"],
  embassy: ["embassy tech village", "etv"],
  marathalli: ["marathahalli"],
  bellandur: ["bellandur", "kadubeesanahalli"],
  ypr: ["yeshwanthpur"],
  jp: ["jp nagar"],
  goldmna: ["goldman sachs"],
  goldman: ["goldman sachs"],
  flipkart: ["flipkart embassy tech village"],
  swiggy: ["swiggy koramangala"],
  razorpay: ["razorpay sjr"],
  myntra: ["myntra prestige tech park"],
  christ: ["christ university"],
  nexus: ["nexus mall"],
  forum: ["forum mall"],
  tonic: ["tonic koramangala"],
  hustle: ["hustle hub"],
  prestige: ["prestige tech park"],
  sony: ["sony signal"],
};

function expandQuery(q: string): string[] {
  const n = norm(q);
  const out = new Set<string>([n]);
  for (const tok of n.split(" ")) {
    const al = ALIASES[tok];
    if (al) al.forEach((a) => out.add(a));
  }
  return Array.from(out);
}

// Levenshtein for typo tolerance — capped to short strings for speed
function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Score one haystack vs one query token. 0 = no match, 1.0 = perfect.
function tokenScore(hay: string, q: string): number {
  if (!q) return 0;
  if (hay === q) return 1;
  if (hay.startsWith(q)) return 0.92;
  if (hay.includes(` ${q}`) || hay.endsWith(` ${q}`)) return 0.82;
  if (hay.includes(q)) return 0.7;
  // word-by-word overlap
  const hwords = hay.split(" ");
  for (const w of hwords) {
    if (w.startsWith(q)) return 0.6;
    if (q.length >= 4 && w.length >= 4) {
      const d = lev(w, q);
      if (d <= 1) return 0.55;
      if (d === 2 && q.length >= 6) return 0.4;
    }
  }
  return 0;
}

function fieldScore(hay: string, queries: string[]): number {
  const h = norm(hay);
  if (!h) return 0;
  let best = 0;
  for (const q of queries) {
    // multi-word query: average per-token, but also match the whole phrase
    const phrase = tokenScore(h, q);
    if (phrase > best) best = phrase;
    const toks = q.split(" ").filter((t) => t.length > 1);
    if (toks.length > 1) {
      let sum = 0;
      let any = 0;
      for (const t of toks) {
        const s = tokenScore(h, t);
        if (s > 0) any++;
        sum += s;
      }
      const avg = (sum / toks.length) * (any / toks.length);
      if (avg > best) best = avg;
    }
  }
  return best;
}

export interface LandmarkHit extends Landmark {
  score: number;
}

export function searchLandmarks(query: string, limit = 30): LandmarkHit[] {
  if (!query.trim()) return [];
  const queries = expandQuery(query);
  const hits: LandmarkHit[] = [];
  for (const lm of LANDMARKS) {
    const sName = fieldScore(lm.n, queries);
    const sArea = fieldScore(lm.a, queries) * 0.6;
    const sPin = fieldScore(lm.p, queries) * 0.9;
    const sNote = fieldScore(lm.x, queries) * 0.4;
    const sMetro = fieldScore(lm.m, queries) * 0.5;
    const score = Math.max(sName, sArea, sPin, sNote, sMetro);
    if (score > 0.35) hits.push({ ...lm, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export interface PGHit {
  pg: PG;
  score: number;
  matched: string[]; // why it matched
}

export function searchPGs(query: string, limit = 30): PGHit[] {
  if (!query.trim()) return PGS.map((pg) => ({ pg, score: 1, matched: [] }));
  const queries = expandQuery(query);
  const hits: PGHit[] = [];
  for (const pg of PGS) {
    const matched: string[] = [];
    let score = 0;
    const add = (label: string, val: string, weight: number) => {
      const s = fieldScore(val, queries) * weight;
      if (s > 0.3) {
        matched.push(`${label}: ${val.slice(0, 60)}`);
        score = Math.max(score, s);
      }
    };
    add("Name", pg.name, 1);
    add("Actual", pg.actualName, 0.9);
    add("Area", pg.area, 1);
    add("Locality", pg.locality, 0.85);
    add("Persona", pg.persona.archetype, 0.6);
    add("USP", pg.usp, 0.5);
    pg.landmarksInline.forEach((lm) => add("Landmark", lm, 0.95));
    pg.amenities.forEach((a) => add("Amenity", a, 0.5));
    if (queries.some((q) => pg.gender.toLowerCase().includes(q))) {
      score = Math.max(score, 0.8);
      matched.push(`Gender: ${pg.gender}`);
    }
    if (queries.some((q) => pg.tier.toLowerCase().includes(q))) {
      score = Math.max(score, 0.7);
      matched.push(`Tier: ${pg.tier}`);
    }
    if (score > 0.3) hits.push({ pg, score, matched: matched.slice(0, 4) });
  }
  hits.sort((a, b) => b.score - a.score || b.pg.iq - a.pg.iq);
  return hits.slice(0, limit);
}

// Find PGs near a landmark (by area name match — Bangalore people think in landmarks).
export function pgsNearLandmark(landmark: Landmark): PG[] {
  const lmArea = norm(landmark.a);
  const lmName = norm(landmark.n);
  const matches: { pg: PG; score: number }[] = [];
  for (const pg of PGS) {
    const pgArea = norm(pg.area);
    const pgLoc = norm(pg.locality);
    let score = 0;
    if (pgArea && (lmArea.includes(pgArea) || pgArea.includes(lmArea))) score += 1;
    if (pgLoc.includes(lmArea)) score += 0.7;
    if (pgLoc.includes(lmName.split(" ")[0])) score += 0.5;
    for (const il of pg.landmarksInline) {
      if (norm(il).includes(lmName.split(" ")[0])) score += 0.6;
    }
    if (score > 0) matches.push({ pg, score });
  }
  matches.sort((a, b) => b.score - a.score || b.pg.iq - a.pg.iq);
  return matches.map((m) => m.pg);
}
