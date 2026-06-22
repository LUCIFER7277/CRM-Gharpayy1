import type { Lead, Tour, Property } from "./types";
import { resolvePropertyById, searchPropertyCatalog } from "@/lib/crm10x/property-catalog";
import { calendarDayIST } from "@/lib/crm10x/dates";

const CLOSED_STAGES: ReadonlySet<Lead["stage"]> = new Set(["booked", "dropped"]);

export function isLeadClosed(lead: Lead): boolean {
  return CLOSED_STAGES.has(lead.stage);
}

export function isLeadActive(lead: Lead): boolean {
  return !CLOSED_STAGES.has(lead.stage);
}

export function safeParseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  const d = safeParseDate(iso);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = (target.getTime() - today.getTime()) / 86_400_000;
  return Number.isNaN(diff) ? null : Math.floor(diff);
}

export function daysSince(iso: string | null | undefined): number | null {
  const d = safeParseDate(iso);
  if (!d) return null;
  const diff = (Date.now() - d.getTime()) / 86_400_000;
  return Number.isNaN(diff) ? null : Math.floor(diff);
}

export function formatArea(lead: Lead): string {
  if (lead.preferredArea && lead.preferredArea !== "-" && lead.preferredArea.trim()) {
    return lead.preferredArea;
  }
  if (lead.areas && lead.areas.length > 0) {
    const valid = lead.areas.filter((a) => a && a !== "-" && a.trim());
    if (valid.length > 0) return valid[0];
  }
  if (lead.fullAddress && lead.fullAddress !== "-" && lead.fullAddress.trim()) {
    return lead.fullAddress;
  }
  return "Location not captured";
}

export function formatBudget(budget: number | undefined | null): string {
  if (budget == null || budget <= 0 || Number.isNaN(budget)) return "Budget not specified";
  return "₹" + (budget / 1000).toFixed(0) + "k";
}

export function formatAssignee(
  assignedTcmId: string | undefined | null,
  userName?: string | null,
): string {
  if (!assignedTcmId) return "Unassigned";
  return userName ?? "Unassigned";
}

export function formatMoveInLabel(iso: string | null | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return "Date not set";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return `In ${d}d`;
  return `In ${d}d`;
}

export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return "No phone";
  return phone;
}

export function formatSource(source: string | undefined | null): string {
  if (!source || source === "-" || source.trim() === "") return "Unknown";
  return source;
}

// ─── Name normalization ──────────────────────────────

// Strict invalid patterns: clearly gibberish or system placeholders only
const INVALID_PLACEHOLDER_PATTERNS = [
  /^-+$/,                                                    // Dashes only: "---"
  /^—+$/,                                                   // Em-dashes only: "———"
  /^_+$/,                                                   // Underscores only: "___"
  /^\.+$/,                                                  // Dots only: "..."
  /^(n\/?a|na|none|null|undefined)$/i,                     // Explicit placeholders
  /^(lead name not captured|name not captured|unknown lead|unknown)$/i,
  /^(test|demo|sample|temp|testing|dummy)$/i,              // Test placeholders (NOT short names)
  /^(uploaded lead|lead \d+|customer \d+)$/i,              // CSV upload artifacts
];

export const LEAD_NAME_NOT_CAPTURED = "Lead name not captured";

/**
 * Title-cases a string: capitalize first letter of each word.
 * E.g., "ali khan" → "Ali Khan"
 */
function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Detects obvious keyboard smash (random character mashing with virtually no vowels).
 * Allows real names with few vowels, initials, and Indian naming patterns.
 */
function isLikelyKeyboardSmash(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-z]/g, "");
  
  // Short strings (< 4 letters) are rarely keyboard smash unless known patterns
  if (compact.length < 4) return false;
  
  // Names with spaces typically aren't smash
  if (/\s/.test(value)) return false;
  
  // Known smash patterns: long strings with NO vowels (e.g., "bfdfd", "dfgbdfgd")
  const vowels = compact.match(/[aeiou]/g)?.length ?? 0;
  if (vowels === 0 && compact.length >= 4) return true;
  
  // Very low vowel ratio ONLY for >= 8 chars (allows "xyz" but blocks "bfdfdbfdf")
  if (compact.length >= 8) {
    const vowelRatio = vowels / compact.length;
    if (vowelRatio <= 0.1) return true; // e.g., "ffhgfhgf" (0% vowels)
  }
  
  return false;
}

