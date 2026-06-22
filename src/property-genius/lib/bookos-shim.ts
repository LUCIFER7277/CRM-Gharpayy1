// Minimal shim for the few helpers ScheduleVisit + visits.ts pull from
// the original property-genius `lib/bookos.ts`. The full bookos store is
// intentionally NOT carried over — the main Impact Queue / CRM store
// already owns bookings, payments, activity, notifications.

import { PGS } from "@/property-genius/data/pgs";

export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export function pgName(id: string) {
  return PGS.find((p) => p.id === id)?.name ?? id;
}

// No-op stubs — the real CRM store handles activity + notifications.
export function logActivity(_action: string, _entity: string, _ref?: string, _actor = "you") {
  /* bridged to main store in higher-level integration */
}

export function pushNotification(_n: unknown) {
  /* bridged to main store in higher-level integration */
}
