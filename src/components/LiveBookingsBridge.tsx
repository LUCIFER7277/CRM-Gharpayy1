import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent } from "@/lib/api/socket";
import type { DomainEvent } from "@/contracts";
import type { Booking as LegacyBooking, BookingStatus } from "@/lib/types";

function toLegacy(raw: any): LegacyBooking {
  return {
    id: raw._id,
    leadId: raw.leadId,
    tourId: raw.tourId,
    propertyId: raw.propertyId,
    tcmId: raw.tcmId,
    amount: raw.amount,
    tenantName: raw.tenantName ?? "",
    tenantPhone: raw.tenantPhone ?? "",
    deposit: raw.deposit ?? 0,
    moveInDate: raw.moveInDate ?? "",
    status: (raw.status as BookingStatus) ?? "pending",
    offerExpiresAt: raw.offerExpiresAt ?? null,
    paidRef: raw.paidRef ?? null,
    notes: raw.notes ?? "",
    ts: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function LiveBookingsBridge() {
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.bookings.list({ limit: 200 });
        if (cancelled) return;
        useApp.setState({ bookings: (r.items as any[]).map(toLegacy) });
      } catch (e) {
        if (!cancelled) useApp.setState({ bookings: [] });
      }
    };

    void load();

    const off = onEvent((e: DomainEvent) => {
      const cur = useApp.getState().bookings as LegacyBooking[];
      if (e.type === "evt.booking.created") {
        const b = toLegacy((e as any).payload.booking);
        const dupById = cur.find((x) => x.id === b.id);
        const dupByLead = cur.find((x) => x.leadId === b.leadId && x.id !== b.id);
        if (dupById) {
          return; // already have this exact booking
        }
        if (dupByLead) {
          // Replace local temp booking with server version
          useApp.setState({ bookings: cur.map((x) => (x.id === dupByLead.id ? b : x)) });
        } else {
          useApp.setState({ bookings: [b, ...cur] });
        }
      } else if (e.type === "evt.booking.updated") {
        useApp.setState({
          bookings: cur.map((x) =>
            x.id === (e as any).payload.bookingId
              ? { ...x, ...(e as any).payload.patch, updatedAt: new Date().toISOString() }
              : x,
          ),
        });
      } else if (e.type === "evt.booking.cancelled") {
        useApp.setState({
          bookings: cur.map((x) =>
            x.id === (e as any).payload.bookingId
              ? { ...x, status: "cancelled" as BookingStatus, updatedAt: new Date().toISOString() }
              : x,
          ),
        });
      }
    });

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; off(); clearInterval(interval); };
  }, []);

  return null;
}
