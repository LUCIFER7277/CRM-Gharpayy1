// Offline-first adapter: persists todos + activities to localStorage and
// emits the same Domain events the VPS would emit, so realtime UI works
// before the backend is deployed. Auto-engaged when VITE_API_URL is unset
// or the server is unreachable.
import { ulid } from "@/contracts";
import type { Todo, Activity, DomainEvent, Lead, Tour } from "@/contracts";
import { normalizeLeadName } from "@/lib/lead-helpers";

const TODOS_KEY = "gharpayy.local.todos";
const ACTS_KEY = "gharpayy.local.activities";
const LEADS_KEY = "gharpayy.local.leads";
const TOURS_KEY = "myt:tours";
const TENANT = "local";
const USER = "local-user";

// No seed leads - the live-leads UI shows empty state until the user adds one.
const SEED_LEADS: Lead[] = [];

// One-time cleanup: if the user previously ran in local mode, the old demo leads
// are still sitting in localStorage. Wipe them once VITE_API_URL is configured.
if (typeof window !== "undefined") {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  const cleaned = localStorage.getItem("gharpayy.local.cleaned_v1") === "1";
  if (url && !cleaned) {
    localStorage.removeItem(LEADS_KEY);
    localStorage.removeItem(TODOS_KEY);
    localStorage.removeItem(ACTS_KEY);
    localStorage.setItem("gharpayy.local.cleaned_v1", "1");
  }
}

type Listener = (e: DomainEvent) => void;
const listeners = new Set<Listener>();
export function onLocalEvent(cb: Listener): () => void { listeners.add(cb); return () => listeners.delete(cb); }
function emit(e: DomainEvent) { listeners.forEach((l) => { try { l(e); } catch (err) { console.error(err); } }); }

const read = <T,>(k: string): T[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) || "[]") as T[]; } catch { return []; }
};
const write = <T,>(k: string, v: T[]) => { if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v)); };

const nowISO = () => new Date().toISOString();
const env = (correlationId: string) => ({
  _id: ulid(), occurredAt: nowISO(), actor: USER, tenantId: TENANT,
  correlationId, causationId: null, version: 1 as const,
});

type CmdIn = { _id: string; type: string; payload: Record<string, unknown> };

