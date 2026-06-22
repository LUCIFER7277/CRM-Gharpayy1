import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalEventKind = "meeting" | "call" | "tour" | "follow-up" | "task" | "personal";
export type CalReminder = 0 | 5 | 10 | 15 | 30 | 60 | 1440;

export interface CalEvent {
  id: string;
  title: string;
  kind: CalEventKind;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  /** Linked CRM lead id */
  leadId?: string;
  /** Linked tour id */
  tourId?: string;
  /** Linked follow-up id (if this event is the materialised follow-up) */
  followUpId?: string;
  color?: string;
  /** minutes before start to remind */
  reminder?: CalReminder;
  /** External provider this event was synced from */
  externalSource?: "google" | "outlook" | "ics" | "local";
  externalId?: string;
  /** rrule string e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR */
  rrule?: string;
  createdAt: string;
  updatedAt: string;
}

export type SyncProvider = "google" | "outlook" | "ics";

export interface SyncConnection {
  provider: SyncProvider;
  connected: boolean;
  account?: string;
  /** When was the last successful pull/push */
  lastSyncedAt?: string;
  /** ICS feed URL (for ics provider) */
  feedUrl?: string;
  /** Calendar ids the user picked to sync */
  selectedCalendars?: string[];
  /** Direction */
  direction?: "pull" | "push" | "both";
}

interface CalendarState {
  events: CalEvent[];
  connections: SyncConnection[];
  /** ICS subscription URL we expose for outside calendars */
  publishedIcsToken: string;

  addEvent: (e: Omit<CalEvent, "id" | "createdAt" | "updatedAt">) => CalEvent;
  upsertEvent: (e: CalEvent) => void;
  updateEvent: (id: string, patch: Partial<CalEvent>) => void;
  deleteEvent: (id: string) => void;
  importEvents: (items: CalEvent[]) => void;

  setConnection: (c: SyncConnection) => void;
  removeConnection: (p: SyncProvider) => void;
  rotateIcsToken: () => void;
}

const uid = (p = "evt") => `${p}-${Math.random().toString(36).slice(2, 10)}`;

export const useCalendar = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],
      connections: [],
      publishedIcsToken: uid("ics"),

      addEvent: (e) => {
        const now = new Date().toISOString();
        const evt: CalEvent = {
          ...e,
          id: uid("evt"),
          createdAt: now,
          updatedAt: now,
        };
        set({ events: [...get().events, evt] });
        return evt;
      },
      upsertEvent: (event) =>
        set({
          events: get().events.some((e) => e.id === event.id)
            ? get().events.map((e) =>
                e.id === event.id ? { ...e, ...event, updatedAt: new Date().toISOString() } : e,
              )
            : [...get().events, { ...event, updatedAt: new Date().toISOString() }],
        }),
      updateEvent: (id, patch) =>
        set({
          events: get().events.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
          ),
        }),
      deleteEvent: (id) => set({ events: get().events.filter((e) => e.id !== id) }),
      importEvents: (items) => {
        const existing = new Map(get().events.map((e) => [e.externalId ?? e.id, e]));
        for (const it of items) {
          existing.set(it.externalId ?? it.id, it);
        }
        set({ events: Array.from(existing.values()) });
      },

      setConnection: (c) => {
        const others = get().connections.filter((x) => x.provider !== c.provider);
        set({ connections: [...others, c] });
      },
      removeConnection: (p) =>
        set({ connections: get().connections.filter((c) => c.provider !== p) }),
      rotateIcsToken: () => set({ publishedIcsToken: uid("ics") }),
    }),
    {
      name: "align-calendar-v1",
      version: 1,
    },
  ),
);

type VisitEventPayload = {
  tourId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  propertyName: string;
  propertyArea: string;
  scheduledAt: number;
  description?: string;
  durationMin?: number;
};

export const upsertVisitEvent = (args: VisitEventPayload) => {
  const state = useCalendar.getState();
  const existing = state.events.find((e) => e.tourId === args.tourId);
  const durationMin = args.durationMin ?? 60;
  const start = new Date(args.scheduledAt).toISOString();
  const end = new Date(args.scheduledAt + durationMin * 60_000).toISOString();
  const event = {
    title: `Tour · ${args.leadName}`,
    kind: "tour" as const,
    start,
    end,
    allDay: false,
    leadId: args.leadId,
    tourId: args.tourId,
    description: args.description,
    location: `${args.propertyName} · ${args.propertyArea}`,
    externalSource: "local" as const,
  };

  if (existing) {
    state.updateEvent(existing.id, event);
    return;
  }

  state.addEvent(event);
};

export const archiveVisitEvent = (tourId: string) => {
  const state = useCalendar.getState();
  const existing = state.events.find((e) => e.tourId === tourId);
  if (existing) {
    state.deleteEvent(existing.id);
  }
};

export const KIND_META: Record<CalEventKind, { label: string; color: string; ring: string; bg: string; text: string }> = {
  meeting: { label: "Meeting", color: "#2563eb", ring: "ring-blue-500/40", bg: "bg-blue-500/15", text: "text-blue-700" },
  call: { label: "Call", color: "#0891b2", ring: "ring-cyan-500/40", bg: "bg-cyan-500/15", text: "text-cyan-700" },
  tour: { label: "Tour", color: "#f97316", ring: "ring-orange-500/40", bg: "bg-orange-500/15", text: "text-orange-700" },
  "follow-up": { label: "Follow-up", color: "#9333ea", ring: "ring-purple-500/40", bg: "bg-purple-500/15", text: "text-purple-700" },
  task: { label: "Task", color: "#16a34a", ring: "ring-emerald-500/40", bg: "bg-emerald-500/15", text: "text-emerald-700" },
  personal: { label: "Personal", color: "#64748b", ring: "ring-slate-500/40", bg: "bg-slate-500/15", text: "text-slate-700" },
};