/**
 * Validates that a string looks like a plausible human name.
 * Rejects only truly invalid placeholders and gibberish.
 * Allows: short names, initials, Indian patterns, names with apostrophes/hyphens.
 */
export function normalizeLeadName(name: string | null | undefined): string {
  if (!name) return LEAD_NAME_NOT_CAPTURED;
  
  const trimmed = name.trim();
  if (!trimmed) return LEAD_NAME_NOT_CAPTURED;
  
  // Single character is only valid if it looks like an initial (usually in a multi-part name)
  // Reject "x", "y", "z" as names, but allow in "R K Sharma"
  if (trimmed.length === 1) return LEAD_NAME_NOT_CAPTURED;
  
  const lower = trimmed.toLowerCase();
  
  // Check against strict invalid patterns
  for (const pattern of INVALID_PLACEHOLDER_PATTERNS) {
    if (pattern.test(lower)) return LEAD_NAME_NOT_CAPTURED;
  }
  
  // Reject repeated single character (aaa, bbb, ffff) only if very short or all same
  if (/^(.)\1{2,}$/.test(trimmed) && trimmed.length <= 4) {
    return LEAD_NAME_NOT_CAPTURED;
  }
  
  // Reject obvious keyboard smash
  if (isLikelyKeyboardSmash(trimmed)) {
    return LEAD_NAME_NOT_CAPTURED;
  }
  
  // Reject pure numbers (can't be a name)
  if (/^\d+$/.test(trimmed)) {
    return LEAD_NAME_NOT_CAPTURED;
  }
  
  // Passed all checks — this is likely a real name
  return trimmed;
}

/**
 * Attempts to resolve the best display name from a lead record.
 * Tries multiple sources in order of reliability.
 */
export function resolveBestLeadName(lead: {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  notes?: string | null;
  email?: string | null;
}): string {
  const captured = resolveCapturedLeadName(lead);
  if (captured) return captured;

  // Keep a graceful fallback for unusual short names, but never repeat system placeholders.
  if (lead.name?.trim() && lead.name.trim().toLowerCase() !== LEAD_NAME_NOT_CAPTURED.toLowerCase()) {
    return lead.name.trim();
  }

  const digits = lead.phone?.replace(/\D/g, "") ?? "";
  if (digits.length >= 4) return `Customer ${digits.slice(-4)}`;
  if (lead.id?.trim()) return `Customer ${lead.id.trim().slice(-4).toUpperCase()}`;
  return "Customer";
}

export function hasCapturedLeadName(lead: {
  name?: string | null;
  notes?: string | null;
  email?: string | null;
}): boolean {
  return resolveCapturedLeadName(lead) !== null;
}

function resolveCapturedLeadName(lead: {
  name?: string | null;
  notes?: string | null;
  email?: string | null;
}): string | null {
  // 1. Try normalized lead.name if it's valid
  if (lead.name) {
    const normalized = normalizeLeadName(lead.name);
    if (normalized !== LEAD_NAME_NOT_CAPTURED) {
      return normalized;
    }
  }
  
  // 2. Try to extract name from notes if present
  if (lead.notes && lead.notes.trim()) {
    // Look for common name patterns in notes (often formatted as "name: xxx" or just starts with a name)
    const notesLines = lead.notes.split("\n");
    for (const line of notesLines) {
      const match = line.match(/^(?:name|lead|contact|person)\s*:?\s*([^\d,:;]+)/i);
      if (match) {
        const extracted = match[1].trim().split(/[,;]/)[0].trim();
        const normalized = normalizeLeadName(extracted);
        if (normalized !== LEAD_NAME_NOT_CAPTURED) {
          return normalized;
        }
      }
    }

  }
  
  // 3. Try to extract from email (before @)
  if (lead.email && lead.email.includes("@")) {
    const emailPart = lead.email.split("@")[0];
    // Replace common separators with space
    const nameCandidate = emailPart
      .replace(/[._-]/g, " ")
      .replace(/\d/g, "")
      .trim();
    if (nameCandidate) {
      const titleCased = titleCase(nameCandidate);
      const normalized = normalizeLeadName(titleCased);
      if (normalized !== LEAD_NAME_NOT_CAPTURED) {
        return normalized;
      }
    }
  }

  return null;
}

export function normalizeLeadRecord<T extends { name?: string | null; notes?: string | null; email?: string | null }>(
  lead: T,
): T & { name: string } {
  return {
    ...lead,
    name: resolveBestLeadName(lead),
  };
}

