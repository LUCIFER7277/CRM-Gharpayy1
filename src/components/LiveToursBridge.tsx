import { useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import { useAppState } from "@/myt/lib/app-context";
import type { DomainEvent, Tour as WireTour, Lead as WireLead } from "@/contracts";
import type { Tour as MytTour } from "@/myt/lib/types";
import type { Property } from "@/lib/types";
import { resolvePropertyById, searchPropertyCatalog } from "@/lib/crm10x/property-catalog";
import { resolveBestLeadName } from "@/lib/lead-helpers";

type LiveTourEvent = {
  _id: string;
  leadId: string;
  lead?: {
    name: string;
    phone: string;
    budget: number;
  };
};

function isWireLead(value: unknown): value is WireLead {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate._id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.phone === "string" &&
    typeof candidate.budget === "number"
  );
}

function toWireTour(tour: LiveTourEvent & Partial<WireTour>): WireTour {
  return {
    _id: tour._id,
    leadId: tour.leadId,
    propertyId: tour.propertyId ?? null,
    assignedTo: tour.assignedTo ?? "",
    scheduledBy: tour.scheduledBy ?? "",
    scheduledAt: tour.scheduledAt ?? new Date().toISOString(),
    status: tour.status ?? "scheduled",
    showUp: tour.showUp ?? null,
    customPropertyName: tour.customPropertyName ?? "",
    tourType: tour.tourType ?? "physical",
    bookingSource: tour.bookingSource ?? "whatsapp",
    postTour: tour.postTour ?? {
      outcome: null,
      confidence: 0,
      objection: null,
      objectionNote: "",
      expectedDecisionAt: null,
      nextFollowUpAt: null,
      filledAt: null,
    },
    createdAt: tour.createdAt ?? new Date().toISOString(),
    updatedAt: tour.updatedAt ?? tour.createdAt ?? new Date().toISOString(),
    tenantId: tour.tenantId ?? "",
  };
}

