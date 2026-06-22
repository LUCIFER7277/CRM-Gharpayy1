// Hydrates useApp().tours from the API (same backend as Impact Queue scheduleTour).
// LiveToursBridge only mounts on /myt/* — Impact Queue needs this bridge globally.
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { Tour as LegacyTour, TourStatus } from "@/lib/types";
import type { Tour as WireTour, DomainEvent } from "@/contracts";

function toLegacyTour(w: WireTour): LegacyTour {
  return {
    id: w._id,
    leadId: w.leadId,
    propertyId: w.propertyId ?? undefined,
    tcmId: w.assignedTo,
    scheduledBy: w.scheduledBy,
    scheduledAt: w.scheduledAt,
    status: w.status as TourStatus,
    showUp: w.showUp,
    customPropertyName: w.customPropertyName ?? "",
    decision: w.postTour?.outcome ?? null,
    postTour: w.postTour ?? {
      outcome: null,
      confidence: 0,
      objection: null,
      objectionNote: "",
      expectedDecisionAt: null,
      nextFollowUpAt: null,
      filledAt: null,
    },
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function isWireTour(value: unknown): value is WireTour {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return typeof t._id === "string" && typeof t.leadId === "string" && typeof t.scheduledAt === "string";
}

export function LiveToursAppBridge() {
  const setTours = useApp((s) => s.setTours);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.tours.list();
        if (cancelled) return;
        setTours(r.items.filter(isWireTour).map(toLegacyTour));
      } catch (e) {
        console.warn("[LiveToursAppBridge] load failed:", (e as Error).message);
        if (!cancelled) setTours([]);
      }
    };

    void load();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      const cur = useApp.getState().tours;

      if (e.type === "evt.tour.scheduled" && isWireTour(e.payload.tour)) {
        const tour = toLegacyTour(e.payload.tour);
        if (!cur.some((t) => t.id === tour.id)) setTours([tour, ...cur]);
        else setTours(cur.map((t) => (t.id === tour.id ? { ...t, ...tour } : t)));
        return;
      }

      if (e.type === "evt.tour.rescheduled") {
        setTours(
          cur.map((t) =>
            t.id === e.payload.tourId
              ? { ...t, scheduledAt: e.payload.scheduledAt, updatedAt: new Date().toISOString() }
              : t,
          ),
        );
        return;
      }

      if (e.type === "evt.tour.completed") {
        setTours(
          cur.map((t) =>
            t.id === e.payload.tourId
              ? { ...t, status: "completed", updatedAt: new Date().toISOString() }
              : t,
          ),
        );
        return;
      }

      if (e.type === "evt.tour.cancelled") {
        setTours(
          cur.map((t) =>
            t.id === e.payload.tourId
              ? { ...t, status: "cancelled", updatedAt: new Date().toISOString() }
              : t,
          ),
        );
        return;
      }

      if (e.type === "evt.tour.updated") {
        const patch = e.payload.patch as Partial<LegacyTour>;
        setTours(
          cur.map((t) =>
            t.id === e.payload.tourId
              ? { ...t, ...patch, updatedAt: new Date().toISOString() }
              : t,
          ),
        );
      }
    });

    const interval = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      off();
      clearInterval(interval);
    };
  }, [setTours]);

  return null;
}
