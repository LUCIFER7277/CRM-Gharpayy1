export type Gender = "male" | "female" | "other";
export type Occupation = "student" | "working" | "other";
export type SharingType = "single" | "double" | "triple" | "quad" | "studio";
export type RoomCategory = "ac" | "non-ac" | "premium" | "standard";

export type BookingLifecycle =
  | "created"
  | "shared_with_owner"
  | "viewed_by_owner"
  | "acknowledged"
  | "room_ready"
  | "move_in_approved"
  | "completed"
  | "rejected"
  | "cancelled";

export const LIFECYCLE_ORDER: BookingLifecycle[] = [
  "created",
  "shared_with_owner",
  "viewed_by_owner",
  "acknowledged",
  "room_ready",
  "move_in_approved",
  "completed",
];

export const LIFECYCLE_LABEL: Record<BookingLifecycle, string> = {
  created: "Created",
  shared_with_owner: "Shared with owner",
  viewed_by_owner: "Viewed by owner",
  acknowledged: "Acknowledged",
  room_ready: "Room ready",
  move_in_approved: "Move-in approved",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type OwnerDecision = "approve" | "approve_with_conditions" | "reject";

export type ReadinessKey =
  | "cleaning"
  | "furniture"
  | "internet"
  | "electricity"
  | "water"
  | "inspection";

export const READINESS_LABEL: Record<ReadinessKey, string> = {
  cleaning: "Cleaning",
  furniture: "Furniture",
  internet: "Internet",
  electricity: "Electricity",
  water: "Water",
  inspection: "Final Inspection",
};

export type ReadinessStatus = "pending" | "ready";

export type ChargeStatus = "received" | "pending" | "waived";

export interface PaymentLine {
  id: string;
  label: string;
  amount: number;
  status: ChargeStatus;
  receivedAt?: string;
}

export interface SpecialRequest {
  id: string;
  text: string;
  honored?: boolean;
}

export interface OwnerBookingHistory {
  ts: string;
  actor: string;
  text: string;
}

export interface OwnerBooking {
  id: string;
  status: BookingLifecycle;
  createdAt: string;
  updatedAt: string;
  sharedAt?: string;
  viewedAt?: string;
  acknowledgedAt?: string;
  readyAt?: string;
  moveInApprovedAt?: string;
  completedAt?: string;

  customer: {
    name: string;
    phone: string;
    gender: Gender;
    occupation: Occupation;
    companyOrCollege?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  };

  inventory: {
    propertyId: string;
    propertyName: string;
    floor: string;
    roomNumber: string;
    bedNumber: string;
    sharing: SharingType;
    category: RoomCategory;
  };

  ownerId: string;

  rent: number;
  deposit: number;
  payments: PaymentLine[];

  moveIn: {
    date: string;
    time: string;
    stayMonths: number;
    lockInMonths: number;
    noticeDays: number;
  };

  specialRequests: SpecialRequest[];

  ownerDecision?: OwnerDecision;
  ownerDecisionAt?: string;
  ownerConditionNote?: string;
  ownerRejectionReason?: string;

  readiness: Record<ReadinessKey, ReadinessStatus>;
  readinessNote?: string;

  history: OwnerBookingHistory[];

  leadId?: string;
  tourId?: string;
  createdBy?: string;
}

export interface OwnerBookingTotals {
  expected: number;
  received: number;
  pending: number;
  readyCount: number;
  totalReadiness: number;
  isFullyReady: boolean;
  isFullyPaid: boolean;
  canConfirm: boolean;
}
