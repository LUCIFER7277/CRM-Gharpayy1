export type Role = "flow-ops" | "tcm" | "hr" | "owner" | "super-admin";
export type Intent = "hot" | "warm" | "cold";
export type TourStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "no-show"
  | "cancelled"
  | "on-tour";
export type ClientDecision =
  | "booked"
  | "thinking"
  | "awaiting"
  | "dropped"
  | "token-paid"
  | "draft"
  | "follow-up"
  | "rejected"
  | "not-interested"
  | null;
export type LeadStage =
  | "new"
  | "contacted"
  | "tour-scheduled"
  | "on-tour"
  | "tour-done"
  | "negotiation"
  | "quote-sent"
  | "not-responding-3d"
  | "not-responding-7d"
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
  zoneId: string;
  area: string;
  address: string;
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
  budgetText?: string;
  moveInDate: string;
  preferredArea: string;
  assignedTcmId: string;
  assigneeId?: string | null;
  createdBy?: string | null;
  stage: LeadStage;
  intent: Intent;
  confidence: number; // 0-100 (deal probability)
  tags: string[];
  nextFollowUpAt: string | null;
  responseSpeedMins: number; // first response time
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  tourDate?: string;
  quoteId?: string;
  quotedPrice?: number;
  propertyName?: string;
  replied?: boolean;
  interestLevel?: Intent;
  priority?: Intent;
  earliestCheckIn?: string;
  primaryObjection?: string | null;
  // Extended fields
  email?: string;
  areas?: string[];
  fullAddress?: string;
  type?: string;
  room?: string;
  need?: string;
  inBLR?: boolean | null;
  quality?: "hot" | "good" | "bad" | null;
  specialReqs?: string;
  notes?: string;
  zoneCategory?: string;
  stageLabel?: string;
}

export interface PostTourUpdate {
  outcome: ClientDecision;
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
  propertyId?: string | null;
  tcmId: string;
  assignedTo?: string;
  scheduledBy?: string;
  scheduledAt: string;
  tourType?: "physical" | "virtual" | "pre-book-pitch";
  status: TourStatus;
  showUp?: boolean | null;
  customPropertyName?: string;
  decision: ClientDecision;
  postTour: PostTourUpdate;
  createdAt: string;
  updatedAt: string;
}

export type ActivityKind =
  | "lead_created"
  | "status_changed"
  | "site_visit"
  | "tour_scheduled"
  | "tour_started"
  | "tour_completed"
  | "tour_cancelled"
  | "decision_logged"
  | "booking_confirmed"
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

/* ============== HANDOFF (FlowOps ↔ TCM messaging) ============== */
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

/* ============== SEQUENCE (WhatsApp state machine) ============== */
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

/* ============== BOOKING ============== */
export type BookingStatus = "pending" | "approved" | "paid" | "active" | "expired" | "cancelled";
export type RentStatus = "paid" | "pending" | "overdue";
export type PaymentMethod = "UPI" | "Cash" | "Bank" | "Card";
export type PaymentType = "token" | "rent" | "deposit" | "other";
export type TenantStatus = "active" | "notice" | "exited";

export interface Booking {
  id: string;
  leadId: string;
  tourId: string;
  propertyId: string;
  tcmId: string;
  amount: number; // monthly rent
  tenantName: string;
  tenantPhone: string;
  deposit: number;
  moveInDate: string;
  status: BookingStatus;
  offerExpiresAt?: string | null;
  paidRef?: string | null;
  notes?: string;
  ts: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  bookingId: string;
  leadId: string;
  propertyId: string;
  tcmId: string;
  name: string;
  phone: string;
  email?: string;
  roomNumber?: string;
  moveInDate: string;
  rent: number;
  deposit: number;
  status: TenantStatus;
  noticeGivenAt?: string | null;
  exitDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentRecord {
  id: string;
  bookingId: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  month: string; // "YYYY-MM"
  amount: number;
  status: RentStatus;
  paidAt?: string | null;
  ref?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  method: PaymentMethod;
  ref?: string;
  type: PaymentType;
  notes?: string;
  createdAt: string;
}
