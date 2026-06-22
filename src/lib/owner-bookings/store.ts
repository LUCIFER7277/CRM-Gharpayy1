import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  OwnerBooking,
  BookingLifecycle,
  ReadinessKey,
  ReadinessStatus,
  PaymentLine,
  OwnerDecision,
  OwnerBookingTotals,
} from "./types";
import { READINESS_LABEL } from "./types";

const STORAGE_KEY = "gharpayy.owner-bookings.v1";

const uid = () => `obk-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

const baseReadiness: Record<ReadinessKey, ReadinessStatus> = {
  cleaning: "pending",
  furniture: "pending",
  internet: "pending",
  electricity: "pending",
  water: "pending",
  inspection: "pending",
};

interface State {
  bookings: OwnerBooking[];
  createBooking: (input: Omit<OwnerBooking, "id" | "status" | "createdAt" | "updatedAt" | "history" | "readiness">) => OwnerBooking;
  updateBooking: (id: string, patch: Partial<OwnerBooking>) => void;
  shareWithOwner: (id: string, actor?: string) => void;
  markViewed: (id: string, actor?: string) => void;
  recordOwnerDecision: (id: string, decision: OwnerDecision, note?: string, actor?: string) => void;
  setReadiness: (id: string, key: ReadinessKey, status: ReadinessStatus, actor?: string) => void;
  markAllReady: (id: string, actor?: string) => void;
  markPaymentReceived: (id: string, paymentId: string, actor?: string) => void;
  addPaymentLine: (id: string, line: Omit<PaymentLine, "id">) => void;
  approveMoveIn: (id: string, actor?: string) => void;
  completeBooking: (id: string, actor?: string) => void;
  cancelBooking: (id: string, reason: string, actor?: string) => void;
  appendHistory: (id: string, actor: string, text: string) => void;
  hardReset: () => void;
}

export const useOwnerBookings = create<State>()(
  persist(
    (set, get) => ({
      bookings: [],

      createBooking: (input) => {
        const b: OwnerBooking = {
          ...input,
          id: uid(),
          status: "created",
          createdAt: now(),
          updatedAt: now(),
          readiness: { ...baseReadiness },
          history: [{ ts: now(), actor: `sales:${input.createdBy ?? "ops"}`, text: "Booking created" }],
        };
        set((s) => ({ bookings: [b, ...s.bookings] }));
        return b;
      },

      updateBooking: (id, patch) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: now() } : b)),
        })),

      shareWithOwner: (id, actor = "system") => {
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: b.status === "created" ? "shared_with_owner" : b.status,
                  sharedAt: b.sharedAt ?? now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Shared with owner" }],
                }
              : b,
          ),
        }));
      },

      markViewed: (id, actor = "owner") => {
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id && !b.viewedAt
              ? {
                  ...b,
                  status: b.status === "shared_with_owner" ? "viewed_by_owner" : b.status,
                  viewedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Viewed booking card" }],
                }
              : b,
          ),
        }));
      },

      recordOwnerDecision: (id, decision, note, actor = "owner") => {
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const nextStatus: BookingLifecycle =
              decision === "reject" ? "rejected" : "acknowledged";
            const text =
              decision === "approve"
                ? "Approved booking"
                : decision === "approve_with_conditions"
                ? `Approved with conditions: ${note ?? ""}`
                : `Rejected: ${note ?? "no reason"}`;
            return {
              ...b,
              status: nextStatus,
              ownerDecision: decision,
              ownerDecisionAt: now(),
              ownerConditionNote: decision === "approve_with_conditions" ? note : b.ownerConditionNote,
              ownerRejectionReason: decision === "reject" ? note : b.ownerRejectionReason,
              updatedAt: now(),
              history: [...b.history, { ts: now(), actor, text }],
            };
          }),
        }));
      },

      setReadiness: (id, key, status, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const readiness = { ...b.readiness, [key]: status };
            const allReady = Object.values(readiness).every((v) => v === "ready");
            return {
              ...b,
              readiness,
              status: allReady && b.status === "acknowledged" ? "room_ready" : b.status,
              readyAt: allReady ? (b.readyAt ?? now()) : b.readyAt,
              updatedAt: now(),
              history: [
                ...b.history,
                { ts: now(), actor, text: `${READINESS_LABEL[key]} → ${status}` },
              ],
            };
          }),
        })),

      markAllReady: (id, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const readiness: typeof b.readiness = {
              cleaning: "ready", furniture: "ready", internet: "ready",
              electricity: "ready", water: "ready", inspection: "ready",
            };
            return {
              ...b,
              readiness,
              status: b.status === "acknowledged" ? "room_ready" : b.status,
              readyAt: now(),
              updatedAt: now(),
              history: [...b.history, { ts: now(), actor, text: "Marked all readiness checks complete" }],
            };
          }),
        })),

      markPaymentReceived: (id, paymentId, actor = "sales") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const payments = b.payments.map((p) =>
              p.id === paymentId ? { ...p, status: "received" as const, receivedAt: now() } : p,
            );
            const line = b.payments.find((p) => p.id === paymentId);
            return {
              ...b,
              payments,
              updatedAt: now(),
              history: [
                ...b.history,
                { ts: now(), actor, text: `Payment received: ${line?.label ?? ""} ₹${line?.amount.toLocaleString("en-IN") ?? ""}` },
              ],
            };
          }),
        })),

      addPaymentLine: (id, line) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, payments: [...b.payments, { ...line, id: uid() }], updatedAt: now() }
              : b,
          ),
        })),

      approveMoveIn: (id, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "move_in_approved",
                  moveInApprovedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Move-in approved" }],
                }
              : b,
          ),
        })),

      completeBooking: (id, actor = "system") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "completed",
                  completedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Customer checked in — booking complete" }],
                }
              : b,
          ),
        })),

      cancelBooking: (id, reason, actor = "sales") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "cancelled",
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: `Cancelled: ${reason}` }],
                }
              : b,
          ),
        })),

      appendHistory: (id, actor, text) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, history: [...b.history, { ts: now(), actor, text }], updatedAt: now() }
              : b,
          ),
        })),

      hardReset: () => {
        set({ bookings: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      merge: (persisted, current) => {
        const pb = (persisted as any)?.bookings ?? [];
        const cb = (current as any)?.bookings ?? [];
        const byId = new Map<string, OwnerBooking>();
        for (const b of [...pb, ...cb]) byId.set(b.id, b);
        return { ...current, ...(persisted as any), bookings: Array.from(byId.values()) };
      },
    },
  ),
);

export function hardResetOwnerBookings() {
  if (typeof window !== "undefined") {
    useOwnerBookings.getState().hardReset();
    useOwnerBookings.persist.clearStorage();
  }
}

export function computeTotals(b: OwnerBooking): OwnerBookingTotals {
  const expected = b.payments.reduce((s, p) => s + (p.status === "waived" ? 0 : p.amount), 0);
  const received = b.payments.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0);
  const pending = expected - received;
  const readinessVals = Object.values(b.readiness);
  const readyCount = readinessVals.filter((v) => v === "ready").length;
  const totalReadiness = readinessVals.length;
  const isFullyReady = readyCount === totalReadiness;
  const isFullyPaid = pending <= 0;
  const canConfirm =
    b.ownerDecision === "approve" || b.ownerDecision === "approve_with_conditions"
      ? isFullyReady
      : false;
  return { expected, received, pending, readyCount, totalReadiness, isFullyReady, isFullyPaid, canConfirm };
}
