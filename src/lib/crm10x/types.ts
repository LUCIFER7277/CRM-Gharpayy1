/**
 * CRM 10x - additive intelligence layer on top of the core lead store.
 *
 * Nothing here REPLACES the existing types in src/lib/types.ts. Every record
 * is keyed by leadId / tourId so it can hang off the canonical entities
 * without touching them. All state is local-only (Zustand + localStorage).
 */

export type Gender = "boys-pg" | "girls-pg" | "co-live";
export type RoomTypePref = "single" | "double" | "triple" | "any";
export type FurnishingPref = "ac" | "non-ac" | "semi" | "any";
export type FoodPref = "veg" | "non-veg" | "no-food" | "any";
export type LangPref = "english" | "hindi" | "kannada" | "other";
export type LeadSource =
  | "whatsapp" | "website" | "referral" | "indiamart" | "google" | "walk-in" | "other";
export type DecisionAuthority = "self" | "parents" | "company-hr";
export type FlexibilityScore = 1 | 2 | 3 | 4 | 5;
export type CallOutcome =
  | "answered" | "not-answered" | "busy" | "switched-off" | "wrong-number" | "callback-requested";
export type ObjectionCode =
  | "price-too-high"
  | "location-not-suitable"
  | "room-too-small"
  | "not-ready-yet"
  | "comparing-other-pgs"
  | "needs-family-approval"
  | "food-not-available"
  | "no-ac"
  | "safety-concern"
  | "no-response-to-offer"
  | "other"
  | "none";

export type ObjectionResolution = "yes" | "partially" | "no";

/** Versioned shifting-date record. Old entries are NEVER removed. */
export interface ShiftingDateEntry {
  ts: string;            // when this update was logged
  shiftingDate: string;  // ISO date the lead intends to shift on
  reason?: string;       // free text e.g. "parents wanted next month"
  loggedBy: string;
}

/** Deep profile that goes BEYOND the basic Lead{} fields. */
export interface DeepLeadProfile {
  leadId: string;
  gender?: Gender;
  roomType?: RoomTypePref;
  furnishing?: FurnishingPref;
  food?: FoodPref;
  currentCity?: string;
  targetCity?: string;
  companyOrCollege?: string;
  source?: LeadSource;
  referralName?: string;
  preferredMoveInDate?: string;     // current/active shifting date (ISO)
  shiftingHistory?: ShiftingDateEntry[]; // versioned trail - Gharpayy never forgets
  flexible?: boolean;
  budgetStated?: number;
  budgetMax?: number;
  shortlistedCount?: number;
  decisionMaker?: DecisionAuthority;
  language?: LangPref;
  locationFeasible?: boolean;
  bestCallTime?: string;
  flexibility?: FlexibilityScore;
  verifiedBudget?: boolean;
  verifiedMoveIn?: boolean;
  qualificationCompleteAt?: string;
  visitReadyAt?: string;
  updatedAt: string;
}

/** Logged on every "Called - Answered" or "Visit Completed" activity. */
export interface ObjectionRecord {
  id: string;
  leadId: string;
  tourId?: string;
  ts: string;
  loggedBy: string;
  context: "call" | "visit" | "whatsapp";
  code: ObjectionCode;
  leadWords: string;            // exact words
  handling: string;             // how the agent handled it
  resolution: ObjectionResolution;
}

/** Call intelligence - beyond a simple "call logged". */
export interface CallRecord {
  id: string;
  leadId: string;
  ts: string;
  loggedBy: string;
  attemptNumber: number;
  durationSec: number;
  outcome: CallOutcome;
  language?: LangPref;
  bestCallTime?: string;
  notes: string;
}

/** Pre/post visit intelligence. */
export interface VisitIntel {
  tourId: string;
  leadId: string;
  // pre
  propertyShownName?: string;
  pointOfContact?: string;
  travelMode?: "self" | "pickup" | "remote";
  confirmationChecklist?: { roomClean: boolean; managerPresent: boolean; wifiWorking: boolean };
  // post
  roomShown?: string;
  reaction?: "loved" | "liked" | "neutral" | "disappointed";
  competitorsVisited?: string[];   // e.g. ["Stanza Hebbal", "Colive Indiranagar"]
  bookProbability?: number;        // 0-100 agent gut estimate
  updatedAt?: string;
}

/** Lead's own decision commitment vs an agent-set follow-up. */
export interface LeadCommitment {
  id: string;
  leadId: string;
  ts: string;
  decisionBy: string;        // ISO date - "I'll decide by Thursday"
  exactWords: string;
  status: "pending" | "kept" | "missed";
}

/** Activity-history merge on duplicate consolidation. */
export interface DuplicateMerge {
  id: string;
  ts: string;
  keepLeadId: string;
  closeLeadId: string;
  reason: string;
}

/** Reassignment audit + escalation. */
export interface AssignmentRecord {
  id: string;
  leadId: string;
  ts: string;
  fromTcmId: string | null;
  toTcmId: string;
  reasonCategory:
    | "out-of-area" | "capacity-full" | "lead-quality-mismatch"
    | "specialized-pg" | "manager-override" | "auto-route";
  note?: string;
  zone: "extra-zone" | "my-zone" | "pool";
}

/** Manager-only private coaching note (invisible to agent). */
export interface CoachingNote {
  id: string;
  leadId: string;
  ts: string;
  managerId: string;
  text: string;
}

/** Dormant re-engagement triggers. */
export type DormantBucket = "30d" | "60d" | "90d";

/**
 * One row per WhatsApp template send. Used to compute reply rate and
 * send-to-book conversion per template stage.
 */
export interface MessageOutcome {
  id: string;
  leadId: string;
  ts: string;
  stage: string;             // template stage id (e.g. "follow-up")
  language: string;          // "english" | "hindi"
  loggedBy: string;
  replied: boolean;
  bookedAfter: boolean;      // lead booked within 14 days of THIS send
  attributedBookingId?: string; // safety: which booking earned the credit
  notes?: string;
}