export const localAdapter = {
  isLocal: true,

  // ---------- Queries ----------
  listTodos(q: { entityType?: string; entityId?: string; scope?: string }) {
    let items = read<Todo>(TODOS_KEY);
    if (q.entityType) items = items.filter((t) => t.entityType === q.entityType);
    if (q.entityId) items = items.filter((t) => t.entityId === q.entityId);
    if (q.scope === "mine") items = items.filter((t) => t.assignedTo === USER || (t.createdBy === USER && !t.assignedTo));
    return { items: items.sort((a, b) => b._id.localeCompare(a._id)) };
  },

  listActivities(q: { entityType: string; entityId: string; kind?: string; limit?: number }) {
    let items = read<Activity>(ACTS_KEY).filter((a) => a.entityType === q.entityType && a.entityId === q.entityId);
    if (q.kind) items = items.filter((a) => a.kind === q.kind);
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { items: items.slice(0, q.limit ?? 200) };
  },

  listUsers() {
    return { items: [{ _id: USER, name: "Me (local)", email: "me@local", role: "admin" }] };
  },

  listLeads(q: { limit?: number } = {}) {
    if (typeof window !== "undefined" && !localStorage.getItem(LEADS_KEY)) {
      write(LEADS_KEY, SEED_LEADS);
    }
    const items = read<Lead>(LEADS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: items.slice(0, q.limit ?? 100), nextCursor: null as string | null };
  },

  listTours() {
    const items = read<Tour>(TOURS_KEY);
    return { items: items.sort((a, b) => b._id.localeCompare(a._id)), nextCursor: null as string | null };
  },

  // ---------- Commands ----------
  command(cmd: CmdIn): { ok: true; eventIds: string[]; data?: unknown } | { ok: false; error: string } {
    try {
      const correlationId = cmd._id;
      const t = cmd.type;

      if (t === "cmd.todo.create") {
        const p = cmd.payload as Record<string, unknown>;
        const assignTo = (p.assignTo as string | null) ?? null;
        const todo: Todo = {
          _id: ulid(),
          title: String(p.title ?? ""),
          notes: (p.notes as string) ?? "",
          status: assignTo && assignTo !== USER ? "pending-accept" : "open",
          priority: (p.priority as Todo["priority"]) ?? "med",
          dueAt: (p.dueAt as string | null) ?? null,
          entityType: (p.entityType as Todo["entityType"]) ?? "none",
          entityId: (p.entityId as string | null) ?? null,
          createdBy: USER,
          assignedTo: assignTo,
          tenantId: TENANT,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          completedAt: null,
        };
        const list = read<Todo>(TODOS_KEY); list.unshift(todo); write(TODOS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.todo.created" as const, payload: { todo } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t.startsWith("cmd.todo.")) {
        const todoId = (cmd.payload as { todoId: string }).todoId;
        const list = read<Todo>(TODOS_KEY);
        const idx = list.findIndex((x) => x._id === todoId);
        if (idx < 0) return { ok: false, error: "Todo not found" };
        const cur = list[idx];
        const patch: Partial<Todo> = { updatedAt: nowISO() };
        let evtType: DomainEvent["type"] = "evt.todo.updated";
        let payload: Record<string, unknown> = { todoId, patch };
        if (t === "cmd.todo.accept")   { patch.status = "accepted";  evtType = "evt.todo.accepted";  payload = { todoId, by: USER }; }
        if (t === "cmd.todo.decline")  { patch.status = "cancelled"; evtType = "evt.todo.declined";  payload = { todoId, by: USER, reason: (cmd.payload as { reason?: string }).reason ?? null }; }
        if (t === "cmd.todo.complete") { patch.status = "done"; patch.completedAt = nowISO(); evtType = "evt.todo.completed"; payload = { todoId, by: USER }; }
        if (t === "cmd.todo.cancel")   { patch.status = "cancelled"; evtType = "evt.todo.cancelled"; payload = { todoId, by: USER }; }
        if (t === "cmd.todo.assign")   {
          const assignTo = (cmd.payload as { assignTo: string }).assignTo;
          patch.assignedTo = assignTo; patch.status = assignTo === USER ? "accepted" : "pending-accept";
          evtType = "evt.todo.assigned"; payload = { todoId, assignTo, pending: assignTo !== USER };
        }
        list[idx] = { ...cur, ...patch }; write(TODOS_KEY, list);
        const evt = { ...env(correlationId), type: evtType, payload } as unknown as DomainEvent;
        emit(evt);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.activity.log") {
        const p = cmd.payload as Record<string, unknown>;
        const activity: Activity = {
          _id: ulid(),
          entityType: p.entityType as Activity["entityType"],
          entityId: String(p.entityId),
          kind: p.kind as Activity["kind"],
          subject: String(p.subject ?? ""),
          body: (p.body as string) ?? "",
          direction: (p.direction as Activity["direction"]) ?? "internal",
          outcome: (p.outcome as Activity["outcome"]) ?? null,
          durationSec: (p.durationSec as number) ?? 0,
          occurredAt: (p.occurredAt as string) ?? nowISO(),
          scheduledFor: (p.scheduledFor as string | null) ?? null,
          relatedTodoId: (p.relatedTodoId as string | null) ?? null,
          meta: (p.meta as Record<string, unknown>) ?? {},
          actor: USER, tenantId: TENANT, createdAt: nowISO(),
        };
        const list = read<Activity>(ACTS_KEY); list.unshift(activity); write(ACTS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.activity.logged" as const, payload: { activity } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.activity.delete") {
        const activityId = (cmd.payload as { activityId: string }).activityId;
        const list = read<Activity>(ACTS_KEY);
        const item = list.find((a) => a._id === activityId);
        if (!item) return { ok: false, error: "Activity not found" };
        write(ACTS_KEY, list.filter((a) => a._id !== activityId));
        const evt = { ...env(correlationId), type: "evt.activity.deleted" as const, payload: { activityId, entityType: item.entityType, entityId: item.entityId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      // ----- Lead commands (mirror server/src/modules/leads/command-handlers.ts) -----
      if (t === "cmd.lead.create") {
        const p = cmd.payload as Record<string, unknown>;
        const lead: Lead = {
          _id: ulid(),
          name: normalizeLeadName(String(p.name ?? "")),
          phone: String(p.phone ?? ""),
          source: (p.source as string) ?? "manual",
          budget: Number(p.budget ?? 0),
          budgetText: String(p.budgetText ?? ""),
          moveInDate: String(p.moveInDate ?? new Date().toISOString().slice(0, 10)),
          preferredArea: String(p.preferredArea ?? ""),
          zoneId: (p.zoneId as string | null) ?? null,
          assignedTcmId: (p.assigneeId as string | null) ?? null,
          stage: "new",
          intent: (p.intent as Lead["intent"]) ?? "warm",
          confidence: 50,
          tags: (p.tags as string[]) ?? [],
          propertySelection: p.propertySelection as Lead["propertySelection"],
          nextFollowUpAt: null,
          responseSpeedMins: 0,
          email: (p.email as string) ?? "",
          areas: (p.areas as string[]) ?? [],
          fullAddress: (p.fullAddress as string) ?? "",
          type: (p.type as string) ?? "",
          room: (p.room as string) ?? "",
          need: (p.need as string) ?? "",
          inBLR: (p.inBLR as boolean | null) ?? null,
          quality: (p.quality as Lead["quality"]) ?? null,
          specialReqs: (p.specialReqs as string) ?? "",
          notes: (p.notes as string) ?? "",
          zoneCategory: (p.zoneCategory as string) ?? "",
          assigneeId: (p.assigneeId as string | null) ?? null,
          stageLabel: (p.stageLabel as string) ?? "",
          priorityScore: 0,
          priorityState: "COLD",
          nextBestAction: null,
          priorityReason: null,
          createdAt: nowISO(), updatedAt: nowISO(),
          createdBy: USER, tenantId: TENANT,
        };
        const list = read<Lead>(LEADS_KEY); list.unshift(lead); write(LEADS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.lead.created" as const, payload: { lead } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.lead.update") {
        const p = cmd.payload as { leadId: string; patch: Partial<Lead> };
        const list = read<Lead>(LEADS_KEY);
        const idx = list.findIndex((l) => l._id === p.leadId);
        if (idx < 0) return { ok: false, error: "Lead not found" };
        const patch = {
          ...p.patch,
          ...(p.patch.name != null ? { name: normalizeLeadName(p.patch.name) } : {}),
          updatedAt: nowISO(),
        };
        list[idx] = { ...list[idx], ...patch } as Lead;
        write(LEADS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.lead.updated" as const, payload: { leadId: p.leadId, patch } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.lead.assign") {
        const p = cmd.payload as { leadId: string; tcmId: string };
        const list = read<Lead>(LEADS_KEY);
        const idx = list.findIndex((l) => l._id === p.leadId);
        if (idx < 0) return { ok: false, error: "Lead not found" };
        list[idx] = { ...list[idx], assignedTcmId: p.tcmId, assigneeId: p.tcmId, updatedAt: nowISO() };
        write(LEADS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.lead.assigned" as const, payload: { leadId: p.leadId, tcmId: p.tcmId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.lead.change_stage") {
        const p = cmd.payload as { leadId: string; to: Lead["stage"] };
        const list = read<Lead>(LEADS_KEY);
        const idx = list.findIndex((l) => l._id === p.leadId);
        if (idx < 0) return { ok: false, error: "Lead not found" };
        const from = list[idx].stage;
        list[idx] = { ...list[idx], stage: p.to, updatedAt: nowISO() };
        write(LEADS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.lead.stage_changed" as const, payload: { leadId: p.leadId, from, to: p.to } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.lead.delete") {
        const p = cmd.payload as { leadId: string };
        const list = read<Lead>(LEADS_KEY);
        if (!list.some((l) => l._id === p.leadId)) return { ok: false, error: "Lead not found" };
        write(LEADS_KEY, list.filter((l) => l._id !== p.leadId));
        const evt = { ...env(correlationId), type: "evt.lead.deleted" as const, payload: { leadId: p.leadId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id] };
      }

      if (t === "cmd.tour.schedule") {
        const p = cmd.payload as {
          leadId: string;
          propertyId?: string | null;
          tcmId: string;
          scheduledAt: string;
          bookingSource?: string;
          tourType?: "physical" | "virtual" | "pre-book-pitch";
        };
        const tour: Tour = {
          _id: ulid(),
          leadId: p.leadId,
          propertyId: p.propertyId ?? null,
          assignedTo: p.tcmId,
          scheduledBy: USER,
          scheduledAt: p.scheduledAt,
          status: "scheduled",
          showUp: false,
          customPropertyName: "",
          bookingSource: p.bookingSource ?? "whatsapp",
          tourType: p.tourType ?? "physical",
          postTour: { outcome: null, confidence: 0, objection: null, objectionNote: "", expectedDecisionAt: null, nextFollowUpAt: null, filledAt: null },
          createdAt: nowISO(),
          updatedAt: nowISO(),
          tenantId: TENANT,
        };
        const list = read<Tour>(TOURS_KEY); list.unshift(tour); write(TOURS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.tour.scheduled" as const, payload: { tour } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour } };
      }

      if (t === "cmd.tour.reschedule") {
        const p = cmd.payload as { tourId: string; scheduledAt: string };
        const list = read<Tour>(TOURS_KEY);
        const idx = list.findIndex((x) => x._id === p.tourId);
        if (idx < 0) return { ok: false, error: "Tour not found" };
        list[idx] = { ...list[idx], scheduledAt: p.scheduledAt, updatedAt: nowISO() };
        write(TOURS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.tour.rescheduled" as const, payload: { tourId: p.tourId, scheduledAt: p.scheduledAt } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour: list[idx] } };
      }

      if (t === "cmd.tour.cancel") {
        const p = cmd.payload as { tourId: string };
        const list = read<Tour>(TOURS_KEY);
        const idx = list.findIndex((x) => x._id === p.tourId);
        if (idx < 0) return { ok: false, error: "Tour not found" };
        list[idx] = { ...list[idx], status: "cancelled", updatedAt: nowISO() };
        write(TOURS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.tour.cancelled" as const, payload: { tourId: p.tourId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour: list[idx] } };
      }

      if (t === "cmd.tour.complete") {
        const p = cmd.payload as { tourId: string };
        const list = read<Tour>(TOURS_KEY);
        const idx = list.findIndex((x) => x._id === p.tourId);
        if (idx < 0) return { ok: false, error: "Tour not found" };
        list[idx] = { ...list[idx], status: "completed", updatedAt: nowISO() };
        write(TOURS_KEY, list);
        const leads = read<Lead>(LEADS_KEY);
        const leadIdx = leads.findIndex((l) => l._id === list[idx].leadId);
        if (leadIdx >= 0) {
          leads[leadIdx] = { ...leads[leadIdx], stage: "tour-done", updatedAt: nowISO() };
          write(LEADS_KEY, leads);
        }
        const evt = { ...env(correlationId), type: "evt.tour.completed" as const, payload: { tourId: p.tourId } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour: list[idx] } };
      }

      if (t === "cmd.tour.update") {
        const p = cmd.payload as { tourId: string; patch: Partial<Tour> };
        const list = read<Tour>(TOURS_KEY);
        const idx = list.findIndex((x) => x._id === p.tourId);
        if (idx < 0) return { ok: false, error: "Tour not found" };
        list[idx] = { ...list[idx], ...p.patch, updatedAt: nowISO() };
        write(TOURS_KEY, list);
        if (p.patch.status === "no-show") {
          const leads = read<Lead>(LEADS_KEY);
          const leadIdx = leads.findIndex((l) => l._id === list[idx].leadId);
          if (leadIdx >= 0) {
            leads[leadIdx] = { ...leads[leadIdx], stage: "contacted", updatedAt: nowISO() };
            write(LEADS_KEY, leads);
          }
        }
        const evt = { ...env(correlationId), type: "evt.tour.updated" as const, payload: { tourId: p.tourId, patch: p.patch } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour: list[idx] } };
      }

      if (t === "cmd.tour.update_post_tour") {
        const p = cmd.payload as { tourId: string; patch: Record<string, unknown> };
        const list = read<Tour>(TOURS_KEY);
        const idx = list.findIndex((x) => x._id === p.tourId);
        if (idx < 0) return { ok: false, error: "Tour not found" };
        const next = { ...list[idx], postTour: { ...list[idx].postTour, ...(p.patch as Partial<Tour["postTour"]>) }, updatedAt: nowISO() };
        list[idx] = next;
        write(TOURS_KEY, list);
        const evt = { ...env(correlationId), type: "evt.tour.updated" as const, payload: { tourId: p.tourId, patch: p.patch } };
        emit(evt as DomainEvent);
        return { ok: true, eventIds: [evt._id], data: { tour: next } };
      }

      return { ok: true, eventIds: [] };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

export const isLocalMode = (): boolean => {
  if (typeof window === "undefined") return true;
  // Local mode if no VITE_API_URL was set, OR user explicitly opted in.
  const explicit = localStorage.getItem("gharpayy.force_local") === "1";
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return explicit || !url;
};
