export type Role = "flow-ops" | "tcm" | "hr";

export interface Zone {
  id: string;
  name: string;
  city?: string;
  area: string;
  areas: string[];
  color?: string;
}

export type TeamMemberRole = "flow-ops" | "tcm";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  zoneId: string;
  phone: string;
}

export type TourStatus = "scheduled" | "confirmed" | "completed" | "no-show" | "cancelled";
export type TourOutcome =
  | "booked"
  | "thinking"
  | "awaiting"
  | "token-paid"
  | "draft"
  | "follow-up"
  | "rejected"
  | "not-interested"
  | "dropped"
  | null;
export type BookingSource = "call" | "whatsapp" | "referral" | "walk-in" | "ad" | "organic";
export type LeadType = "urgent" | "future";

export type TourType = "physical" | "virtual" | "pre-book-pitch";
export type Intent = "hard" | "medium" | "soft";
export type ConfirmationStrength = "strong" | "tentative" | "weak";
export type DecisionMaker = "self" | "parent" | "group";
export type WillBookToday = "yes" | "maybe" | "no";
export type WhyLost = "price" | "location" | "food" | "delay" | "comparing" | "other" | null;

export interface TourQualification {
  moveInDate: string;
  decisionMaker: DecisionMaker;
  roomType: string;
  occupation: string;
  workLocation: string;
  willBookToday: WillBookToday;
  readyIn48h: boolean;
  exploring: boolean;
  comparing: boolean;
  needsFamily: boolean;
  keyConcern?: string;
}

export interface Tour {
  id: string;
  leadId?: string;
  leadName: string;
  phone: string;
  assignedTo: string;
  assignedToName: string;
  propertyName: string;
  customPropertyName?: string;
  propertyId?: string;
  area: string;
  zoneId: string;
  tourDate: string;
  tourTime: string;
  bookingSource: BookingSource;
  scheduledBy: string;
  scheduledByName: string;
  leadType: LeadType;
  status: TourStatus;
  showUp: boolean | null;
  outcome: TourOutcome;
  remarks: string;
  budget: number;
  createdAt: string;
  tourType: TourType;
  intent: Intent;
  confidenceScore: number;
  confidenceReason: string[];
  confirmationStrength: ConfirmationStrength;
  qualification: TourQualification;
  tokenPaid: boolean;
  whyLost: WhyLost;
}

export type DateRange = "today" | "week" | "month";

export interface MetricCard {
  label: string;
  value: number | string;
  change?: number;
  color?: "blue" | "green" | "amber" | "red";
}

export interface HeatmapData {
  hour: string;
  tours: number;
  showUps: number;
  drafts: number;
}

export interface ZonePerformance {
  zoneId: string;
  zoneName: string;
  toursScheduled: number;
  toursCompleted: number;
  showUpRate: number;
  drafts: number;
  closures: number;
}

export interface MemberPerformance {
  memberId: string;
  name: string;
  role: TeamMemberRole;
  zoneName: string;
  leadsAdded: number;
  toursScheduled: number;
  toursCompleted: number;
  showUpRate: number;
  drafts: number;
  closures: number;
  sameDayRate: number;
}

// MYT Lead Tracker
export type LeadStatus = "new" | "contacted" | "qualified" | "tour-scheduled" | "dead";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  area: string;
  budget: number;
  moveInDate: string;
  dateConfirmed: boolean;
  status: LeadStatus;
  mytQualified: boolean;
  addedBy: string;
  addedByName: string;
  createdAt: string;
  notes: string;
  // Marketplace fields
  budgetPowerScore?: number; // 0-100, vs zone median
  urgencyExpiresAt?: string; // ISO timestamp
  conversionProbability?: number; // 0-100
  claimedBy?: string | null; // TCM id who claimed
}

// Bookings
export type AgreementStatus = "pending" | "signed" | "moved-in";

export interface Booking {
  id: string;
  leadName: string;
  phone: string;
  propertyName: string;
  area: string;
  rentValue: number;
  viaTour: boolean;
  tourId: string | null;
  agreementStatus: AgreementStatus;
  closedBy: string;
  closedByName: string;
  createdAt: string;
}

// Cycle Tracker
export interface CycleData {
  cycleNumber: number;
  chatsClosed: number;
  mytLeads: number;
  toursScheduled: number;
  sameDayConfirmed: number;
}

// ============ INVENTORY OS ============

export type InventorySignal = "hot" | "balanced" | "cold";
export type RoomType = "single" | "double" | "triple" | "studio";

export interface Property {
  id: string;
  name: string;
  zoneId: string;
  area: string;
  address: string;
  basePrice: number; // per bed / month
  foodRating: number; // 0-5
  hygieneRating: number; // 0-5
  amenities: string[];
  ownerName: string;
  photoCount: number;
  pageViews: number; // last 7 days
  shares: number; // last 7 days
}

export interface Room {
  id: string;
  propertyId: string;
  type: RoomType;
  bedsTotal: number;
  bedsOccupied: number;
  currentPrice: number;
}

export type BlockStatus = "active" | "released" | "converted";

export interface RoomBlock {
  id: string;
  roomId: string;
  propertyId: string;
  tourId?: string;
  leadId?: string;
  leadName: string;
  intent: Intent;
  createdAt: string;
  expiresAt: string;
  status: BlockStatus;
}

export interface PropertyScores {
  propertyId: string;
  demandScore: number; // 0-100
  conversionScore: number; // 0-100
  velocityScore: number; // 0-100, days-to-fill inverted
  signal: InventorySignal;
  bedsTotal: number;
  bedsOccupied: number;
  bedsBlocked: number;
  bedsAvailable: number;
  occupancyPct: number;
  revenueWeek: number;
  missedRevenue: number;
  suggestedActions: string[];
}