function toMytTour(
  tour: WireTour,
  leads: Record<string, WireLead>,
  properties: Record<string, Property>,
  users: Record<string, string>,
): MytTour & { leadId: string } {
  const lead = leads[tour.leadId];
  const opsProperties = Object.values(properties);
  const property = tour.propertyId
    ? resolvePropertyById(tour.propertyId, opsProperties)
    : undefined;
  const fallbackProperty =
    tour.customPropertyName ||
    searchPropertyCatalog("", opsProperties, {
      preferredArea: lead?.preferredArea,
      limit: 1,
    })[0]?.name ||
    "Property Hub option";
  const dateObj = new Date(tour.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  const timePart = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  return {
    id: tour._id,
    leadId: tour.leadId,
    leadName: lead ? resolveBestLeadName(lead) : `Customer ${tour.leadId.slice(-4).toUpperCase()}`,
    phone: lead?.phone ?? "",
    assignedTo: tour.assignedTo,
    assignedToName: users[tour.assignedTo] ?? tour.assignedTo,
    propertyName: property?.name ?? fallbackProperty,
    propertyId: tour.propertyId ?? undefined,
    area: lead?.preferredArea ?? property?.area ?? "",
    zoneId: "",
    tourDate: datePart,
    tourTime: timePart,
    bookingSource: tour.bookingSource as MytTour["bookingSource"],
    scheduledBy: tour.scheduledBy,
    scheduledByName: users[tour.scheduledBy] ?? tour.scheduledBy,
    leadType: "future",
    status: tour.status as MytTour["status"],
    showUp: tour.showUp ?? null,
    outcome: tour.postTour?.outcome ?? null,
    remarks: tour.postTour?.objectionNote ?? "",
    budget: lead?.budget ?? 0,
    createdAt: tour.createdAt,
    tourType: (tour.tourType ?? "physical") as MytTour["tourType"],
    intent: "medium",
    confidenceScore: 50,
    confidenceReason: [],
    confirmationStrength: "tentative",
    qualification: {
      moveInDate: lead?.moveInDate ?? "",
      decisionMaker: "self",
      roomType: "Single",
      occupation: "",
      workLocation: lead?.preferredArea ?? "",
      willBookToday: "maybe",
      readyIn48h: false,
      exploring: false,
      comparing: false,
      needsFamily: false,
      keyConcern: "",
    },
    tokenPaid: false,
    whyLost: null,
  };
}

export function LiveToursBridge() {
  const { setTours } = useAppState();
  const currentToursRef = useRef<MytTour[]>([]);
  const leadMapRef = useRef<Record<string, WireLead>>({});
  const propertyMapRef = useRef<Record<string, Property>>({});
  const userMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stagger API calls to avoid rate limiting
        const toursRes = await api.tours.list();
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

        const leadsRes = await api.leads.list({ limit: 200 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const properties = await api.properties.list();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const usersRes = await api.users.listLite();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Fetch members and TCMs to ensure complete user name mapping
        const membersRes = await api.members.list().catch(() => []);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const tcmsRes = await api.tcms.list().catch(() => []);

        const leadMap: Record<string, WireLead> = {};
        leadsRes.items.filter(isWireLead).forEach((lead) => {
          leadMap[lead._id] = lead;
        });
        const propertyMap: Record<string, Property> = {};
        properties.forEach((property) => {
          propertyMap[property.id] = property;
        });
        const userMap: Record<string, string> = {};
        usersRes.items.forEach((user) => {
          userMap[user._id] = user.name;
        });
        // Include members and TCMs in the user map to ensure names are resolved correctly
        membersRes.forEach((member) => {
          userMap[member.id] = member.fullName;
        });
        tcmsRes.forEach((tcm) => {
          userMap[tcm.id] = tcm.fullName;
        });
        leadMapRef.current = leadMap;
        propertyMapRef.current = propertyMap;
        userMapRef.current = userMap;
        const mapped = toursRes.items.map((tour) => toMytTour(tour, leadMap, propertyMap, userMap));
        currentToursRef.current = mapped;
        setTours(mapped);

        // Identify missing leads and fetch them to hydrate names
        const missingLeadIds = Array.from(
          new Set(toursRes.items.filter((t) => !leadMap[t.leadId]).map((t) => t.leadId)),
        );

        if (missingLeadIds.length > 0) {
          Promise.all(missingLeadIds.map((id) => api.leads.get(id).catch(() => null))).then(
            (fetchedLeads) => {
              fetchedLeads.forEach((l) => {
                if (isWireLead(l)) leadMapRef.current[l._id] = l;
              });
              const remapped = currentToursRef.current.map((t) => {
                if (t.leadId && leadMapRef.current[t.leadId]) {
                  const wt = toursRes.items.find((wt) => wt._id === t.id);
                  if (wt)
                    return toMytTour(
                      wt,
                      leadMapRef.current,
                      propertyMapRef.current,
                      userMapRef.current,
                    );
                }
                return t;
              });
              currentToursRef.current = remapped;
              setTours(remapped);
            },
          );
        }
      } catch (err) {
        console.warn("[LiveToursBridge] failed to hydrate tours:", (err as Error).message);
      }
    };
    void fetchData();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      // Helper to hydrate a single tour's lead if missing
      const ensureLead = (tourId: string, leadId: string) => {
        if (!leadMapRef.current[leadId]) {
          api.leads
            .get(leadId)
            .then((fetchedLead) => {
              if (isWireLead(fetchedLead)) {
                leadMapRef.current[leadId] = fetchedLead;
                setTours((prev) => {
                  return prev.map((t) => {
                    if (t.id === tourId) {
                      return {
                        ...t,
                        leadName: fetchedLead.name,
                        phone: fetchedLead.phone ?? t.phone,
                        budget: fetchedLead.budget ?? t.budget,
                      };
                    }
                    return t;
                  });
                });
              }
            })
            .catch(() => null);
        }
      };

      if (e.type === "evt.tour.scheduled" && e.payload.tour) {
        const scheduledTour: LiveTourEvent & Partial<WireTour> = e.payload.tour;
        const tour = toWireTour(scheduledTour);
        if (scheduledTour.lead) {
          leadMapRef.current[scheduledTour.leadId] = {
            _id: scheduledTour.leadId,
            name: scheduledTour.lead.name,
            phone: scheduledTour.lead.phone,
            budget: scheduledTour.lead.budget,
            budgetText: "",
            source: "",
            preferredArea: "",
            zoneId: null,
            moveInDate: "",
            assignedTcmId: tour.assignedTo,
            stage: "tour-scheduled",
            intent: "warm",
            confidence: 50,
            tags: [],
            nextFollowUpAt: null,
            responseSpeedMins: 0,
            email: "",
            areas: [],
            fullAddress: "",
            type: "",
            room: "",
            need: "",
            inBLR: null,
            quality: null,
            specialReqs: "",
            notes: "",
            zoneCategory: "",
            assigneeId: tour.assignedTo,
            stageLabel: "",
            createdAt: tour.createdAt,
            updatedAt: tour.updatedAt,
            createdBy: tour.scheduledBy,
            tenantId: tour.tenantId,
            priorityScore: 0,
            priorityState: "COLD",
            nextBestAction: null,
            priorityReason: null,
          };
        }
        if (!leadMapRef.current[tour.leadId]) {
          api.leads
            .get(tour.leadId)
            .then((fetchedLead) => {
              if (isWireLead(fetchedLead)) {
                leadMapRef.current[tour.leadId] = fetchedLead;
                const mytTour = toMytTour(
                  tour,
                  leadMapRef.current,
                  propertyMapRef.current,
                  userMapRef.current,
                );
                setTours((prev) => {
                  if (prev.some((t) => t.id === mytTour.id)) {
                    return prev.map((t) => (t.id === mytTour.id ? { ...t, ...mytTour } : t));
                  }
                  currentToursRef.current = [mytTour, ...prev];
                  return [mytTour, ...prev];
                });
              }
            })
            .catch((err) => {
              console.warn("[LiveToursBridge] failed to fetch lead", tour.leadId, err);
              const mytTour = toMytTour(
                tour,
                leadMapRef.current,
                propertyMapRef.current,
                userMapRef.current,
              );
              setTours((prev) => {
                if (prev.some((t) => t.id === mytTour.id))
                  return prev.map((t) => (t.id === mytTour.id ? { ...t, ...mytTour } : t));
                currentToursRef.current = [mytTour, ...prev];
                return [mytTour, ...prev];
              });
            });
          return;
        }
        const mytTour = toMytTour(
          tour,
          leadMapRef.current,
          propertyMapRef.current,
          userMapRef.current,
        );
        setTours((prev) => {
          if (prev.some((t) => t.id === mytTour.id))
            return prev.map((t) => (t.id === mytTour.id ? { ...t, ...mytTour } : t));
          currentToursRef.current = [mytTour, ...prev];
          return [mytTour, ...prev];
        });
        return;
      }

      setTours((prev) => {
        let next = prev;
        if (e.type === "evt.tour.rescheduled") {
          next = prev.map((t) => {
            if (t.id !== e.payload.tourId) return t;
            const d = new Date(e.payload.scheduledAt);
            const pad = (n: number) => String(n).padStart(2, "0");
            return {
              ...t,
              tourDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
              tourTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
            };
          });
        } else if (e.type === "evt.tour.completed") {
          next = prev.map((t) => (t.id === e.payload.tourId ? { ...t, status: "completed" } : t));
        } else if (e.type === "evt.tour.cancelled") {
          next = prev.map((t) => (t.id === e.payload.tourId ? { ...t, status: "cancelled" } : t));
        } else if (e.type === "evt.tour.assignment_accepted") {
          next = prev.map((t) =>
            t.id === e.payload.tourId
              ? {
                  ...t,
                  assignedTo: e.payload.tcmId,
                  assignedToName: e.payload.assigneeName || e.payload.tcmId,
                }
              : t,
          );
        } else if (e.type === "evt.tour.updated") {
          const patch = (e.payload.patch as Partial<MytTour>) ?? {};
          next = prev.map((t) => (t.id === e.payload.tourId ? { ...t, ...patch } : t));
          // Post-process for lead name if still missing
          const existing = next.find((t) => t.id === e.payload.tourId);
          if (existing?.leadId && existing.leadName === existing.leadId) {
            ensureLead(existing.id, existing.leadId);
          }
        }
        currentToursRef.current = next;
        return next;
      });
    });

    return () => off();
  }, [setTours]);

  return null;
}
