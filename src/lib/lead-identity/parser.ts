// Paste-to-Lead parser. Handles WhatsApp forms, plain text, spreadsheet rows,
// emoji-heavy formats, AND unlabeled "casual" formats (name on line 1, bare
// phone/email/location/budget/move-in stacked vertically).
//
// IMPORTANT: Pre-normalises literal escape sequences (\r\n / \n / \r as text,
// not real newlines) that arrive when content is round-tripped through CSV
// exports, JSON dumps, or certain copy-paste paths. Also cuts each labeled
// field at the *next* label keyword (Phone:, Budget:, Move in:, etc.) so
// fields don't bleed into each other when pastes arrive on one physical line.
//
// IMPROVEMENTS from old CRM parser:
// - Support key-value format detection (Name: X, Phone: Y, etc.)
// - Support Indic scripts (Hindi/Devanagari names)
// - WhatsApp forward header cleanup
// - Confidence scores for each field
// - Better name extraction with multiple fallbacks
// - Inline name+phone pattern detection
import type { ParsedLeadDraft } from "./types";
import { LANDMARKS } from "@/supply-hub/data/landmarks";

interface ZoneDef {
  zone: string;
  priority: number;
  keywords: string[];
}

const ZONES: ZoneDef[] = [
  {
    zone: "South", priority: 1,
    keywords: [
      "koramangala","kormangala","kormagalam","kormanagala","korma","btm layout","btm","jayanagar","jaynagar","jp nagar","jpnagar",
      "hsr layout","hsr","banashankari","basavanagudi","lalbagh","south end","southend",
      "electronic city","neeladri","begur","bommanahalli","hulimavu",
      "sg palya","silk board","silkboard","agara","madiwala","tavarekere",
      "christ university","bannerghatta","kanakapura","kalena agrahara",
      "hosur road","forum mall","vv puram","jayadev hospital",
      "jayanagar 9th","btm 2nd stage","btm stage 2","koramangala 3rd",
      "koramangala 4th","koramangala 5th","koramangala 6th",
      "umiya emporium","nexus mall",
    ],
  },
  {
    zone: "East", priority: 2,
    keywords: [
      "whitefield","white field","hopefarm","itpl","kundanahalli","kundalahalli","kadugodi",
      "brookfield","hoodi","garudacharpalya","varthur","nallurhalli","kr puram","seetharampalya","seetharam palya",
      "bellandur","sarjapur","ecospace","embassy tech village","prestige tech park","prestige technopark","yemalur",
      "indiranagar","indranagar","indira nagar","domlur","ejipura","murgeshpalya",
      "cv raman nagar","new thippasandra","old airport road","airport road","hal",
      "marathahalli","marathalli","mahadevapura","mahadevpura","bagmane","brigade tech",
      "kadubeesanahalli","kadubeesana","spice garden","phoenix market city","brigade metropolis",
      "rmz infinity","prestige shantiniketan","whitefield metro","aecs layout","aecs",
      "rmz","ecoworld","ecoworld park","rmz ecoworld",
    ],
  },
  {
    zone: "North", priority: 3,
    keywords: [
      "yelahanka","hebbal","manyata tech","manyata","manyatha","nagawara","thanisandra",
      "jakkur","banaswadi","kalyan nagar","rt nagar","sahakara nagar","devanahalli",
      "vidyaranyapura","jalahalli","bhartiya","embassy boulevard",
      "nagasandra","hennur","peenya","yeshwanthpur","ypr",
    ],
  },
  {
    zone: "West", priority: 4,
    keywords: [
      "rajajinagar","vijaynagar","vijaya nagar","yeswanthpur",
      "nagarbhavi","chord road","mahalakshmi layout","malleshwaram","tumkur road",
      "sanjayanagara","chandra layout",
    ],
  },
  {
    zone: "Central", priority: 5,
    keywords: [
      "mg road","brigade road","richmond road","richmond circle","shanthinagar",
      "ashok nagar","vittal mallya","jayamahal","majestic",
      "gandhi nagar","frazer town","cubbon park","ub city","vasanth nagar",
      "trinity circle","halasuru","church street","lavelle road",
      "residency road","museum road","adugodi","wilson garden","cunningham",
    ],
  },
];

