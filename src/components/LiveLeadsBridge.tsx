// Hydrates the legacy zustand `useApp().leads` array from the VPS Mongo
// backend and keeps it in sync via Socket.IO events. Mount once near the
// top of the app (AppShell). Every legacy page that reads `leads` from the
// store now sees real data without any per-page refactor.
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { useLeadsSync } from "@/lib/leads-sync";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { Lead as LegacyLead, LeadStage, Intent } from "@/lib/types";
import type { Lead as WireLead, DomainEvent } from "@/contracts";
import { normalizeLeadRecord } from "@/lib/lead-helpers";
import { useAuthUser } from "@/lib/auth-store";
import { useNotifications } from "@/lib/notifications";

function toLegacy(w: WireLead, fallbackTcmId = ""): LegacyLead {
  return normalizeLeadRecord({
    id: w._id,
    name: w.name,
    phone: w.phone,
    source: w.source ?? "manual",
    budget: w.budget ?? 0,
    budgetText: w.budgetText ?? "",
    moveInDate: w.moveInDate ?? new Date().toISOString().slice(0, 10),
    preferredArea: w.preferredArea ?? "",
    assignedTcmId: w.assignedTcmId ?? fallbackTcmId,
    assigneeId: w.assigneeId ?? w.assignedTcmId ?? null,
    createdBy: w.createdBy ?? null,
    stage: (w.stage as LeadStage) ?? "new",
    intent: (w.intent as Intent) ?? "warm",
    confidence: w.confidence ?? 50,
    tags: w.tags ?? [],
    nextFollowUpAt: w.nextFollowUpAt ?? null,
    responseSpeedMins: w.responseSpeedMins ?? 0,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    // Extended
    email: w.email,
    areas: w.areas,
    fullAddress: w.fullAddress,
    type: w.type,
    room: w.room,
    need: w.need,
    inBLR: w.inBLR,
    quality: w.quality,
    specialReqs: w.specialReqs,
    notes: w.notes,
    zoneCategory: w.zoneCategory,
    stageLabel: w.stageLabel,
  });
}

export function LiveLeadsBridge() {
  const setLeads = useApp((s) => s.setLeads);
  const tcms = useApp((s) => s.tcms);
  // Keep a ref so the effect closure always reads the latest tcms
  // without needing tcms in the dependency array (which would re-trigger
  // the full fetch every time tcms loads and discard in-flight results).
  const tcmsRef = useRef(tcms);
  useEffect(() => { tcmsRef.current = tcms; }, [tcms]);

  useEffect(() => {
    let cancelled = false;

    useLeadsSync.getState().setLoading();

    const load = async () => {
      try {
        const r = await api.leads.list({ limit: 200 });
        if (cancelled) return;
        const fallbackTcm = tcmsRef.current[0]?.id ?? "";
        setLeads((r.items as WireLead[]).map((l) => toLegacy(l, fallbackTcm)));
        useLeadsSync.getState().setReady();
      } catch (e) {
        const msg = (e as Error).message;
        console.warn("[LiveLeadsBridge] load failed:", msg);
        if (!cancelled) {
          setLeads([]);
          useLeadsSync.getState().setError(msg);
        }
      }
    };

    void load();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      const cur = useApp.getState().leads;
      const fallbackTcm = tcmsRef.current[0]?.id ?? "";
      if (e.type === "evt.lead.created") {
        const lead = toLegacy(e.payload.lead as WireLead, fallbackTcm);
        if (!cur.some((l) => l.id === lead.id)) setLeads([lead, ...cur]);
      } else if (e.type === "evt.lead.updated") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, ...(e.payload.patch as Partial<LegacyLead>), updatedAt: new Date().toISOString() }
          : l)));
      } else if (e.type === "evt.lead.assigned") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, assignedTcmId: e.payload.tcmId, assigneeId: e.payload.tcmId, updatedAt: new Date().toISOString() }
          : l)));
        
        const me = useAuthUser.getState().user;
        if (me && e.payload.originalAssignedById === me.id) {
          const leadName = cur.find((l) => l.id === e.payload.leadId)?.name || "a lead";
          const assigneeName = e.payload.assigneeName || "the member";
          useNotifications.getState().push({
            id: `n:assignment_accepted:${e.payload.leadId}:${Date.now()}`,
            ts: Date.now(),
            audience: [],
            recipientId: me.id,
            severity: "success",
            title: "Lead assignment accepted",
            body: `${assigneeName} accepted the assignment of ${leadName}'s lead.`,
            href: "/inbox",
            kind: "system",
            leadId: e.payload.leadId,
          });
        }
      } else if (e.type === "evt.tour.assignment_accepted") {
        const me = useAuthUser.getState().user;
        if (me && e.payload.originalAssignedById === me.id) {
          const leadName = cur.find((l) => l.id === e.payload.leadId)?.name || "a lead";
          const assigneeName = e.payload.assigneeName || "the member";
          useNotifications.getState().push({
            id: `n:assignment_accepted:${e.payload.tourId}:${Date.now()}`,
            ts: Date.now(),
            audience: [],
            recipientId: me.id,
            severity: "success",
            title: "Tour assignment accepted",
            body: `${assigneeName} accepted the assignment of ${leadName}'s tour.`,
            href: "/inbox",
            kind: "system",
            leadId: e.payload.leadId,
          });
        }
      } else if (e.type === "evt.lead.stage_changed") {
        setLeads(cur.map((l) => (l.id === e.payload.leadId
          ? { ...l, stage: e.payload.to as LeadStage, updatedAt: new Date().toISOString() }
          : l)));
      } else if (e.type === "evt.lead.deleted") {
        setLeads(cur.filter((l) => l.id !== e.payload.leadId));
      } else if (e.type === "evt.lead.assignment_pending") {
        const me = useAuthUser.getState().user;
        if (me && e.actor === me.id) {
          const leadName = cur.find((l) => l.id === e.payload.leadId)?.name || "a lead";
          const assigneeName = tcmsRef.current.find(t => t.id === e.payload.tcmId)?.name 
            || "the selected member";
          useNotifications.getState().push({
            id: `n:pending_assignment:${e.payload.leadId}:${Date.now()}`,
            ts: Date.now(),
            audience: [],
            recipientId: me.id,
            severity: "success",
            title: "Lead assigned",
            body: `You assigned ${leadName}'s lead to ${assigneeName}`,
            href: "/inbox",
            kind: "system",
            leadId: e.payload.leadId,
          });
        }
      }
    });

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; off(); clearInterval(interval); };
  }, [setLeads]);

  return null;
}