export function pickRelevantActiveTour(tours: Tour[], nowMs = Date.now()): Tour | undefined {
  const activeTours = tours.filter((tour) => tour.status === "scheduled" || tour.status === "confirmed");
  if (activeTours.length === 0) return undefined;
  const today = calendarDayIST(new Date(nowMs));

  const todayTours = activeTours
    .filter((tour) => calendarDayIST(tour.scheduledAt) === today)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  if (todayTours[0]) return todayTours[0];

  const futureTours = activeTours
    .filter((tour) => +new Date(tour.scheduledAt) >= nowMs)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  if (futureTours[0]) return futureTours[0];

  return activeTours.sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0];
}

// ─── Location validation ─────────────────────────────

const INVALID_LOCATION_VALUES = new Set([
  "",
  "-",
  "—",
  "_",
  ".",
  "na",
  "n/a",
  "none",
  "nil",
  "null",
  "undefined",
  "ss",
  "test",
  "demo",
  "asdf",
  "xyz",
  "loc",
  "location",
  "area",
  "property",
  "unknown",
]);

export function isInvalidLocationValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  if (INVALID_LOCATION_VALUES.has(trimmed)) return true;
  if (/^-+$/.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.length < 2) return true;
  return false;
}

export function normalizeLocationText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

// ─── Property Hub location resolution ────────────────

export interface ResolvedLocation {
  area: string;
  propertyName: string | null;
  source: "hub" | "ops" | "lead" | "fallback" | "other";
}

export function resolveLeadLocation(
  lead: Lead,
  tours: Tour[] = [],
  properties: Property[] = [],
): ResolvedLocation {
  const leadTours = tours.filter((t) => t.leadId === lead.id);
  const hubTour = leadTours.find(
    (t) => t.propertyId && resolvePropertyById(t.propertyId, properties)?.source === "hub",
  );
  if (hubTour && hubTour.propertyId) {
    const catalog = resolvePropertyById(hubTour.propertyId, properties);
    if (catalog) {
      return {
        area: catalog.area,
        propertyName: catalog.name,
        source: "hub",
      };
    }
  }

  const opsTour = leadTours.find(
    (t) => t.propertyId && resolvePropertyById(t.propertyId, properties),
  );
  if (opsTour && opsTour.propertyId) {
    const catalog = resolvePropertyById(opsTour.propertyId, properties);
    if (catalog) {
      return {
        area: catalog.area,
        propertyName: catalog.name,
        source: "ops",
      };
    }
  }

  if (lead.preferredArea && !isInvalidLocationValue(lead.preferredArea)) {
    const catalog = searchPropertyCatalog("", properties, {
      preferredArea: lead.preferredArea,
      limit: 1,
    })[0];
    if (catalog) {
      return { area: catalog.area, propertyName: catalog.name, source: catalog.source };
    }
    return { area: lead.preferredArea, propertyName: null, source: "lead" };
  }

  if (lead.areas && lead.areas.length > 0) {
    const valid = lead.areas.find((a) => !isInvalidLocationValue(a));
    if (valid) {
      const catalog = searchPropertyCatalog("", properties, {
        preferredArea: valid,
        limit: 1,
      })[0];
      if (catalog) {
        return { area: catalog.area, propertyName: catalog.name, source: catalog.source };
      }
      return { area: valid, propertyName: null, source: "lead" };
    }
  }

  if (lead.fullAddress && !isInvalidLocationValue(lead.fullAddress)) {
    const catalog = searchPropertyCatalog("", properties, {
      preferredArea: lead.fullAddress,
      limit: 1,
    })[0];
    if (catalog) {
      return { area: catalog.area, propertyName: catalog.name, source: catalog.source };
    }
    return { area: lead.fullAddress, propertyName: null, source: "lead" };
  }

  const fallback = searchPropertyCatalog("", properties, { limit: 1 })[0];
  if (fallback) {
    return { area: fallback.area, propertyName: fallback.name, source: fallback.source };
  }
  return { area: "Location not captured", propertyName: null, source: "fallback" };
}

export function profileCompletionScore(profile: Record<string, unknown> | undefined | null): number {
  if (!profile) return 0;
  const required = [
    "gender",
    "roomType",
    "decisionMaker",
    "locationFeasible",
    "companyOrCollege",
    "budgetStated",
    "verifiedBudget",
    "preferredMoveInDate",
  ];
  const filled = required.filter((key) => {
    const value = profile[key];
    return value !== undefined && value !== null && value !== "";
  }).length;
  return Math.min(100, Math.round((filled / required.length) * 100));
}
