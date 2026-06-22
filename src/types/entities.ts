export type Role = "flow-ops" | "tcm" | "hr" | "owner";
export type Intent = "hot" | "warm" | "cold";
export type TourStatus = "scheduled" | "completed" | "no-show" | "cancelled" | "on-tour";
export type ClientDecision = "booked" | "thinking" | "dropped" | null;
export type LeadStage =
  | "new"
  | "contacted"
  | "tour-scheduled"
  | "tour-done"
  | "negotiation"
  | "booked"
  | "dropped";

export interface TCM {
  id: string;
  name: string;
  initials: string;
  zone: string;
  conversionRate: number; // 0-1
  avgResponseMins: number;
}

export interface Property {
  id: string;
  name: string;
  area: string;
  totalBeds: number;
  vacantBeds: number;
  daysSinceLastBooking: number;
  pricePerBed: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  budget: number;
  moveInDate: string;
  preferredArea: string;
  assignedTcmId: string;
  stage: LeadStage;
  intent: Intent;
  confidence: number; // 0-100 (deal probability)
  tags: string[];
  propertySelection?: {
    type: "hub" | "other";
    propertyId?: string;
    propertyName?: string;
  };
  nextFollowUpAt: string | null;
  responseSpeedMins: number; // first response time
  createdAt: string;
  updatedAt: string;
}

export interface PostTourUpdate {
  outcome: "booked" | "thinking" | "not-interested" | null;
  confidence: number;
  objection: string | null;
  objectionNote: string;
  expectedDecisionAt: string | null;
  nextFollowUpAt: string | null;
  filledAt: string | null;
}

export interface Tour {
  id: string;
  leadId: string;
  leadName?: string;
  phone?: string;
  propertyId: string;
  tcmId: string;
  tourType?: "physical" | "virtual" | "pre-book-pitch";
  scheduledAt: string;
  status: TourStatus;
  decision: ClientDecision;
  postTour: PostTourUpdate;
  createdAt: string;
  updatedAt: string;
}

export type ActivityKind =
  | "lead_created"
  | "status_changed"
  | "tour_scheduled"
  | "tour_completed"
  | "tour_cancelled"
  | "decision_logged"
  | "post_tour_filled"
  | "follow_up_set"
  | "follow_up_done"
  | "note_added"
  | "message_sent"
  | "call_logged"
  | "escalation"
  | "stale_alert";

export interface ActivityLog {
  id: string;
  ts: string;
  kind: ActivityKind;
  actor: string; // tcmId | "flow-ops" | "system"
  leadId?: string;
  tourId?: string;
  propertyId?: string;
  text: string;
}

export type FollowUpPriority = "high" | "medium" | "low" | "urgent";
export interface FollowUp {
  id: string;
  leadId: string;
  tourId?: string;
  tcmId: string;
  dueAt: string;
  priority: FollowUpPriority;
  reason: string;
  done: boolean;
}

export interface HandoffMessage {
  id: string;
  leadId: string;
  ts: string;
  from: Role;
  fromId: string; // tcmId or 'flow-ops' or 'hr'
  to: Role; // implicit destination
  text: string;
  priority: "normal" | "urgent";
  read: boolean;
}

export type SequenceKind = "post-tour" | "pre-decision" | "cold-revival" | "first-contact";
export interface ActiveSequence {
  id: string;
  leadId: string;
  kind: SequenceKind;
  startedAt: string;
  currentStep: number;
  paused: boolean;
  stoppedReason?: string;
}

export interface Booking {
  id: string;
  leadId: string;
  tourId: string;
  propertyId: string;
  tcmId: string;
  amount: number; // monthly rent
  ts: string;
}

export type Gender = "boys-pg" | "girls-pg" | "co-live";
export type RoomTypePref = "single" | "double" | "triple" | "any";
export type FurnishingPref = "ac" | "non-ac" | "semi" | "any";
export type FoodPref = "veg" | "non-veg" | "no-food" | "any";
export type LangPref = "english" | "hindi" | "kannada" | "other";
export type LeadSource =
  | "whatsapp"
  | "website"
  | "referral"
  | "indiamart"
  | "google"
  | "walk-in"
  | "other";
export type DecisionAuthority = "self" | "parents" | "company-hr";
export type FlexibilityScore = 1 | 2 | 3 | 4 | 5;
export type CallOutcome =
  | "answered"
  | "not-answered"
  | "busy"
  | "switched-off"
  | "wrong-number"
  | "callback-requested";
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
  | "none";

export type ObjectionResolution = "yes" | "partially" | "no";

export interface ShiftingDateEntry {
  ts: string; // when this update was logged
  shiftingDate: string; // ISO date the lead intends to shift on
  reason?: string; // free text e.g. "parents wanted next month"
  loggedBy: string;
}

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
  preferredMoveInDate?: string; // current/active shifting date (ISO)
  shiftingHistory?: ShiftingDateEntry[]; // versioned trail
  flexible?: boolean;
  budgetStated?: number;
  budgetMax?: number;
  shortlistedCount?: number;
  decisionMaker?: DecisionAuthority;
  language?: LangPref;
  bestCallTime?: string;
  flexibility?: FlexibilityScore;
  verifiedBudget?: boolean;
  verifiedMoveIn?: boolean;
  updatedAt: string;
}

export interface ObjectionRecord {
  id: string;
  leadId: string;
  tourId?: string;
  ts: string;
  loggedBy: string;
  context: "call" | "visit" | "whatsapp";
  code: ObjectionCode;
  leadWords: string;
  handling: string;
  resolution: ObjectionResolution;
}

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
  transcript?: string;
}

