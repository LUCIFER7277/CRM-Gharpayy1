// Lead Identity, Dedup & Ownership - type definitions
// Mock-store layer; will migrate to Lovable Cloud in next pass.

export type LifecycleState =
  | "new"
  | "contacted"
  | "interested"
  | "visit-scheduled"
  | "visit-done"
  | "converted"
  | "dropped"
  | "dormant";

export type MatchType = "exact" | "strong" | "possible" | "new";

export type LeadQuality = "hot" | "good" | "bad" | null;
export type LeadPriority = "high" | "medium" | "low";
export type InterestLevel = "HOT" | "WARM" | "COLD" | null;
export type ObjectionTagStr =
  | "PRICE-HIGH" | "LOCATION-MISMATCH" | "COMPARING" | "FAMILY-APPROVAL"
  | "TIMING" | "AMENITY-GAP" | "UNRESPONSIVE" | "SWITCHED-PLATFORM"
  | "PLANS-CHANGED" | "UNKNOWN";
export type LeadPhaseNum = 1 | 2 | 3 | 4 | 5;
export type LeadStageTag = string;

export type AssignmentEntry = {
  tcmId: string;
  assignedAt: string;
  assignedBy?: string;
};

export interface LeadAnchors {
  leadDate: string;
  tourDate?: string;
  bookingDate?: string;
  checkInDate?: string;
}

export interface UnifiedLead {
  id: string;                 // Universal Lead ID
  name: string;
  phoneE164: string;            // normalized: +91XXXXXXXXXX
  phoneRaw: string;
  email: string;
  emailNorm: string;
  area: string;
  areas?: string[];             // multi-area tokens (HSR, BTM, …)
  fullAddress?: string;         // long-form address / map link
  zone: string;                 // South / East / North / West / Central / "" or categorical bucket
  zoneCategory?: string;        // editor-chosen bucket (e.g. "KORA CORE")
  quality?: LeadQuality;        // hot / good / bad
  priority?: LeadPriority;
  tags?: string[];
  earliestCheckIn?: string;
  stage?: string;               // Lead stage label (MYT [TENANT], etc.)
  assigneeId?: string | null;
  assigneeName?: string | null;
  assignmentHistory?: AssignmentEntry[];
  budget: number;
  moveInDate: string;
  type: string;                 // Student / Working / etc
  room: string;                 // Private / Shared / Both
  need: string;                 // Boys / Girls / Coed
  inBLR: boolean | null;
  notes: string;
  extraContent?: string;
  summary?: string;
  budgets?: string[];
  links?: string[];
  geoIntel?: LeadGeoIntel;
  state: LifecycleState;
  primaryOwnerId: string;
  secondaryOwnerId: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  rawSource?: string;           // original pasted text
  lastContactAt?: string;
  anchors?: LeadAnchors;
  phase?: LeadPhaseNum;
  stageTag?: LeadStageTag;
  interestLevel?: InterestLevel;
  primaryObjection?: ObjectionTagStr | null;
  replied?: boolean;
  noShowFlag?: boolean;
  noShowCount?: number;
  followUpCount?: number;
  propertyName?: string;
  managerEscalated?: boolean;
  lostReason?: string;
  closedReason?: string;
}

export interface OwnershipHistoryEntry {
  id: string;
  ownerId: string;
  role: "primary" | "secondary";
  fromTs: string;
  toTs: string | null;
  reason: string;
}

export type AccessRequestState = "pending" | "approved" | "rejected" | "auto-escalated";

export interface AccessRequest {
  id: string;
  leadId: string;
  requesterId: string;
  requesterName: string;
  toOwnerId: string;
  ts: string;
  state: AccessRequestState;
  decidedAt?: string;
  message?: string;
}

export type ActivityKind =
  | "lead-created"
  | "lead-merged"
  | "owner-changed"
  | "secondary-added"
  | "access-requested"
  | "access-granted"
  | "access-rejected"
  | "call-logged"
  | "whatsapp-sent"
  | "visit-scheduled"
  | "visit-done"
  | "note-added"
  | "state-changed"
  | "reactivated"
  | "revived";

export interface ActivityEntry {
  id: string;
  leadId: string;
  ts: string;
  actorId: string;
  actorName: string;
  kind: ActivityKind;
  text: string;
  meta?: Record<string, unknown>;
}

export interface MatchCandidate {
  lead: UnifiedLead;
  score: number;       // 0-100
  reasons: string[];   // "phone exact", "name 0.92", ...
}

export interface MatchResult {
  type: MatchType;
  topScore: number;
  candidates: MatchCandidate[]; // ranked, max 5
}

export interface ParsedLeadDraft {
  name: string;
  phone: string;
  email: string;
  location: string;
  /** Distinct area tokens detected in the location/address text (e.g. ["HSR Layout","BTM"]). */
  areas: string[];
  /** Full address / map link / long-form location string when present. */
  fullAddress: string;
  budget: string;        // raw budget text
  moveIn: string;        // raw move-in text
  type: string;
  room: string;
  need: string;
  specialReqs: string;
  /** Leftover useful pasted content that did not fit a structured field. */
  extraContent?: string;
  /** Short machine-readable summary of the pasted request. */
  summary?: string;
  /** Every budget option detected in the paste, e.g. ["8-12k", "13-16k"]. */
  budgets?: string[];
  /** All links preserved from the paste, including maps/app links. */
  links?: string[];
  /** Lightweight location intelligence for routing/matching. */
  geoIntel?: LeadGeoIntel;
  inBLR: boolean | null;
  zone: string;
  rawSource: string;
  /** Confidence scores (0-1) for critical fields during parsing. */
  confidence?: {
    name: number;
    phone: number;
    email: number;
    location: number;
    budget: number;
  };
  /** Suggested lead quality computed heuristically during parsing. */
  quality?: "hot" | "good" | "bad" | null;
  propertySelection?: {
    type: "hub" | "other";
    propertyId?: string;
    propertyName?: string;
  };
}

export interface LeadGeoIntel {
  query: string;
  zone: string;
  areas: string[];
  links: string[];
  confidence: "high" | "medium" | "low";
  distanceHint: string;
  syncStatus: "ready" | "needs-map-link" | "needs-location";
}