export function detectZone(rawText: string, dynamicZones?: import("@/lib/api/client").Zone[]): string {
  if (!rawText) return "";
  const t = rawText.toLowerCase();

  // Try dynamic zones first if provided
  if (dynamicZones && dynamicZones.length > 0) {
    for (const z of dynamicZones) {
      if (z.areas?.some((kw) => kw && t.includes(kw.toLowerCase()))) return z.name;
    }
  }

  for (const z of [...ZONES].sort((a, b) => a.priority - b.priority)) {
    if (z.keywords.some((kw) => t.includes(kw))) return z.zone;
  }
  return "";
}

// Center of Bangalore (approx Vidhana Soudha)
const BLR_CENTER_LAT = 12.9716;
const BLR_CENTER_LNG = 77.5946;

// Function to dynamically calculate geographic direction from coordinates
export function detectDirection(rawText: string): string {
  if (!rawText) return "";
  const t = rawText.toLowerCase();

  // Find the first landmark that matches the search text
  const match = LANDMARKS.find((lm) => {
    return lm.n.toLowerCase().includes(t) || 
           lm.a.toLowerCase().includes(t) || 
           (lm.x && lm.x.toLowerCase().includes(t));
  });

  if (!match || typeof match.lat !== 'number' || typeof match.lng !== 'number') {
    // If no match found via landmarks, fallback to our regex fallback list
    for (const z of [...ZONES].sort((a, b) => a.priority - b.priority)) {
      if (z.keywords.some((kw) => t.includes(kw))) return z.zone;
    }
    return "";
  }

  // Calculate direction relative to center
  const dLat = match.lat - BLR_CENTER_LAT;
  const dLng = match.lng - BLR_CENTER_LNG;

  // If very close to center (approx < 2.5km), call it Central
  // 1 deg lat is approx 111km. 2.5km is ~0.022 degrees
  if (Math.abs(dLat) < 0.022 && Math.abs(dLng) < 0.022) {
    return "Central";
  }

  // Calculate angle
  // angle 0 is East, PI/2 is North, PI is West, -PI/2 is South
  const angle = Math.atan2(dLat, dLng);

  // Convert angle to degrees (0 to 360)
  let deg = angle * (180 / Math.PI);
  if (deg < 0) deg += 360;

  // 4 main directions
  // East: 315 to 45
  // North: 45 to 135
  // West: 135 to 225
  // South: 225 to 315

  if (deg >= 315 || deg < 45) return "East";
  if (deg >= 45 && deg < 135) return "North";
  if (deg >= 135 && deg < 225) return "West";
  if (deg >= 225 && deg < 315) return "South";

  return "";
}

const EMOJI_RE = /[📝📱✉️📍💰📆📅👨🏢👫✨💥💯⚡🔥💛😘🏠🎯👥📞👤💼🛏️🥵✅❌⭐]/g;

const NULL_WORD_RE = /\b(?:name|form|full|thank\s*you|thanks|gharpayy|gharpayy\.com|your\s+superstay\s+awaits|best\s+pg\s+in\s+10\s+minutes|18\s*sec|aayushi\s+from\s+gharpayy|not\s+filled)\b/gi;
const LINK_RE = /(?:https?:\/\/|www\.)\S+|\b(?:maps\.app\.goo\.gl|goo\.gl|bit\.ly)\/\S+/gi;

// WhatsApp forwarded message header pattern: "[1:04 PM, 26/6/2025]" or "[1:05 PM, 26/6/2025]"
const WA_FORWARD_RE = /^\[?\d{1,2}[/:]\d{2}\s*(?:AM|PM|am|pm)?,?\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\]?\s*[-–-]?\s*/gm;

// Key-value pattern for structured form submissions like "Name: Value"
// Allow 'Name:' to appear anywhere on a physical line (not only at line start)
const KV_NAME_RE = /Name\s*[:=\-–]+\s*([^\n]+)/im;
const KV_PHONE_RE = /(?:^|\n)\s*(?:Phone|Mobile|Ph|Contact|Number|Mob)\s*[:=\-–]+\s*(.+?)(?=\n|Email|Name|Budget|Location|$)/im;
const KV_EMAIL_RE = /(?:^|\n)\s*(?:Email|E-?mail|Mail)\s*[:=\-–]+\s*(.+?)(?=\n|Phone|Budget|Location|$)/im;
const KV_BUDGET_RE = /(?:^|\n)\s*(?:Budget|Price|Actual\s+budget)\s*[:=\-–(]+\s*(.+?)(?=\n|Location|Room|Move|$)/im;
const KV_LOCATION_RE = /(?:^|\n)\s*(?:Location|Preferred\s+Location|Area|Landmark)\s*[:=\-–]+\s*(.+?)(?=\n|Budget|Move|Room|$)/im;

// Hindi/Devanagari script name detection
const INDIC_NAME_RE = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]+(?:\s+[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]+)*/;

