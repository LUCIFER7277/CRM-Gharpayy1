// Mega lead parser - extracts directly into the cmd.lead.create payload shape.
// No "intermediate random data". Every extraction is grounded in the source text;
// missing fields are reported as validation issues, NOT hallucinated.
//
// API:
//   parseLeadText(raw) → { extracted, issues, confidence }
//
// `extracted` is shaped like CreateLeadCmd.payload (partial).
// `issues` is an array of { field, severity, message, suggestion? }.
// Use Zod (CreateLeadCmd) on top to get the canonical validation errors.

import {
  PHONE_PATTERNS, EMAIL_PATTERN, FIELD_LABELS,
  BHK_PATTERNS, BUDGET_PATTERNS, BUDGET_PLAIN_NUMBER,
  ALL_LOCALITIES, INTENT_WORDS, SOURCE_HINTS, MOVE_IN_HINTS,
  COMMON_NAMES,
} from "./lexicon";

export interface ParseIssue {
  field: "name" | "phone" | "email" | "budget" | "preferredArea" | "moveInDate" | "intent" | "source" | "bhk" | "general";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface ExtractedLead {
  name?: string;
  phone?: string;
  email?: string;
  budget?: number;
  preferredArea?: string;
  moveInDate?: string;          // ISO date YYYY-MM-DD
  intent?: "hot" | "warm" | "cold";
  source?: string;
  bhk?: string;                 // tag
  notes?: string;
}

export interface ParseResult {
  extracted: ExtractedLead;
  issues: ParseIssue[];
  confidence: number;           // 0-100 - proportion of required fields filled
  raw: string;
}

const REQUIRED_FIELDS: (keyof ExtractedLead)[] = ["name", "phone", "budget", "preferredArea", "moveInDate"];

function findFirstMatch(text: string, regexes: RegExp[]): string | null {
  for (const re of regexes) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // strip 91 country code if 12 digits
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function extractPhone(text: string, issues: ParseIssue[]): string | undefined {
  const raw = findFirstMatch(text, PHONE_PATTERNS);
  if (!raw) {
    issues.push({ field: "phone", severity: "error", message: "No phone number found", suggestion: "Add a 10-digit Indian mobile (e.g. 9876543210)" });
    return undefined;
  }
  const norm = normalizePhone(raw);
  if (norm.length !== 10 || !/^[6-9]/.test(norm)) {
    issues.push({ field: "phone", severity: "error", message: `Phone "${raw}" is not a valid 10-digit Indian mobile`, suggestion: "Check for typos" });
    return undefined;
  }
  return norm;
}

function extractEmail(text: string): string | undefined {
  EMAIL_PATTERN.lastIndex = 0;
  const m = EMAIL_PATTERN.exec(text);
  return m?.[0];
}

function extractByLabel(text: string, labels: readonly string[]): string | undefined {
  // Match "label : value" or "label - value" or "label = value" up to end of line
  for (const lbl of labels) {
    const re = new RegExp(`(?:^|\\n)\\s*${lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-=]\\s*([^\\n]+)`, "i");
    const m = re.exec(text);
    if (m) return m[1].trim().replace(/[.,;]+$/, "");
  }
  return undefined;
}

function cleanNameCandidate(s: string): string {
  return s
    .replace(/^(hi|hello|hey|fyi|new|lead|client|guest|tenant)[\s,!:]+/i, "")
    .replace(/[+\d][\d\s\-]{4,}/g, "")        // strip phone-like runs
    .replace(/[,;:!.\-–|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractName(text: string, phone: string | undefined, issues: ParseIssue[]): string | undefined {
  // 1. Try labelled
  let raw = extractByLabel(text, FIELD_LABELS.name);
  if (raw) {
    raw = raw.split(/\s+(?:phone|mob|mobile|whatsapp|wa|ph|contact|number|email|mail|budget|rent|bhk|location|area)\b/i)[0];
    raw = cleanNameCandidate(raw);
    if (raw.length >= 2 && raw.length <= 80) return titleCase(raw);
  }
  // 2. Try first line: take only the chunk BEFORE any verb/keyword that signals "intent text"
  const firstLine = text.split(/\n/)[0]?.trim() ?? "";
  const stopWords = /\b(?:looking|wants?|need|needs|interested|requires?|requirement|searching|search|near|in|for|budget|rent|bhk|studio|move|moving|shift|asap|urgent)\b/i;
  // Use part before phone if present, else before first stop-word, else first 4 words
  let candidate = "";
  if (phone && firstLine.includes(phone)) {
    candidate = firstLine.split(phone)[0];
  } else {
    const m = stopWords.exec(firstLine);
    candidate = m ? firstLine.slice(0, m.index) : firstLine.split(/\s+/).slice(0, 4).join(" ");
  }
  candidate = cleanNameCandidate(candidate);
  // Validate: must look like a name - alphabetic words only, 1-4 words
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 4 && words.every((w) => /^[a-zA-Z][a-zA-Z'.\-]*$/.test(w)) && candidate.length <= 60) {
    return titleCase(candidate);
  }
  // 3. Look for known first name anywhere
  const known = findKnownName(text);
  if (known) return known;

  issues.push({ field: "name", severity: "error", message: "Could not detect a name", suggestion: "Add a line like 'Name: Rahul Sharma'" });
  return undefined;
}

function findKnownName(text: string): string | undefined {
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i].replace(/[^a-zA-Z]/g, "");
    if (!word) continue;
    if (COMMON_NAMES.some((n) => n.toLowerCase() === word.toLowerCase())) {
      // Try to grab next token if also capitalised (likely surname)
      const next = (tokens[i + 1] ?? "").replace(/[^a-zA-Z]/g, "");
      if (next && /^[A-Z]/.test(next) && next.length > 1) return titleCase(`${word} ${next}`);
      return titleCase(word);
    }
  }
  return undefined;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function extractBudget(text: string, issues: ParseIssue[]): number | undefined {
  // 1. Labelled budget - pull the value chunk first
  const labelled = extractByLabel(text, FIELD_LABELS.budget);
  const candidates: string[] = [];
  if (labelled) candidates.push(labelled);
  candidates.push(text); // fallback

  for (const chunk of candidates) {
    for (const { re, mult, capture } of BUDGET_PATTERNS) {
      const m = re.exec(chunk);
      if (m) {
        const num = parseFloat(m[capture].replace(/,/g, ""));
        if (!isNaN(num) && num > 0) {
          const value = Math.round(num * mult);
          // Sanity: rent/budget for a single room/flat in India = 1k - 10L
          if (value >= 1000 && value <= 10_000_000) return value;
        }
      }
    }
  }

  // 2. Labelled but only a plain number → assume monthly rupees
  if (labelled) {
    const m = BUDGET_PLAIN_NUMBER.exec(labelled);
    BUDGET_PLAIN_NUMBER.lastIndex = 0;
    if (m) {
      const v = parseInt(m[1].replace(/,/g, ""), 10);
      if (v >= 1000 && v <= 10_000_000) return v;
    }
  }

  issues.push({ field: "budget", severity: "error", message: "Could not detect budget", suggestion: "Add 'Budget: 25k' or 'Rent: 1.2L'" });
  return undefined;
}

function extractArea(text: string, issues: ParseIssue[]): string | undefined {
  // 1. Labelled
  const labelled = extractByLabel(text, FIELD_LABELS.area);
  if (labelled) {
    const matched = ALL_LOCALITIES.find((loc) => labelled.toLowerCase().includes(loc.toLowerCase()));
    if (matched) return matched;
    if (labelled.length >= 3 && labelled.length <= 80) return labelled;
  }
  // 2. Substring scan
  const lower = text.toLowerCase();
  // Prefer longer locality names first
  const sorted = [...ALL_LOCALITIES].sort((a, b) => b.length - a.length);
  for (const loc of sorted) {
    if (lower.includes(loc.toLowerCase())) return loc;
  }
  issues.push({ field: "preferredArea", severity: "error", message: "Could not detect locality / area", suggestion: "Add a known area like 'Koramangala' or 'HSR Layout'" });
  return undefined;
}

function extractBhk(text: string): string | undefined {
  for (const { re, bhk } of BHK_PATTERNS) {
    const m = re.exec(text);
    if (m) return bhk.replace("$1", m[1] ?? "");
  }
  return undefined;
}

function extractMoveIn(text: string, issues: ParseIssue[]): string | undefined {
  // 1. Labelled - try ISO / dd/mm/yyyy / "next week" inside
  const labelled = extractByLabel(text, FIELD_LABELS.moveIn);
  const candidates = labelled ? [labelled, text] : [text];
  for (const chunk of candidates) {
    // ISO yyyy-mm-dd
    const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(chunk);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    // dd/mm/yyyy or dd-mm-yyyy
    const dmy = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/.exec(chunk);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    // "1st jan 2026" / "1 Jan 26"
    const month = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(20\d{2}|\d{2})?\b/i.exec(chunk);
    if (month) {
      const map: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
      let yr = month[3] ?? new Date().getFullYear().toString();
      if (yr.length === 2) yr = "20" + yr;
      return `${yr}-${map[month[2].toLowerCase()]}-${month[1].padStart(2, "0")}`;
    }
    // Relative: "next week", "in 5 days"
    for (const { re, daysFromNow } of MOVE_IN_HINTS) {
      const m = re.exec(chunk);
      if (m) {
        let days: number;
        if (daysFromNow === "parse") {
          const n = parseInt(m[1] ?? "0", 10);
          days = /weeks?/i.test(m[0]) ? n * 7 : /months?/i.test(m[0]) ? n * 30 : n;
        } else {
          days = daysFromNow;
        }
        const d = new Date(); d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      }
    }
  }
  issues.push({ field: "moveInDate", severity: "warning", message: "No move-in date - defaulting to today", suggestion: "Add 'Move in: next week' or '01 Jan 2026'" });
  return new Date().toISOString().slice(0, 10);
}

function extractIntent(text: string): "hot" | "warm" | "cold" | undefined {
  const lower = text.toLowerCase();
  for (const k of ["hot", "warm", "cold"] as const) {
    if (INTENT_WORDS[k].some((w) => lower.includes(w.toLowerCase()))) return k;
  }
  return undefined;
}

function extractSource(text: string): string | undefined {
  for (const { re, source } of SOURCE_HINTS) if (re.test(text)) return source;
  return undefined;
}

export function parseLeadText(raw: string): ParseResult {
  const issues: ParseIssue[] = [];
  const text = (raw ?? "").trim();

  if (!text) {
    return {
      extracted: {},
      issues: [{ field: "general", severity: "error", message: "Empty input - paste the lead text first" }],
      confidence: 0,
      raw,
    };
  }

  const phone = extractPhone(text, issues);
  const email = extractEmail(text);
  const name = extractName(text, phone, issues);
  const budget = extractBudget(text, issues);
  const preferredArea = extractArea(text, issues);
  const moveInDate = extractMoveIn(text, issues);
  const intent = extractIntent(text);
  const source = extractSource(text) ?? "paste";
  const bhk = extractBhk(text);

  const extracted: ExtractedLead = {
    name, phone, email, budget, preferredArea, moveInDate, intent, source, bhk,
    notes: text.length > 200 ? text.slice(0, 1000) : undefined,
  };

  const filled = REQUIRED_FIELDS.filter((k) => extracted[k] !== undefined && extracted[k] !== "").length;
  const confidence = Math.round((filled / REQUIRED_FIELDS.length) * 100);

  return { extracted, issues, confidence, raw };
}
