// Lead parser test runner. Streams a CSV (or pasted samples) through
// `parseLead` + `splitLeads`, classifies each row as parsed/usable/failed,
// breaks down which fields were missed, and computes zone-detection accuracy.
//
// "Usable" = at least Phone OR Email captured (we can still take action).
// "Parsed" = Name + Phone + (Location || Budget) - production-ready row.
import { parseLead, detectZone } from "./parser";

/** Minimal RFC-4180 CSV parser (handles quoted fields with embedded newlines and "" escapes). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h.trim()] = r[i] ?? ""; });
    return o;
  });
}
import type { ParsedLeadDraft } from "./types";

export interface ParserTestRowResult {
  index: number;
  raw: string;
  parsed: ParsedLeadDraft | null;
  status: "parsed" | "usable" | "failed";
  missing: string[];
  reason?: string;
}

export interface ParserTestReport {
  total: number;
  parsed: number;       // production-ready
  usable: number;       // at least one channel
  failed: number;
  missing: { phone: number; location: number; budget: number; name: number; email: number };
  zoneAccuracy: number; // % of rows where detected zone matched location text
  zoneSample: number;   // rows where a zone could be evaluated
  rows: ParserTestRowResult[];
  durationMs: number;
}

const REQUIRED_FOR_PARSED = ["name", "phone"] as const;

function classify(p: ParsedLeadDraft | null): { status: ParserTestRowResult["status"]; missing: string[] } {
  if (!p) return { status: "failed", missing: ["name", "phone", "location", "budget"] };
  const missing: string[] = [];
  if (!p.name) missing.push("name");
  if (!p.phone) missing.push("phone");
  if (!p.email) missing.push("email");
  if (!p.location) missing.push("location");
  if (!p.budget) missing.push("budget");

  const hasReq = REQUIRED_FOR_PARSED.every((k) => (p[k] ?? "").toString().trim().length > 0);
  const hasContact = !!(p.phone || p.email);

  if (hasReq && (p.location || p.budget)) return { status: "parsed", missing };
  if (hasContact) return { status: "usable", missing };
  return { status: "failed", missing };
}

export function runParserSuite(rawSamples: string[]): ParserTestReport {
  const t0 = performance.now();
  const rows: ParserTestRowResult[] = [];
  const missing = { phone: 0, location: 0, budget: 0, name: 0, email: 0 };
  let parsed = 0, usable = 0, failed = 0;
  let zoneHits = 0, zoneSample = 0;

  rawSamples.forEach((raw, i) => {
    const p = parseLead(raw);
    const { status, missing: miss } = classify(p);
    if (status === "parsed") parsed++;
    else if (status === "usable") usable++;
    else failed++;
    miss.forEach((m) => { if (m in missing) (missing as Record<string, number>)[m]++; });

    if (p && p.location) {
      zoneSample++;
      const expected = detectZone(p.location);
      if (expected && expected === p.zone) zoneHits++;
      else if (!expected && !p.zone) zoneHits++;
    }

    rows.push({
      index: i,
      raw,
      parsed: p,
      status,
      missing: miss,
      reason: !p ? "Parser returned null (no name/phone/email signal)" : undefined,
    });
  });

  return {
    total: rawSamples.length,
    parsed, usable, failed,
    missing,
    zoneAccuracy: zoneSample === 0 ? 0 : Math.round((zoneHits / zoneSample) * 1000) / 10,
    zoneSample,
    rows,
    durationMs: Math.round(performance.now() - t0),
  };
}

/** Parse a CSV file (text) and pull each rawText cell to feed the suite. */
export function extractSamplesFromCsv(csvText: string): string[] {
  const rows = parseCsv(csvText);
  const out: string[] = [];
  for (const row of rows) {
    const candidate = row.rawText ?? row.raw ?? row.text ?? row.paste ?? "";
    if (candidate && candidate.trim().length > 4) out.push(candidate);
  }
  return out;
}

/** Built-in sample dataset for offline runs (subset of real captures). */
export const BUILTIN_SAMPLES: string[] = [
  `Name: Vemula Shanmukha Sai \\nPhone: 9398992589\\nEmail: saishanmukha390@gmail.com \\nPreferred location : Koramangala\\nBudget range: 8k - 12k\\nMove in date: tomorrow \\nWorking \\nShared room`,
  `Name: Riya\\r\\nPhone: 9111310344\\r\\nLocation: Near Christ University Central Campus Bangalore\\r\\nBudget: Within ₹20k\\r\\nMove in date: June first week\\r\\nStudent\\r\\nGirls pg preferable`,
  `📝 *Name:*  Keshav Kakkar\\r\\n📱 *Phone:*  8218844116\\r\\n✉️ *Email:*  kaka.kakkar3110@gmail.com\\r\\n📍 *Preferred Location:*  HustleHub Tech Park, HSR Layout\\r\\n💰 *Budget Range:* ₹8-16k monthly\\r\\n📆 *Move-in Date:*  Last week of April\\r\\nWorking \\r\\n🏢 Shared\\r\\n👫 NEED Boys`,
  `Abhineet\\r\\n8400411502\\r\\nabhineet738@gmail.com\\r\\nPreferred location: HSR Layout\\r\\nBudget: 13-16k\\r\\nMove in date: 1st May\\r\\nWorking professional\\r\\nRoom Type: Private\\r\\nNeed: Coed`,
  `Priya 9876543210 Indiranagar 12k May 5`,
  `not filled`,
  `Karthik\\n+91 824 869 6034\\nWhitefield\\nbudget 9000\\nimmediate`,
];