const LOCATION_HINTS = [
  ...ZONES.flatMap((z) => z.keywords),
  "near","opposite","mall","road","layout","circle","stage","cross","main",
  "metro","station","colony","nagar","palya","puram","halli","village",
];

const NON_NAME_TOKENS = /\b(name|phone|mobile|email|location|area|budget|move|moving|room|need|special|request|profession|working|student|intern|girls?|boys?|coed|private|shared|sharing|single|double|triple|ac|veg|gym|preferred|in\s*blr|out\s*of)\b/i;

// All known label keywords used to *terminate* a previous field's value when
// a paste arrives on one physical line (no real newlines).
const LABEL_TERMINATORS =
  "(?:Name|Phone|Mobile|Ph|Contact|Email|E-mail|Mail|" +
  "Preferred\\s*Location|Location|Area|Landmark|Map\\s*link|" +
  "Budget(?:\\s*Range)?|Budjet|Actual\\s*budget|" +
  "Move[-\\s]?in(?:[-\\s]?Date)?|Moving(?:\\s*Date)?|Movein|" +
  "Profession|Occupation|Working|Student|Intern|" +
  "Room(?:\\s*Type)?|Sharing|" +
  "Need|NEED|Cohort|" +
  "Special\\s*Requests?|Special\\s*Request|Notes?|Remarks?|" +
  "How\\s*Many\\s*Members|Members?)";

const LABEL_TERMINATOR_LOOKAHEAD = new RegExp(`\\s+${LABEL_TERMINATORS}\\s*[:\\-–]`, "i");

/** Cut a captured field value at the start of the next label keyword. */
function cutAtNextLabel(value: string): string {
  if (!value) return value;
  const m = value.match(LABEL_TERMINATOR_LOOKAHEAD);
  if (m && m.index !== undefined) return value.slice(0, m.index);
  return value;
}

/** Pre-normalise raw paste: convert literal escape sequences and CRLF to \n. */
function normalisePaste(raw: string): string {
  return raw
    // First handle literal \r\n / \n / \r escape sequences (4-char strings)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    // Then real CRLF
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function looksLikeName(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2 || t.length > 50) return false;
  if (/\d/.test(t)) return false;
  if (/@/.test(t)) return false;
  if (NON_NAME_TOKENS.test(t)) return false;
  if (LOCATION_HINTS.some((k) => t.toLowerCase().includes(k))) return false;
  const words = t.replace(/[^a-zA-Z\s.]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  return /^[A-Z]/.test(words[0]) || /^[a-z]/.test(words[0]);
}

function looksLikeLocation(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (!t || t.length > 120) return false;
  if (/\d{5,}/.test(t)) return false;
  if (/@/.test(t)) return false;
  return LOCATION_HINTS.some((k) => t.includes(k));
}

function looksLikeBudget(line: string): boolean {
  const t = line.trim().toLowerCase().replace(/[₹,\s]/g, "");
  return /^\d{3,6}$/.test(t) ||
    /^\d+(?:\.\d+)?k$/i.test(t) ||
    /^\d+[-–to]+\d+k?$/i.test(t) ||
    /^\d+k?[-–to/]+\d+k?$/i.test(t);
}

function looksLikeDate(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (t.length > 40) return false;
  return /^(immediate|asap|now|today|tomorrow)/i.test(t) ||
    /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(t) ||
    /\d{1,2}(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t) ||
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(t) ||
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(t);
}

function normalizeRoom(text: string): string {
  const t = text.toLowerCase();
  const hasPrivate = /\b(private|single|1\s*sharing|1bhk|studio)\b/.test(t);
  const hasShared = /\b(shared|sharing|double|2\s*sharing|triple|3\s*sharing|twin)\b/.test(t);
  if (hasPrivate && hasShared) return "Both";
  if (hasPrivate) return "Private";
  if (hasShared) return "Shared";
  return "";
}

function extractLinks(text: string): string[] {
  return [...new Set((text.match(LINK_RE) ?? []).map((u) => u.replace(/[),.;]+$/g, "")))];
}

