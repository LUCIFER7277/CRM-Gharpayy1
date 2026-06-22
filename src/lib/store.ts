import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActivityLog,
  FollowUp,
  Lead,
  Property,
  Role,
  TCM,
  Tour,
  PostTourUpdate,
  ClientDecision,
  LeadStage,
  Intent,
  HandoffMessage,
  ActiveSequence,
  SequenceKind,
  Booking,
  Tenant,
  RentRecord,
  PaymentRecord,
  BookingStatus,
  TenantStatus,
  RentStatus,
} from "./types";
import type { Todo } from "@/contracts";
import { ACTIVITIES, FOLLOWUPS, PROPERTIES, TCMS, HANDOFFS, SEQUENCES_INIT } from "./mock-data";
import { autoAssign as autoAssignFn } from "./routing";
import { api } from "@/lib/api/client";
import { isTodayIST } from "@/lib/crm10x/dates";
import type { LeadFocusAction } from "@/lib/crm10x/impact-hard-actions";

import { emit as emitConnector } from "./connectors";
import { personName } from "./people";
import { normalizeLeadRecord } from "./lead-helpers";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 14)}`;

type AddLeadInput = {
  id?: string;
  name: string;
  phone: string;
  source?: string;
  budget: number;
  budgetText?: string;
  preferredArea: string;
  moveInDate?: string;
  intent?: Intent;
  assignedTcmId?: string;
  assigneeId?: string | null;
  createdBy?: string | null;
  stage?: LeadStage;
  confidence?: number;
  tags?: string[];
  nextFollowUpAt?: string | null;
  responseSpeedMins?: number;
  createdAt?: string;
  updatedAt?: string;
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
};

type AddPropertyInput = Omit<Property, "id" | "daysSinceLastBooking" | "zoneId" | "address"> &
  Partial<Pick<Property, "zoneId" | "address">>;

interface AppState {
  role: Role;
  currentTcmId: string;
  setRole: (r: Role) => void;
  setCurrentTcmId: (id: string) => void;

  selectedLeadId: string | null;
  selectedLeadTab: string | null;
  selectedLeadAction: LeadFocusAction | null;
  selectLead: (id: string | null, tab?: string | null, action?: LeadFocusAction | null) => void;
  consumeSelectedLeadAction: () => void;

  tcms: TCM[];
  setTcms: (tcms: TCM[]) => void;
  properties: Property[];
  leads: Lead[];
  tours: Tour[];
  activities: ActivityLog[];
  followUps: FollowUp[];
  handoffs: HandoffMessage[];
  sequences: ActiveSequence[];
  bookings: Booking[];
  tenants: Tenant[];
  rents: RentRecord[];
  payments: PaymentRecord[];
  todos: Todo[];

  addLead: (input: AddLeadInput) => Lead;
  setLeads: (leads: Lead[]) => void;
  setTours: (tours: Tour[]) => void;
  setProperties: (properties: Property[]) => void;
  setActivities: (activities: ActivityLog[]) => void;
  setFollowUps: (followUps: FollowUp[]) => void;
  setHandoffs: (handoffs: HandoffMessage[]) => void;
  setSequences: (sequences: ActiveSequence[]) => void;
  setTodos: (todos: Todo[]) => void;
  setLeadStage: (leadId: string, stage: LeadStage) => Promise<void>;
  setLeadIntent: (leadId: string, intent: Intent) => void;
  setLeadFollowUp: (
    leadId: string,
    dueAt: string,
    priority: FollowUp["priority"],
    reason?: string,
  ) => void;
  addLeadTag: (leadId: string, tag: string) => void;
  removeLeadTag: (leadId: string, tag: string) => void;
  reassignLead: (leadId: string, tcmId: string, reason: string) => void;
  autoAssignLead: (leadId: string) => { tcmId: string; reasons: string[] };

  scheduleTour: (input: {
    leadId: string;
    propertyId?: string;
    tcmId: string;
    scheduledAt: string;
    tourType?: Tour["tourType"];
  }) => Promise<Tour>;
  cancelTour: (tourId: string) => Promise<void>;
  rescheduleTour: (tourId: string, scheduledAt: string) => Promise<void>;
  completeTour: (tourId: string) => Promise<void>;
  markTourStarted: (tourId: string) => Promise<void>;
  updateTourDetails: (tourId: string, patch: Partial<Tour>) => Promise<void>;

  setDecision: (tourId: string, decision: ClientDecision) => void;
  updatePostTour: (tourId: string, patch: Partial<PostTourUpdate>) => Promise<void>;

  addNote: (leadId: string, note: string, tourId?: string) => void;
  logCall: (leadId: string) => void;
  sendMessage: (leadId: string, text: string) => void;

  completeFollowUp: (followUpId: string) => void;
  addFollowUp: (input: Omit<FollowUp, "id" | "done">) => void;

  sendHandoff: (input: {
    leadId: string;
    from: Role;
    fromId: string;
    text: string;
    priority: "normal" | "urgent";
  }) => void;
  markHandoffsRead: (leadId: string) => void;

  startSequence: (leadId: string, kind: SequenceKind) => void;
  toggleSequencePause: (leadId: string) => void;
  stopSequence: (leadId: string, reason: string) => void;
  advanceSequenceStep: (leadId: string) => void;

  closeDeal: (input: {
    leadId: string;
    tourId: string;
    propertyId: string;
    tcmId: string;
    amount: number;
  }) => void;

  // Booking/Tenant management
  addTenant: (input: Omit<Tenant, "id" | "createdAt" | "updatedAt">) => Tenant;
  updateTenantStatus: (tenantId: string, status: TenantStatus, exitDate?: string) => void;
  updateTenant: (tenantId: string, patch: Partial<Tenant>) => void;
  recordRentPayment: (input: Omit<RentRecord, "id" | "createdAt">) => RentRecord;
  recordPayment: (input: Omit<PaymentRecord, "id" | "createdAt">) => PaymentRecord;
  approveBooking: (bookingId: string) => void;
  markBookingPaid: (bookingId: string, ref: string) => void;
  cancelBooking: (bookingId: string) => void;

  addProperty: (input: AddPropertyInput) => Property;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      role: "flow-ops",
  currentTcmId: "tcm-1",
  setRole: (r) => set({ role: r }),
  setCurrentTcmId: (id) => set({ currentTcmId: id }),

  selectedLeadId: null,
  selectedLeadTab: null,
  selectedLeadAction: null,
  selectLead: (id, tab = null, action = null) =>
    set({
      selectedLeadId: id,
      selectedLeadTab: id ? tab : null,
      selectedLeadAction: id ? action : null,
    }),
  consumeSelectedLeadAction: () => set({ selectedLeadAction: null }),

  tcms: TCMS,
  setTcms: (tcms) => set({ tcms }),
  properties: PROPERTIES,
  // Leads + tours hydrated from Mongo by LiveLeadsBridge / LiveToursAppBridge.
  leads: [],
  tours: [],
  activities: ACTIVITIES,
  followUps: FOLLOWUPS,
  handoffs: HANDOFFS,
  sequences: SEQUENCES_INIT,
  bookings: [],
  tenants: [],
  rents: [],
  payments: [],
  todos: [],

  setProperties: (properties) => set({ properties }),
  setActivities: (activities) => set({ activities }),
  setFollowUps: (followUps) => set({ followUps }),
  setHandoffs: (handoffs) => set({ handoffs }),
  setSequences: (sequences) => set({ sequences }),
  setTodos: (todos) => set({ todos }),

  addLead: (input) => {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: input.id ?? uid("lead"),
      name: normalizeLeadRecord({ name: input.name }).name,
      phone: input.phone,
      source: input.source ?? "manual",
      budget: input.budget,
      budgetText: input.budgetText,
      moveInDate: input.moveInDate ?? now,
      preferredArea: input.preferredArea,
      assignedTcmId: input.assignedTcmId ?? get().currentTcmId,
      assigneeId: input.assigneeId ?? input.assignedTcmId ?? null,
      createdBy: input.createdBy ?? null,
      stage: input.stage ?? "new",
      intent: input.intent ?? "warm",
      confidence:
        input.confidence ?? (input.intent === "hot" ? 75 : input.intent === "cold" ? 25 : 50),
      tags: input.tags ?? [],
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      responseSpeedMins: input.responseSpeedMins ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      lastContactAt: input.createdAt ?? now,
      email: input.email,
      areas: input.areas,
      fullAddress: input.fullAddress,
      type: input.type,
      room: input.room,
      need: input.need,
      inBLR: input.inBLR,
      quality: input.quality,
      specialReqs: input.specialReqs,
      notes: input.notes,
      zoneCategory: input.zoneCategory,
      stageLabel: input.stageLabel,
    };
    set((s) => ({
      leads: s.leads.some((existing) => existing.id === lead.id)
        ? s.leads.map((existing) => (existing.id === lead.id ? { ...existing, ...lead } : existing))
        : [lead, ...s.leads],
    }));
    return lead;
  },
  setLeads: (leads: Lead[]) => set({ leads: leads.map(normalizeLeadRecord) }),
  setTours: (tours: Tour[]) => set({ tours }),

  setLeadStage: async (leadId, stage) => {
    const prevLead = get().leads.find((l) => l.id === leadId);
    if (!prevLead) return;

    // Optimistic UI so status changes feel instant.
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, stage, updatedAt: new Date().toISOString() } : l,
      ),
    }));

    try {
      await api.command({
        _id: uid("c"),
        type: "cmd.lead.change_stage",
        issuedAt: new Date().toISOString(),
        payload: { leadId, to: stage },
      });

      pushActivity(set, get, {
        kind: "status_changed",
        actor: get().role,
        leadId,
        text: `Status changed to ${stage}`,
      });
    } catch (err) {
      // Roll back optimistic state if server persistence fails.
      set((s) => ({
        leads: s.leads.map((l) =>
          l.id === leadId ? { ...l, stage: prevLead.stage, updatedAt: prevLead.updatedAt } : l,
        ),
      }));
      throw err;
    }
  },

  setLeadIntent: (leadId, intent) => {
    set((s) => ({
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, intent } : l)),
    }));
  },

  setLeadFollowUp: (leadId, dueAt, priority, reason = "Manual follow-up") => {
    set((s) => ({
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, nextFollowUpAt: dueAt } : l)),
    }));
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) return;
    const f: FollowUp = {
      id: uid("f"),
      leadId,
      tcmId: lead.assignedTcmId,
      dueAt,
      priority,
      reason,
      done: false,
    };
    set((s) => ({ followUps: [f, ...s.followUps] }));
    pushActivity(set, get, {
      kind: "follow_up_set",
      actor: get().role,
      leadId,
      text: `Follow-up set: ${reason}`,
    });
  },

  addLeadTag: (leadId, tag) => {
    const prevLead = get().leads.find((l) => l.id === leadId);
    if (!prevLead || prevLead.tags.includes(tag)) return;
    const nextTags = [...prevLead.tags, tag];
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, tags: nextTags, updatedAt: new Date().toISOString() } : l,
      ),
    }));
    void api
      .command({
        _id: uid("c"),
        type: "cmd.lead.update",
        issuedAt: new Date().toISOString(),
        payload: { leadId, patch: { tags: nextTags } },
      })
      .catch(() => {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === leadId ? prevLead : l)),
        }));
      });
  },

  removeLeadTag: (leadId, tag) => {
    const prevLead = get().leads.find((l) => l.id === leadId);
    if (!prevLead || !prevLead.tags.includes(tag)) return;
    const nextTags = prevLead.tags.filter((t) => t !== tag);
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, tags: nextTags, updatedAt: new Date().toISOString() } : l,
      ),
    }));
    void api
      .command({
        _id: uid("c"),
        type: "cmd.lead.update",
        issuedAt: new Date().toISOString(),
        payload: { leadId, patch: { tags: nextTags } },
      })
      .catch(() => {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === leadId ? prevLead : l)),
        }));
      });
  },

  scheduleTour: async ({ leadId, propertyId, tcmId, scheduledAt, tourType = "physical" }) => {
    const lead = get().leads.find((l) => l.id === leadId)!;
    const cmd = {
      _id: uid("c"),
      type: "cmd.tour.schedule",
      issuedAt: new Date().toISOString(),
      payload: {
        leadId,
        propertyId: propertyId ?? null,
        tcmId,
        scheduledAt,
        bookingSource: "whatsapp",
        tourType,
      },
    };
    const result = await api.command<Record<string, unknown>>(cmd);

    // The server dispatch returns { ok, eventIds, data: { tour } }.
    // Handle both direct and nested shapes defensively.
    const rawResult = result as any;
    if (rawResult.ok === false) {
      throw new Error(rawResult.error ?? "Tour scheduling failed on server");
    }
    const wireTour = rawResult.data?.tour ?? rawResult.tour;
    if (!wireTour?._id) {
      console.error("[store.scheduleTour] Unexpected response shape:", JSON.stringify(result));
      throw new Error("Server did not return tour data");
    }

    const tour = {
      id: wireTour._id,
      leadId: wireTour.leadId,
      propertyId: wireTour.propertyId ?? undefined,
      tcmId: wireTour.assignedTo,
      scheduledBy: wireTour.scheduledBy,
      scheduledAt: wireTour.scheduledAt,
      tourType: wireTour.tourType ?? tourType,
      status: wireTour.status as Tour["status"],
      decision: null,
      postTour: {
        outcome: null,
        confidence: 0,
        objection: null,
        objectionNote: "",
        expectedDecisionAt: null,
        nextFollowUpAt: null,
        filledAt: null,
      },
      createdAt: wireTour.createdAt,
      updatedAt: wireTour.updatedAt,
    };

    set((s) => ({
      tours: s.tours.some((x) => x.id === tour.id)
        ? s.tours.map((x) => (x.id === tour.id ? { ...x, ...tour } : x))
        : [tour, ...s.tours],
      leads: s.leads.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: isTodayIST(scheduledAt) ? "on-tour" : "tour-scheduled",
              tourDate: scheduledAt,
              updatedAt: new Date().toISOString(),
            }
          : l,
      ),
    }));
    pushActivity(set, get, {
      kind: "tour_scheduled",
      actor: tcmId,
      leadId,
      tourId: tour.id,
      propertyId,
      text: `Tour scheduled for ${lead.name}`,
    });
    pushActivity(set, get, {
      kind: "message_sent",
      actor: "system",
      leadId,
      tourId: tour.id,
      text: `Auto WhatsApp confirmation sent to ${lead.name}`,
    });
    const actorRole = get().role;
    const actorId = actorRole === "tcm" ? get().currentTcmId : actorRole;
    emitConnector({
      kind: "tour.scheduled",
      actorRole,
      actorId,
      leadId,
      tourId: tour.id,
      propertyId,
      text: `${personName(actorId, "Someone")} scheduled tour for ${lead.name}`,
      assists:
        actorRole === "flow-ops"
          ? [{ role: "tcm", id: tcmId }]
          : actorRole === "tcm" && tcmId !== actorId
            ? [{ role: "tcm", id: tcmId }]
            : undefined,
    });
    if (isTodayIST(scheduledAt)) {
      await api.command({
        _id: uid("c"),
        type: "cmd.lead.change_stage",
        issuedAt: new Date().toISOString(),
        payload: { leadId, to: "on-tour", tourId: tour.id },
      });
      pushActivity(set, get, {
        kind: "tour_started",
        actor: tcmId,
        leadId,
        tourId: tour.id,
        text: "Tour day — auto moved to on tour",
      });
    }
    return tour;
  },

  cancelTour: async (tourId) => {
    const result = await api.command({
      _id: uid("c"),
      type: "cmd.tour.cancel",
      issuedAt: new Date().toISOString(),
      payload: { tourId },
    });
    if ((result as any)?.ok === false) {
      throw new Error((result as any).error ?? "Tour cancel failed on server");
    }
    const t = get().tours.find((x) => x.id === tourId);
    if (!t) return;
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, status: "cancelled", updatedAt: new Date().toISOString() } : x,
      ),
      leads: s.leads.map((lead) => {
        if (lead.id !== t.leadId) return lead;
        const hasOtherActiveTour = s.tours.some(
          (tour) =>
            tour.id !== tourId &&
            tour.leadId === t.leadId &&
            (tour.status === "scheduled" || tour.status === "confirmed"),
        );
        if (hasOtherActiveTour || (lead.stage !== "tour-scheduled" && lead.stage !== "on-tour"))
          return lead;
        return {
          ...lead,
          stage: "contacted",
          tourDate: undefined,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    pushActivity(set, get, {
      kind: "tour_cancelled",
      actor: get().role,
      leadId: t.leadId,
      tourId,
      text: "Tour cancelled",
    });
  },

  rescheduleTour: async (tourId, scheduledAt) => {
    await api.command({
      _id: uid("c"),
      type: "cmd.tour.reschedule",
      issuedAt: new Date().toISOString(),
      payload: { tourId, scheduledAt },
    });
    const t = get().tours.find((x) => x.id === tourId);
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, scheduledAt, updatedAt: new Date().toISOString() } : x,
      ),
      leads: t
        ? s.leads.map((l) =>
            l.id === t.leadId
              ? {
                  ...l,
                  stage: isTodayIST(scheduledAt)
                    ? "on-tour"
                    : l.stage === "on-tour"
                      ? "tour-scheduled"
                      : l.stage,
                  tourDate: scheduledAt,
                  updatedAt: new Date().toISOString(),
                }
              : l,
          )
        : s.leads,
    }));
    if (t) {
      pushActivity(set, get, {
        kind: "tour_scheduled",
        actor: get().role,
        leadId: t.leadId,
        tourId,
        text: "Tour rescheduled",
      });
      if (isTodayIST(scheduledAt) && t.status === "scheduled") {
        await get().markTourStarted(tourId);
      }
    }
  },

  completeTour: async (tourId) => {
    await api.command({
      _id: uid("c"),
      type: "cmd.tour.complete",
      issuedAt: new Date().toISOString(),
      payload: { tourId },
    });
    const t = get().tours.find((x) => x.id === tourId);
    if (!t) return;
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, status: "completed", updatedAt: new Date().toISOString() } : x,
      ),
      leads: s.leads.map((l) =>
        l.id === t.leadId ? { ...l, stage: "tour-done", updatedAt: new Date().toISOString() } : l,
      ),
    }));
    pushActivity(set, get, {
      kind: "tour_completed",
      actor: t.tcmId,
      leadId: t.leadId,
      tourId,
      text: "Tour marked completed",
    });
    const lead = get().leads.find((l) => l.id === t.leadId);
    emitConnector({
      kind: "tour.completed",
      actorRole: "tcm",
      actorId: t.tcmId,
      leadId: t.leadId,
      tourId,
      propertyId: t.propertyId ?? undefined,
      text: `${personName(t.tcmId, "TCM")} completed tour with ${lead?.name ?? "lead"}`,
    });
  },

  updateTourDetails: async (tourId, patch) => {
    await api.command({
      _id: uid("c"),
      type: "cmd.tour.update",
      issuedAt: new Date().toISOString(),
      payload: { tourId, patch },
    });
    const t = get().tours.find((x) => x.id === tourId);
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x,
      ),
      leads:
        t && patch.status === "no-show"
          ? s.leads.map((l) =>
              l.id === t.leadId
                ? { ...l, stage: "contacted", updatedAt: new Date().toISOString() }
                : l,
            )
          : s.leads,
    }));
    if (t && patch.status === "no-show") {
      void api
        .command({
          _id: uid("c"),
          type: "cmd.lead.change_stage",
          issuedAt: new Date().toISOString(),
          payload: { leadId: t.leadId, to: "contacted", tourId },
        })
        .catch(() => {});
      pushActivity(set, get, {
        kind: "tour_cancelled",
        actor: t.tcmId,
        leadId: t.leadId,
        tourId,
        text: "Tour marked no-show",
      });
    }
  },

  markTourStarted: async (tourId) => {
    const t = get().tours.find((x) => x.id === tourId);
    if (!t) return;
    const previousLead = get().leads.find((l) => l.id === t.leadId);
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === t.leadId
          ? { ...l, stage: "on-tour", tourDate: t.scheduledAt, updatedAt: new Date().toISOString() }
          : l,
      ),
    }));
    try {
      await api.command({
        _id: uid("c"),
        type: "cmd.lead.change_stage",
        issuedAt: new Date().toISOString(),
        payload: { leadId: t.leadId, to: "on-tour" },
      });
      pushActivity(set, get, {
        kind: "tour_started",
        actor: t.tcmId,
        leadId: t.leadId,
        tourId,
        text: "Tour marked live",
      });
    } catch (err) {
      if (previousLead) {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === previousLead.id ? previousLead : l)),
        }));
      }
      throw err;
    }
  },

  setDecision: (tourId, decision) => {
    const t = get().tours.find((x) => x.id === tourId);
    if (!t) return;
    const nextStage: LeadStage =
      decision === "booked" ? "booked" : decision === "dropped" ? "dropped" : "negotiation";
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, decision, updatedAt: new Date().toISOString() } : x,
      ),
      leads: s.leads.map((l) =>
        l.id === t.leadId
          ? {
              ...l,
              stage: nextStage,
              updatedAt: new Date().toISOString(),
            }
          : l,
      ),
    }));
    void api
      .command({
        _id: uid("c"),
        type: "cmd.lead.change_stage",
        issuedAt: new Date().toISOString(),
        payload: { leadId: t.leadId, to: nextStage },
      })
      .catch(() => {});
    pushActivity(set, get, {
      kind: "decision_logged",
      actor: t.tcmId,
      leadId: t.leadId,
      tourId,
      text: `Decision: ${decision ?? "-"}`,
    });
  },

  updatePostTour: async (tourId, patch) => {
    await api.command({
      _id: uid("c"),
      type: "cmd.tour.update_post_tour",
      issuedAt: new Date().toISOString(),
      payload: { tourId, patch },
    });
    const t = get().tours.find((x) => x.id === tourId);
    if (!t) return;
    const prevObjection = t.postTour.objection;
    const next: PostTourUpdate = { ...t.postTour, ...patch };
    const complete =
      next.outcome !== null &&
      next.outcome !== "awaiting" &&
      next.confidence > 0 &&
      next.expectedDecisionAt !== null &&
      next.nextFollowUpAt !== null;
    if (complete && !next.filledAt) {
      next.filledAt = new Date().toISOString();
      pushActivity(set, get, {
        kind: "post_tour_filled",
        actor: t.tcmId,
        leadId: t.leadId,
        tourId,
        text: "Post-tour form completed",
      });
      const lead = get().leads.find((l) => l.id === t.leadId);
      emitConnector({
        kind: "post_tour.filled",
        actorRole: "tcm",
        actorId: t.tcmId,
        leadId: t.leadId,
        tourId,
        propertyId: t.propertyId ?? undefined,
        text: `${personName(t.tcmId, "TCM")} closed post-tour loop · ${lead?.name ?? ""}`.trim(),
      });
    }
    set((s) => ({
      tours: s.tours.map((x) =>
        x.id === tourId ? { ...x, postTour: next, updatedAt: new Date().toISOString() } : x,
      ),
      leads: s.leads.map((l) =>
        l.id === t.leadId
          ? {
              ...l,
              confidence: next.confidence > 0 ? next.confidence : l.confidence,
              nextFollowUpAt: next.nextFollowUpAt ?? l.nextFollowUpAt,
            }
          : l,
      ),
    }));
    if (next.nextFollowUpAt) {
      const exists = get().followUps.find((f) => f.tourId === tourId && !f.done);
      if (!exists) {
        const f: FollowUp = {
          id: uid("f"),
          tourId,
          leadId: t.leadId,
          tcmId: t.tcmId,
          dueAt: next.nextFollowUpAt,
          priority: next.confidence >= 75 ? "high" : next.confidence >= 50 ? "medium" : "low",
          reason: "Post-tour scheduled follow-up",
          done: false,
        };
        set((s) => ({ followUps: [f, ...s.followUps] }));
      }
    }
    if (next.objection && next.objection !== prevObjection) {
      // Objection logged — could bridge to owner notification system
    }
  },

  addNote: (leadId, note, tourId) => {
    pushActivity(set, get, { kind: "note_added", actor: get().role, leadId, tourId, text: note });
  },

  logCall: (leadId) => {
    const now = new Date().toISOString();
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, lastContactAt: now, updatedAt: now } : l,
      ),
    }));
    pushActivity(set, get, { kind: "call_logged", actor: get().role, leadId, text: "Call logged" });
  },

  sendMessage: (leadId, text) => {
    pushActivity(set, get, {
      kind: "message_sent",
      actor: get().role,
      leadId,
      text: `Message: ${text}`,
    });
  },

  completeFollowUp: (followUpId) => {
    const f = get().followUps.find((x) => x.id === followUpId);
    if (!f) return;
    set((s) => ({
      followUps: s.followUps.map((x) => (x.id === followUpId ? { ...x, done: true } : x)),
      leads: s.leads.map((l) => (l.id === f.leadId ? { ...l, nextFollowUpAt: null } : l)),
    }));
    pushActivity(set, get, {
      kind: "follow_up_done",
      actor: f.tcmId,
      leadId: f.leadId,
      tourId: f.tourId,
      text: `Follow-up done: ${f.reason}`,
    });
  },

  addFollowUp: (input) => {
    const f: FollowUp = { ...input, id: uid("f"), done: false };
    set((s) => ({ followUps: [f, ...s.followUps] }));
  },

  reassignLead: (leadId, tcmId, reason) => {
    const tcm = get().tcms.find((t) => t.id === tcmId);
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, assignedTcmId: tcmId, updatedAt: new Date().toISOString() } : l,
      ),
    }));

    api
      .command({
        _id: uid("c"),
        type: "cmd.lead.assign",
        issuedAt: new Date().toISOString(),
        payload: { leadId, tcmId },
      })
      .catch((err) => console.error("[store] Failed to reassign lead on server:", err));

    pushActivity(set, get, {
      kind: "status_changed",
      actor: get().role,
      leadId,
      text: `Reassigned to ${tcm?.name ?? tcmId} · ${reason}`,
    });
    // auto-handoff
    const lead = get().leads.find((l) => l.id === leadId);
    if (lead) {
      get().sendHandoff({
        leadId,
        from: get().role,
        fromId: get().role === "tcm" ? get().currentTcmId : get().role,
        text: `Reassigned to ${tcm?.name ?? tcmId}. Reason: ${reason}`,
        priority: lead.intent === "hot" ? "urgent" : "normal",
      });
    }
  },

  autoAssignLead: (leadId) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) return { tcmId: "", reasons: [] };
    const pick = autoAssignFn(lead, get().tcms, get().leads, get().tours);
    get().reassignLead(leadId, pick.tcmId, pick.reasons.join(" · "));
    return { tcmId: pick.tcmId, reasons: pick.reasons };
  },

  sendHandoff: ({ leadId, from, fromId, text, priority }) => {
    const to: Role = from === "flow-ops" ? "tcm" : from === "tcm" ? "flow-ops" : "flow-ops";
    const msg: HandoffMessage = {
      id: uid("h"),
      leadId,
      ts: new Date().toISOString(),
      from,
      fromId,
      to,
      text,
      priority,
      read: false,
    };
    set((s) => ({ handoffs: [...s.handoffs, msg] }));
    emitConnector({
      kind: "handoff.sent",
      actorRole: from,
      actorId: fromId,
      leadId,
      text: `${personName(fromId, from)} → ${to}: ${text.slice(0, 80)}`,
    });
  },

  markHandoffsRead: (leadId) => {
    set((s) => ({
      handoffs: s.handoffs.map((h) => (h.leadId === leadId ? { ...h, read: true } : h)),
    }));
  },

  startSequence: (leadId, kind) => {
    const existing = get().sequences.find((s) => s.leadId === leadId && !s.stoppedReason);
    if (existing) return;
    const seq: ActiveSequence = {
      id: uid("s"),
      leadId,
      kind,
      startedAt: new Date().toISOString(),
      currentStep: 0,
      paused: false,
    };
    set((s) => ({ sequences: [...s.sequences, seq] }));
    pushActivity(set, get, {
      kind: "message_sent",
      actor: "system",
      leadId,
      text: `Sequence started: ${kind}`,
    });
  },

  toggleSequencePause: (leadId) => {
    set((s) => ({
      sequences: s.sequences.map((seq) =>
        seq.leadId === leadId && !seq.stoppedReason ? { ...seq, paused: !seq.paused } : seq,
      ),
    }));
  },

  stopSequence: (leadId, reason) => {
    set((s) => ({
      sequences: s.sequences.map((seq) =>
        seq.leadId === leadId && !seq.stoppedReason ? { ...seq, stoppedReason: reason } : seq,
      ),
    }));
  },

  advanceSequenceStep: (leadId) => {
    set((s) => ({
      sequences: s.sequences.map((seq) =>
        seq.leadId === leadId && !seq.stoppedReason
          ? { ...seq, currentStep: seq.currentStep + 1 }
          : seq,
      ),
    }));
  },

  closeDeal: ({ leadId, tourId, propertyId, tcmId, amount }) => {
    const existing = get().bookings.find((b) => b.leadId === leadId);
    if (existing) return existing;
    const lead = get().leads.find((l) => l.id === leadId);
    const now = new Date().toISOString();
    const booking: Booking = {
      id: uid("b"),
      leadId,
      tourId,
      propertyId,
      tcmId,
      amount,
      tenantName: lead?.name ?? "Unknown",
      tenantPhone: lead?.phone ?? "",
      deposit: Math.round(amount * 2),
      moveInDate: lead?.moveInDate ?? now.slice(0, 10),
      status: "active",
      ts: now,
      updatedAt: now,
    };
    set((s) => ({
      bookings: [booking, ...s.bookings],
      properties: s.properties.map((p) =>
        p.id === propertyId
          ? { ...p, vacantBeds: Math.max(0, p.vacantBeds - 1), daysSinceLastBooking: 0 }
          : p,
      ),
      leads: s.leads.map((l) =>
        l.id === leadId
          ? { ...l, stage: "booked", confidence: 100, updatedAt: new Date().toISOString() }
          : l,
      ),
      tours: s.tours.map((t) =>
        t.id === tourId ? { ...t, decision: "booked", status: "completed" } : t,
      ),
      sequences: s.sequences.map((seq) =>
        seq.leadId === leadId && !seq.stoppedReason ? { ...seq, stoppedReason: "Booked" } : seq,
      ),
    }));
    void api
      .command({
        _id: uid("c"),
        type: "cmd.lead.change_stage",
        issuedAt: new Date().toISOString(),
        payload: { leadId, to: "booked" },
      })
      .catch(() => {});
    void api
      .command({
        _id: uid("c"),
        type: "cmd.booking.create",
        issuedAt: new Date().toISOString(),
        payload: {
          leadId,
          tourId,
          propertyId,
          tcmId,
          amount,
          tenantName: lead?.name ?? "Unknown",
          tenantPhone: lead?.phone ?? "",
          deposit: Math.round(amount * 2),
          moveInDate: lead?.moveInDate ?? now.slice(0, 10),
        },
      })
      .catch(() => {});
    pushActivity(set, get, {
      kind: "booking_confirmed",
      actor: tcmId,
      leadId,
      tourId,
      propertyId,
      text: `Deal closed · ₹${amount.toLocaleString("en-IN")}/mo`,
    });
    // Connector - find which Flop scheduled this lead's tour, give them assist XP.
    const sched = get().activities.find(
      (a) => a.kind === "tour_scheduled" && a.leadId === leadId && a.tourId === tourId,
    );
    const ownerEvt = get().properties.find((p) => p.id === propertyId);
    emitConnector({
      kind: "booking.closed",
      actorRole: "tcm",
      actorId: tcmId,
      leadId,
      tourId,
      propertyId,
      bookingId: booking.id,
      text: `${personName(tcmId, "TCM")} booked ${lead?.name ?? "lead"} at ${ownerEvt?.name ?? "property"} · ₹${Math.round(amount).toLocaleString("en-IN")}/mo`,
      assists:
        sched && sched.actor !== tcmId
          ? [{ role: sched.actor === "flow-ops" ? "flow-ops" : "tcm", id: sched.actor }]
          : undefined,
    });
    return booking;
  },

  addTenant: (input) => {
    const tenant: Tenant = {
      id: uid("tnt"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input,
    };
    set((s) => ({ tenants: [tenant, ...s.tenants] }));
    return tenant;
  },

  updateTenantStatus: (tenantId, status, exitDate) => {
    set((s) => ({
      tenants: s.tenants.map((t) =>
        t.id === tenantId ? { ...t, status, exitDate: exitDate ?? t.exitDate, updatedAt: new Date().toISOString() } : t,
      ),
    }));
  },

  updateTenant: (tenantId, patch) => {
    set((s) => ({
      tenants: s.tenants.map((t) =>
        t.id === tenantId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    }));
  },

  recordRentPayment: (input) => {
    const record: RentRecord = {
      id: uid("rn"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    set((s) => ({ rents: [record, ...s.rents] }));
    return record;
  },

  recordPayment: (input) => {
    const payment: PaymentRecord = {
      id: uid("pay"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    set((s) => ({ payments: [payment, ...s.payments] }));
    return payment;
  },

  approveBooking: (bookingId) => {
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, status: "approved" as BookingStatus, updatedAt: new Date().toISOString() } : b,
      ),
    }));
  },

  markBookingPaid: (bookingId, ref) => {
    const booking = get().bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, status: "active" as BookingStatus, paidRef: ref, updatedAt: now } : b,
      ),
    }));
    // Auto-create tenant from booking
    const existingTenant = get().tenants.find((t) => t.bookingId === bookingId);
    if (!existingTenant) {
      const lead = get().leads.find((l) => l.id === booking.leadId);
      get().addTenant({
        bookingId,
        leadId: booking.leadId,
        propertyId: booking.propertyId,
        tcmId: booking.tcmId,
        name: booking.tenantName,
        phone: booking.tenantPhone,
        moveInDate: booking.moveInDate,
        rent: booking.amount,
        deposit: booking.deposit,
        status: "active",
        roomNumber: lead?.propertyName ?? undefined,
      });
      void api
        .command({
          _id: uid("c"),
          type: "cmd.tenant.create",
          issuedAt: new Date().toISOString(),
          payload: {
            bookingId,
            leadId: booking.leadId,
            propertyId: booking.propertyId,
            tcmId: booking.tcmId,
            name: booking.tenantName,
            phone: booking.tenantPhone,
            moveInDate: booking.moveInDate,
            rent: booking.amount,
            deposit: booking.deposit,
          },
        })
        .catch(() => {});
    }
  },

  cancelBooking: (bookingId) => {
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, status: "cancelled" as BookingStatus, updatedAt: new Date().toISOString() } : b,
      ),
    }));
  },

  addProperty: (input) => {
    const prop: Property = {
      id: uid("prop"),
      daysSinceLastBooking: 0,
      zoneId: input.zoneId ?? "unassigned",
      address: input.address ?? input.area,
      ...input,
    };
    set((s) => ({ properties: [prop, ...s.properties] }));
    return prop;
  },
}),
    { name: "gharpayy.app.v1" },
  ),
);

function pushActivity(
  set: (fn: (s: AppState) => Partial<AppState>) => void,
  _get: () => AppState,
  a: Omit<ActivityLog, "id" | "ts">,
) {
  const log: ActivityLog = { id: uid("a"), ts: new Date().toISOString(), ...a };
  set((s) => ({ activities: [log, ...s.activities] }));
}

/* ============== SELECTORS / DERIVED ============== */

export function getTcm(id: string) {
  return TCMS.find((t) => t.id === id);
}

export function getProperty(id: string | null | undefined, properties: Property[]) {
  return id ? properties.find((p) => p.id === id) : undefined;
}

export function getLead(id: string, leads: Lead[]) {
  return leads.find((l) => l.id === id);
}

export interface PropertyMetrics {
  property: Property;
  leadCount: number;
  tourCount: number;
  bookings: number;
  conversionPct: number; // 0-100
  occupancyPct: number;
  demandScore: number; // 0-100
  pressureScore: number; // 0-100
  signal: "high-demand-low-conv" | "low-demand-high-vacancy" | "high-conv-low-supply" | "balanced";
}

export function computePropertyMetrics(
  properties: Property[],
  leads: Lead[],
  tours: Tour[],
): PropertyMetrics[] {
  return properties.map((p) => {
    const propTours = tours.filter((t) => t.propertyId === p.id);
    const propLeads = leads.filter((l) => l.preferredArea === p.area);
    const bookings = propTours.filter((t) => t.decision === "booked").length;
    const completed = propTours.filter((t) => t.status === "completed").length;
    const conversionPct = completed > 0 ? Math.round((bookings / completed) * 100) : 0;
    const occupancyPct = Math.round(((p.totalBeds - p.vacantBeds) / p.totalBeds) * 100);
    const demandScore = Math.min(
      100,
      Math.round(propLeads.length * 12 + propTours.length * 8 - p.daysSinceLastBooking * 2),
    );
    const pressureScore = Math.round(
      Math.max(0, Math.min(100, demandScore * 0.6 + (100 - occupancyPct) * 0.4)),
    );

    let signal: PropertyMetrics["signal"] = "balanced";
    if (demandScore >= 60 && conversionPct < 25) signal = "high-demand-low-conv";
    else if (demandScore < 30 && occupancyPct < 60) signal = "low-demand-high-vacancy";
    else if (conversionPct >= 40 && p.vacantBeds <= 3) signal = "high-conv-low-supply";

    return {
      property: p,
      leadCount: propLeads.length,
      tourCount: propTours.length,
      bookings,
      conversionPct,
      occupancyPct,
      demandScore,
      pressureScore,
      signal,
    };
  });
}

/** Dynamic deal probability score */
export function recomputeConfidence(lead: Lead, tours: Tour[]): number {
  let score = lead.confidence;
  // Response speed weight
  if (lead.responseSpeedMins <= 5) score += 5;
  else if (lead.responseSpeedMins > 15) score -= 5;
  // Tour completed?
  const hasCompleted = tours.some((t) => t.leadId === lead.id && t.status === "completed");
  if (hasCompleted) score += 8;
  // Move-in urgency
  const days = (new Date(lead.moveInDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days <= 3) score += 6;
  else if (days >= 14) score -= 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function intentForConfidence(c: number): Intent {
  if (c >= 75) return "hot";
  if (c >= 50) return "warm";
  return "cold";
}