export interface VisitIntel {
  tourId: string;
  leadId: string;
  propertyShownName?: string;
  pointOfContact?: string;
  travelMode?: "self" | "pickup" | "remote";
  confirmationChecklist?: { roomClean: boolean; managerPresent: boolean; wifiWorking: boolean };
  roomShown?: string;
  reaction?: "loved" | "liked" | "neutral" | "disappointed";
  competitorsVisited?: string[];
  bookProbability?: number;
  updatedAt?: string;
}

export interface LeadCommitment {
  id: string;
  leadId: string;
  ts: string;
  decisionBy: string;
  exactWords: string;
  status: "pending" | "kept" | "missed";
}

export interface DuplicateMerge {
  id: string;
  ts: string;
  keepLeadId: string;
  closeLeadId: string;
  reason: string;
}

export interface AssignmentRecord {
  id: string;
  leadId: string;
  ts: string;
  fromTcmId: string | null;
  toTcmId: string;
  reasonCategory:
    | "out-of-area"
    | "capacity-full"
    | "lead-quality-mismatch"
    | "specialized-pg"
    | "manager-override"
    | "auto-route";
  note?: string;
  zone: "extra-zone" | "my-zone" | "pool";
}

export interface CoachingNote {
  id: string;
  leadId: string;
  ts: string;
  managerId: string;
  text: string;
}

export type DormantBucket = "30d" | "60d" | "90d";

export interface MessageOutcome {
  id: string;
  leadId: string;
  ts: string;
  stage: string;
  language: string;
  loggedBy: string;
  replied: boolean;
  bookedAfter: boolean;
  attributedBookingId?: string;
  notes?: string;
}

export type QuotationStatus = "sent" | "paid" | "not-paid" | "expired" | "cancelled";

export interface Quotation {
  id: string;
  leadId: string;
  tcmId?: string;
  propertyId?: string; // existing property if picked
  propertyName: string; // resolved label (custom or property name)
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validityMinutes: number; // computed for stored snapshot
  validUntilISO: string; // ts when offer expires
  message: string; // rendered WhatsApp body
  status: QuotationStatus;
  sentAt: string;
  paidAt?: string;
  paymentNote?: string;
}

export interface QuotationDraft {
  propertyName: string;
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validUntilISO: string;
}
// Types for the Gharpayy Lead Intelligence Platform.

export type PGGender = "Boys" | "Girls" | "Co-live";
export type Tier = "Premium" | "Mid" | "Budget";

export interface Prices {
  min: number;
  max: number;
  single: number;
  double: number;
  triple: number;
}

export interface IQCheck {
  earned: number;
  max: number;
  ok: boolean;
}

export interface Persona {
  archetype: string;
  ageRange: string;
  salary: string;
  likelyCompanies: string;
  painPoints: string[];
  pitchAngle: string[];
  qualifyingQuestions: string[];
  doNot: string[];
  decisionMaker: string;
  conversionProbability: string;
}

export interface CallScript1 {
  goal: string;
  opening: string;
  questions: string[];
  hook: string;
  close: string;
}

export interface Objection {
  obj: string;
  resp: string;
}

export interface CallScript2 {
  goal: string;
  objections: Objection[];
}

export interface PitchScript {
  location: string;
  lifestyle: string;
  priceClose: string;
  closeQuestion: string;
}

export interface MoneyScript {
  breakdown: string[];
  payLater: string;
  depositObjection: string;
  checklist: string[];
}

export interface Scripts {
  call1: CallScript1;
  call2: CallScript2;
  pitch: PitchScript;
  money: MoneyScript;
}

export interface Contact {
  name: string;
  phone: string;
}

export interface NearbyLandmark {
  n: string; // name
  t: string; // type (Tech Park, College, Mall, ...)
  d: number; // distance in km
  w: number; // walk minutes
}

export interface PG {
  id: string;
  name: string;
  actualName: string;
  area: string;
  locality: string;
  gender: PGGender;
  tier: Tier;
  audience: string;
  prices: Prices;
  rooms: string;
  furnishing: string;
  amenities: string[];
  safety: string[];
  foodType: string;
  mealsIncluded: string;
  utilities: string;
  cleaning: string;
  noise: string;
  vibe: string;
  rules: string;
  lows: string;
  deposit: string;
  minStay: string;
  usp: string;
  manager: Contact;
  owner: Contact;
  groupName: string;
  mapsLink: string;
  wa_card: string;
  location_card: string;
  landmarksInline: string[];
  lat?: number | null;
  lng?: number | null;
  nearbyLandmarks: NearbyLandmark[];
  iq: number;
  iqBreakdown: Record<string, IQCheck>;
  persona: Persona;
  scripts: Scripts;
}

export interface Landmark {
  n: string; // name
  a: string; // area
  t: string; // type (Tech Park, MNC, College, Hospital, Mall, Company, ...)
  p: string; // pin
  m: string; // metro
  x: string; // notes / aliases / tenants
  lat?: number | null;
  lng?: number | null;
}

export interface AreaIntel {
  area: string;
  subAreas: string;
  budget: string;
  demand: string;
  profile: string;
  commute: string;
  topCompanies: string;
}

export type DistanceMatrix = Record<string, Record<string, number>>;

export interface Block {
  name: string;
  area: string;
  pin: string;
}