function extractBudgets(text: string): string[] {
  const withoutPhones = text.replace(/(?:\+?\s*91[-\s]?)?(?:\d[-\s]?){9,12}\d/g, "");
  const regex = /(?:under\s*)?₹?\s*\d{1,2}(?:\.\d+)?\s*(?:k|K|000)\s*(?:[-–to\/]+\s*₹?\s*\d{1,2}(?:\.\d+)?\s*(?:k|K|000)?)?|\b(?:under\s*)?₹?\s*\d{1,2}(?:\.\d+)?\s*(?:[-–to\/]+\s*₹?\s*\d{1,2}(?:\.\d+)?\s*(?:k|K|000))|\b\d{4,6}\s*(?:to|-|–)\s*\d{4,6}\b|₹\s*\d{4,6}\b/gi;
  const matches = withoutPhones.match(regex) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[₹,()]/g, "").replace(/\s+/g, " ").trim()).filter((m) => /\d/.test(m)))].slice(0, 6);
}

function cleanJunk(text: string): string {
  return text.replace(NULL_WORD_RE, " ").replace(/[*_`⚡🔥💛🥵]/g, " ").replace(/\s+/g, " ").trim();
}

/** Title-case a name string, preserving common patronymic letters. */
function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Parse human-readable date strings to ISO format (YYYY-MM-DD).
 * Handles: "7th May", "May 7", "07/05", "immediate", "today", etc.
 */
function parseHumanDate(dateStr: string): string {
  if (!dateStr) return "";
  const t = dateStr.trim().toLowerCase();

  const now = new Date();
  const currentYear = now.getFullYear();

  const pad2 = (n: number): string => String(n).padStart(2, "0");
  const localIso = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const isBeforeToday = (d: Date): boolean => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return candidate < today;
  };
  const ymd = (year: number, month: number, day: number, rollForwardPastDate = false): string => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    const check = new Date(year, month - 1, day);
    if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return "";
    if (rollForwardPastDate && isBeforeToday(check)) {
      return ymd(year + 1, month, day, false);
    }
    return `${year}-${pad2(month)}-${pad2(day)}`;
  };
  
  // Immediate-like dates
  if (/^(immediate|asap|now)$/i.test(t)) return localIso(now);
  if (/^today$/i.test(t)) return localIso(now);
  if (/^tomorrow$/i.test(t)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localIso(d);
  }
  
  // Month names map
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  
  // Pattern: "7th May", "7 May", "7march", "May 7", or "May 7th"
  let match = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const monthNum = months[monthStr.slice(0, 3)];
    if (monthNum) {
      return ymd(currentYear, monthNum, day, true);
    }
  }
  
  // Pattern: "May 7" or "May 7th"
  match = t.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (match) {
    const monthStr = match[1].toLowerCase();
    const monthNum = months[monthStr.slice(0, 3)];
    const day = parseInt(match[2], 10);
    if (monthNum) {
      return ymd(currentYear, monthNum, day, true);
    }
  }
  
  // Pattern: "07/05" or "07-05" or "07.05" (assume DD/MM)
  match = t.match(/^(\d{1,2})[\/\-.]+(\d{1,2})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    return ymd(currentYear, month, day, true);
  }
  
  // Pattern: "07/05/2026" or "07-05-2026"
  match = t.match(/^(\d{1,2})[\/\-.]+(\d{1,2})[\/\-.]+(\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return ymd(year, month, day);
  }
  
  // Fuzzy / relative dates
  let matchedMonth = 0;
  for (const [mName, mNum] of Object.entries(months)) {
    if (new RegExp("\\b" + mName).test(t)) {
      matchedMonth = mNum;
      break;
    }
  }

  if (matchedMonth > 0) {
    if (/end|last week/i.test(t)) return ymd(currentYear, matchedMonth, 28, true);
    if (/mid|2nd week|second week/i.test(t)) return ymd(currentYear, matchedMonth, 15, true);
    if (/3rd week|third week/i.test(t)) return ymd(currentYear, matchedMonth, 22, true);
    if (/1st week|first week|start|beginning/i.test(t)) return ymd(currentYear, matchedMonth, 5, true);
    
    // If just a month is mentioned without a specific date or fuzzy modifier, default to the 1st of that month
    if (!/\d/.test(t)) return ymd(currentYear, matchedMonth, 1, true);
  }

  if (/next\s*week/i.test(t)) {
    const d = new Date(); d.setDate(d.getDate() + 7); return localIso(d);
  }
  if (/next\s*month/i.test(t)) {
    const d = new Date(); d.setDate(d.getDate() + 30); return localIso(d);
  }
  if (/in\s*\d+\s*days?/i.test(t)) {
    const m = t.match(/in\s*(\d+)\s*days?/i);
    if (m) {
      const d = new Date(); d.setDate(d.getDate() + parseInt(m[1], 10)); return localIso(d);
    }
  }

  // If it doesn't match any pattern, return empty (will fall back to today in UI)
  return "";
}

export function parseLead(raw: string, dynamicZones?: import("@/lib/api/client").Zone[]): ParsedLeadDraft | null {
  if (!raw || raw.trim().length < 4) return null;

  // Step 0: Pre-process - clean WhatsApp forward headers and normalise escape sequences
  let normalised = normalisePaste(raw);
  normalised = normalised.replace(WA_FORWARD_RE, ''); // Remove "[HH:MM AM/PM, DD/MM/YYYY]" patterns
  
  const links = extractLinks(normalised);
  const clean = normalised
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  const grab = (...patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = clean.match(re);
      if (m?.[1]) {
        let v = m[1].replace(EMOJI_RE, "").trim();
        v = cutAtNextLabel(v);
        return v.replace(/^[\s,;:|.\-–-]+|[\s,;:|.\-–-]+$/g, "").trim();
      }
    }
    return "";
  };

  // ---------- Phone ----------
  // Accept tightly packed (9876543210), with country code, hyphens, spaces,
  // or split into 3+3+4 / 4+3+3 groups. We strip non-digits then re-validate.
  let phone = "";
  const digitOnly = clean.replace(/[^\d]/g, "");
  // Find a 10-digit Indian mobile inside the digit-only stream (optionally
  // prefixed by 91), but only if it appears as a recognisable run in the raw.
  const tightMatch = clean.match(/(?:\+?\s*91[-\s]?)?(?:\d[-\s]?){9,12}\d/);
  if (tightMatch) {
    const candidate = tightMatch[0].replace(/[^\d]/g, "");
    const trimmed = candidate.replace(/^91/, "");
    const m = trimmed.match(/[6-9]\d{9}/);
    if (m) phone = m[0];
  }
  if (!phone) {
    const m = digitOnly.match(/[6-9]\d{9}/);
    if (m) phone = m[0];
  }

  // ---------- Email ----------
  const emailMatch = clean.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] ?? "";

  // ---------- Name ----------
  // Multi-tier fallback: key-value → emoji-labeled → inline → Indic script → capitalized words
  let name = "";
  let nameConfidence = 0;

  // Tier 1: Key-value format like "Name: Xxx" (common in form submissions)
  const kvNameMatch = clean.match(KV_NAME_RE);
  if (kvNameMatch) {
    name = kvNameMatch[1]
      .trim()
      .split(/\s+(?:Phone|Mobile|Email|Location|Budget|Move|Moving|Working|Student|Room|Need)\b/i)[0]
      .replace(/[\d@].*$/, "")
      .replace(/^\W+|\W+$/g, "")
      .trim();
    if (name && name.length >= 2) {
      nameConfidence = 0.95;
    }
  }

  // Tier 2: Try existing emoji-labeled or inline 'Name' patterns anywhere on the line
  if (!name) {
    name = grab(
      /\bName\s*[:\-–*]+\s*([^\n,📱\d]{2,120})/im,
      /\.Name\s+([^\n.]{2,120})/im,
      /[-–]\s*([A-Z][a-z][^\n\d]{1,60})/m,
    );
    if (name) {
      name = name
        .split(/\s+(?:Phone|Mobile|Email|Location|Budget|Move|Moving|Working|Student|Room|Need)\b/i)[0]
        .replace(/[\d@].*$/, "")
        .replace(/^\W+|\W+$/g, "")
        .trim();
      if (name) nameConfidence = 0.85;
    }
  }

  // Tier 3: Try Indic script (Hindi/Devanagari names) - very high confidence if found
  if (!name) {
    const indicMatch = clean.match(INDIC_NAME_RE);
    if (indicMatch && indicMatch[0].length >= 3) {
      name = indicMatch[0].trim();
      nameConfidence = 0.8;
    }
  }

  // Tier 4: Inline pattern like "Name 9876543210" or "Name email@mail.com"
  if (!name) {
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      const stripped = line.replace(EMOJI_RE, "").replace(/^[-–*•]\s*/, "").trim();
      
      // Try: "Name 9876543210" or "Name email@domain.com"
      const inlineMatch = stripped.match(/^([A-Za-z][A-Za-z\s.]{1,40}?)\s+(?:\+?91)?[6-9]\d{9}/);
      if (inlineMatch) {
        name = inlineMatch[1].trim();
        nameConfidence = 0.75;
        break;
      }
    }
  }

  // Tier 5: Capitalized words in first few lines
  if (!name) {
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 3)) {
      const stripped = line.replace(EMOJI_RE, "").replace(/^[-–*•]\s*/, "").trim();
      if (looksLikeName(stripped)) {
        name = stripped;
        nameConfidence = 0.65;
        break;
      }
    }
  }

  // Tier 6: Extract leading capitalized Latin words from cleaned remaining text
  if (!name) {
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
    const nameWords: string[] = [];
    for (const word of (lines[0] || "").split(/\s+/).filter(Boolean)) {
      if (/^[A-Z][a-zA-Z']*$/.test(word) && nameWords.length < 3) {
        nameWords.push(word);
      } else if (nameWords.length > 0 || !/^[A-Za-z]{2,}$/.test(word)) {
        break;
      }
    }
    if (nameWords.length > 0) {
      name = nameWords.join(" ");
      nameConfidence = nameWords.every(w => /^[A-Z]/.test(w)) ? 0.7 : 0.5;
    }
  }

  // Clean up and title case
  if (name) {
    name = titleCase(name);
  }

  // ---------- Location ----------
  let location = grab(
    /Preferred\s*Location[^:\n]*[:\-–]+\s*([^\n💰📆👨🏢]{3,200})/i,
    /Which\s+location\s*[:\-–]+\s*([^\n]{3,200})/i,
    /Location\s*[:\-–]+\s*([^\n💰📆👨🏢]{3,200})/i,
    /Area\s*[:\-–]+\s*([^\n]{3,200})/i,
    /Landmark[^:\n]*[:\-–]+\s*([^\n]{3,200})/i,
  );
  // Strip embedded map links
  location = location.replace(/\(Map\s*link\)|https?:\/\/\S+/gi, "").trim();

  if (!location) {
    for (const line of clean.split("\n").map((l) => l.trim())) {
      if (looksLikeLocation(line) && !looksLikeBudget(line)) {
        location = line.replace(EMOJI_RE, "").trim();
        break;
      }
    }
  }

  // ---------- Budget ----------
  const budgets = extractBudgets(clean);
  let budget = grab(
    /(?:Actual\s*budget|Budget\s*Range|Budget\s*range|Budget\s*is|Budget|Budjet)\s*[:\-–(]*\s*([^\n)📆👨🏢]{2,80})/i,
  ).replace(/[₹()\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!budget && budgets.length) budget = budgets.join(", ");

  if (!budget) {
    for (const line of clean.split("\n").map((l) => l.trim())) {
      if (looksLikeBudget(line)) { budget = line.replace(/[₹]/g, "").trim(); break; }
    }
  }

  // ---------- Move-in ----------
  let moveIn = grab(
    /Move[-\s]?in[-\s]?Date\s*[:\-–😘*]+\s*([^\n👨🏢👫✨]{2,80})/i,
    /Moving\s*Date\s*[:\-–]+\s*([^\n]{2,60})/i,
    /Move[-\s]?in\s*[:\-–]+\s*([^\n]{2,60})/i,
    /Movein\s*[:\-–]+\s*([^\n]{2,60})/i,
  );

  if (!moveIn) {
    for (const line of clean.split("\n").map((l) => l.trim())) {
      if (looksLikeDate(line) && !looksLikeBudget(line)) { moveIn = line; break; }
    }
  }

  // ---------- Type ----------
  // Check both the normalised raw text and the cleaned version for occupation hints,
  // and handle parenthetical or hyphenated styles like "(Student/Working) - Working".
  const combinedText = `${normalised} \n ${clean}`;
  const isWorking = /\b(?:working|professional|analyst|marketer|engineer|developer|employee)\b/i.test(combinedText);
  const isStudent = /\bstudent\b/i.test(combinedText);
  const isIntern = /\bintern(?:ing)?\b/i.test(combinedText);
  // explicit parenthetical patterns
  const parentheticalWorking = /\(\s*student\s*\/\s*working\s*\)|student\s*\/\s*working/i.test(combinedText);
  const hyphenWorking = /[-–]\s*working\b/i.test(combinedText);
  // Prefer mapping combined Student/Working to 'Working' which matches QuickAdd options
  const type = (isWorking || parentheticalWorking || hyphenWorking) && isStudent ? "Working"
    : (isWorking || parentheticalWorking || hyphenWorking) ? "Working"
    : isStudent ? "Student"
    : isIntern ? "Intern" : "";

  // ---------- Room ----------
  const roomLabeled = grab(/Room(?:\s*Type)?\s*[*:\-–(]+\s*([^\n👫✨📞]{2,60})/i);
  const room = normalizeRoom(roomLabeled || clean);

  // ---------- Need ----------
  const needRaw = grab(
    /NEED\s*[*:\-–(]+\s*([^\n✨📞]{2,60})/i,
    /Need\s*[:\-–]+\s*([^\n]{2,60})/i,
    /Cohort\s*[:\-–]+\s*([^\n]{2,60})/i,
  ).toLowerCase();
  const wantGirls = needRaw.includes("girl") || /\bgirls?\s*(?:pg|preferable|only)?/i.test(clean);
  const wantBoys = needRaw.includes("boy") || /\bboys?\b/i.test(clean);
  const wantCoed = needRaw.includes("coed") || /\bcoed\b/i.test(clean);
  const need = [wantGirls && "Girls", wantBoys && "Boys", wantCoed && "Coed"].filter(Boolean).join(" / ");

  // ---------- Special requests ----------
  let specialReqs = grab(
    /Special\s*Requests?\s*[*:\-–(]+\s*([^\n*📞]{2,200})/i,
    /Notes?\s*[:\-–]+\s*([^\n]{2,200})/i,
    /Remarks?\s*[:\-–]+\s*([^\n]{2,200})/i,
  ).replace(/\b(NA|None|n\/a|If any)\b/gi, "").trim();

  if (!specialReqs) {
    const consumed = new Set<string>();
    [name, phone, email, location, budget, moveIn].forEach((v) => v && consumed.add(v.toLowerCase().trim()));
    const extras: string[] = [];
    for (const rawLine of clean.split("\n")) {
      const line = rawLine.replace(EMOJI_RE, "").trim();
      if (!line || line.length < 4 || line.length > 200) continue;
      const lower = line.toLowerCase();
      if (consumed.has(lower)) continue;
      if (/\d{6,}/.test(line)) continue;
      if (/@/.test(line)) continue;
      if (looksLikeBudget(line) || looksLikeDate(line)) continue;
      if (NON_NAME_TOKENS.test(line) && !/\b(veg|non[- ]?veg|ac|gym|wifi|food|parking|pet|ventilation|spacious|clean|backup|family|balcony|attached|sunlight|quiet|washroom)\b/i.test(line)) continue;
      if (/\b(veg|non[- ]?veg|ac|gym|wifi|food|parking|pet|ventilation|spacious|clean|backup|family|quiet|sunlight|balcony|attached|washroom)\b/i.test(line)
          || (/^[A-Za-z]/.test(line) && line.split(/\s+/).length >= 3)) {
        extras.push(line);
      }
    }
    specialReqs = extras.join("; ").slice(0, 240);
  }

  const inBLRTrue = /\bin\s*blr\b|in bangalore|currently in bangalore|already here|yes.*blr/i.test(normalised);
  const inBLRFalse = /not in blr|not in bangalore|outside bangalore|relocating|out.*blr/i.test(normalised);
  let inBLR = inBLRTrue ? true : inBLRFalse ? false : null;

  const zone = detectZone(normalised, dynamicZones);
  // If zone detection finds a Bangalore zone, infer inBLR true when explicit phrase missing
  if (inBLR === null && zone) {
    inBLR = true;
  }

  // Extract distinct area tokens from the captured location + raw text
  const areaPool = `${location} ${normalised}`.toLowerCase();
  const areaSet = new Set<string>();
  for (const z of ZONES) {
    for (const kw of z.keywords) {
      if (kw.length < 4) continue;
      if (areaPool.includes(kw)) {
        // canonical-case version
        areaSet.add(kw.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
      }
    }
  }
  const areas = [...areaSet].slice(0, 6);

  // Full address = map link / URL OR location lines >60 chars OR explicit "Full Address" label
  let fullAddress = "";
  const urlMatch = normalised.match(/https?:\/\/\S+/);
  if (urlMatch) fullAddress = urlMatch[0];
  if (!fullAddress) {
    const longLine = normalised.split("\n").map((l) => l.trim()).find((l) => l.length > 60 && /\d/.test(l) && !/@/.test(l));
    if (longLine) fullAddress = longLine;
  }
  const labeledFull = grab(/Full\s*Address\s*[:\-–]+\s*([^\n]{5,300})/i);
  if (labeledFull) fullAddress = labeledFull;

  // Fallback: if no explicit fullAddress URL/long line found, use the parsed
  // `location` as the full address so short location-only pastes (e.g. "SG palya")
  // still populate the Full Address / Map link field in the UI.
  if (!fullAddress && location) {
    fullAddress = location;
  }

  const consumedValues = [name, phone, email, location, budget, moveIn, type, room, need, specialReqs, fullAddress, ...links, ...budgets]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  const extraContent = cleanJunk(normalised)
    .split(/\n|\s{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !consumedValues.some((v) => v && part.toLowerCase().includes(v)))
    .join(" · ")
    .slice(0, 900);
  const geoIntel = {
    query: [location, fullAddress, areas.join(", ")].filter(Boolean).join(" · "),
    zone,
    areas,
    links,
    confidence: (links.length || areas.length >= 2 ? "high" : location ? "medium" : "low") as "high" | "medium" | "low",
    distanceHint: links.length ? "Map link attached for distance check" : areas.length ? `Route by ${areas[0]}${areas[1] ? ` + ${areas.length - 1} more area(s)` : ""}` : "Needs location before distance check",
    syncStatus: (location || areas.length || links.length ? links.length ? "ready" : "needs-map-link" : "needs-location") as "ready" | "needs-map-link" | "needs-location",
  };
  const summary = [name || "Unnamed", phone && `☎ ${phone}`, budget && `₹ ${budget}`, moveIn && `move ${moveIn}`, room, need, location || areas.join(", ")]
    .filter(Boolean).join(" · ");

  if (!phone && !email && !name) return null;

  // Heuristic quality: hot if phone present and move-in is immediate/date; good if phone+budget; else null
  let quality: "hot" | "good" | "bad" | null = null;
  const moveImmediate = /\b(immediate|asap|now|today|tomorrow|next\s*(?:week|month)|within\s*\d)\b/i.test(moveIn || "") || /\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?/.test(moveIn || "");
  if (phone && moveImmediate) quality = "hot";
  else if (phone && budget) quality = "good";
  else if (phone) quality = "good";

  // Convert human-readable move-in dates (e.g., "7th May") to ISO format (e.g., "2026-05-07")
  const moveInIso = moveIn ? parseHumanDate(moveIn) : "";

  const detectZoneToUse = dynamicZones && dynamicZones.length > 0 
    ? detectZone(raw, dynamicZones) 
    : detectDirection(raw);

  return {
    name, phone, email, location, areas, fullAddress,
    budget, moveIn: moveInIso || moveIn,
    type, room, need, specialReqs, extraContent, summary, budgets, links, geoIntel, inBLR, zone: detectZoneToUse,
    rawSource: raw,
    // Confidence scores for key fields (0-1 scale)
    confidence: {
      name: nameConfidence,
      phone: phone ? 0.95 : 0,
      email: email ? 0.9 : 0,
      location: location ? (links.length ? 0.95 : areas.length >= 2 ? 0.85 : 0.7) : 0,
      budget: budget ? 0.8 : 0,
    },
    quality,
  };
}

export function splitLeads(text: string): string[] {
  const norm = normalisePaste(text);
  const lines = norm.split("\n");
  const chunks: string[] = [];
  let cur: string[] = [];

  const isOpener = (line: string): boolean => {
    const t = line.trim();
    if (t.length < 3) return false;
    return (
      /^📝/.test(t) ||
      /^\*?GHARPAYY/i.test(t) ||
      /^(?:\*?\s*Name\s*[:\-–*])/i.test(t) ||
      /^Name\s*[-–]/i.test(t) ||
      /^\.Name\s/i.test(t) ||
      /^\[[\d:]+\s*(AM|PM),\s*\d/.test(t) ||
      /^[A-Z][a-zA-Z]{1,20}\s+[6-9]\d{9}/.test(t) ||
      /^[A-Z][a-zA-Z\s]{2,30}\s+[6-9]\d{9}/.test(t) ||
      /^(?:\+91[-\s]?)?[6-9]\d{9}\b/.test(t) ||
      /^[-–]\s*[A-Z][a-z]/.test(t) ||
      /^\*?Name\s*:/i.test(t)
    );
  };

  const isJunk = (line: string): boolean => {
    const t = line.trim();
    return !t ||
      /^(not filled|no|n\/a|xyz|3405|na)$/i.test(t) ||
      /^[\-–=*_]{3,}$/.test(t);
  };

  for (const line of lines) {
    if (isJunk(line)) {
      if (cur.length) { chunks.push(cur.join("\n")); cur = []; }
      continue;
    }
    if (cur.length === 0) {
      cur.push(line);
    } else if (isOpener(line)) {
      chunks.push(cur.join("\n"));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur.join("\n"));
  return chunks.filter((c) => c.trim().length > 4);
}
