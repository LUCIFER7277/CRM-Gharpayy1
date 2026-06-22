import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VisitStage =
  | "scheduled"
  | "started"
  | "at-property"
  | "tour-ongoing"
  | "completed"
  | "objection"
  | "follow-up"
  | "booked"
  | "lost";

export type StartedMode = "on-the-way" | "reached" | "delayed" | "no-show";

export type Reaction = "loved" | "interested" | "comparing" | "average" | "rejected";

export type Decision =
  | "ready-to-book"
  | "needs-discussion"
  | "comparing-options"
  | "parent-approval"
  | "budget-pending"
  | "not-interested";

export type ObjectionCategory =
  | "budget" | "location" | "room" | "amenities" | "family" | "competition" | "other";

export interface ObjectionEntry {
  id: string;
  ts: number;
  category: ObjectionCategory;
  subType: string;
  customerSaid: string;
  salesResponse: string;
  resolution: "resolved" | "partial" | "unresolved";
}

export type FollowUpStage =
  | "fu-1" | "fu-2" | "fu-3"
  | "negotiation" | "waiting-salary" | "waiting-joining"
  | "waiting-parents" | "booking-expected";

export type Outcome = "booked" | "thinking" | "follow-up" | "lost" | null;

export type LostReason =
  | "chose-another-pg" | "chose-flat" | "cancelled-relocation"
  | "budget" | "location" | "amenities" | "family-rejected"
  | "no-response" | "joined-different-company" | "college-plan-changed";

export interface VisitAlert {
  id: string;
  ts: number;
  tourId: string;
  leadName: string;
  severity: "info" | "warn" | "risk" | "win";
  kind:
    | "started" | "reached" | "delay" | "ongoing" | "completed"
    | "objection" | "escalate" | "ghost" | "booked" | "lost" | "manager";
  message: string;
}

export interface VisitRecord {
  tourId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  propertyId: string;
  propertyName: string;
  propertyArea: string;
  tcmId: string;
  tcmName: string;
  scheduledAt: number;
  stage: VisitStage;
  startedMode?: StartedMode;
  startedAt?: number;
  reachedAt?: number;
  ongoingAt?: number;
  completedAt?: number;
  reaction?: Reaction;
  decision?: Decision;
  objections: ObjectionEntry[];
  followUpStage?: FollowUpStage;
  outcome: Outcome;
  lostReason?: LostReason;
  managerNote?: string;
  lastUpdateAt: number;
  escalated?: boolean;
  warnedDelay?: boolean;
  warnedAtRisk?: boolean;
  warnedEscalate?: boolean;
  warnedGhost?: boolean;
  warnedBlack?: boolean;
  warnedNoShow?: boolean;
  warnedBuffer?: boolean;
  calendarEventId?: string;
  ownerCode?: string;
  bufferConflictWith?: string;
  interventionFlag?: { by: string; ts: number; note: string };
  coachNotes?: Array<{ id: string; by: string; ts: number; note: string }>;
}

interface State {
  records: Record<string, VisitRecord>;
  alerts: VisitAlert[];
  alertsSeenAt: number;
}

interface Actions {
  upsert: (v: VisitRecord) => void;
  patch: (tourId: string, patch: Partial<VisitRecord>) => void;
  pushAlert: (a: Omit<VisitAlert, "id" | "ts">) => void;
  markAlertsSeen: () => void;
  addObjection: (tourId: string, o: Omit<ObjectionEntry, "id" | "ts">) => void;
  addCoachNote: (tourId: string, by: string, note: string) => void;
  flagIntervention: (tourId: string, by: string, note: string) => void;
  clearIntervention: (tourId: string) => void;
  resetDemo: () => void;
}

export const useVisitWar = create<State & Actions>()(
  persist(
    (set, get) => ({
      records: {},
      alerts: [],
      alertsSeenAt: 0,

      upsert: (v) =>
        set((s) => ({ records: { ...s.records, [v.tourId]: v } })),

      patch: (tourId, p) =>
        set((s) => {
          const cur = s.records[tourId];
          if (!cur) return s;
          return {
            records: {
              ...s.records,
              [tourId]: { ...cur, ...p, lastUpdateAt: Date.now() },
            },
          };
        }),

      pushAlert: (a) =>
        set((s) => ({
          alerts: [
            { id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...a },
            ...s.alerts,
          ].slice(0, 200),
        })),

      markAlertsSeen: () => set({ alertsSeenAt: Date.now() }),

      addObjection: (tourId, o) => {
        const id = `ob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => {
          const cur = s.records[tourId];
          if (!cur) return s;
          const entry: ObjectionEntry = { id, ts: Date.now(), ...o };
          return {
            records: {
              ...s.records,
              [tourId]: {
                ...cur,
                objections: [entry, ...cur.objections],
                stage: cur.stage === "completed" ? "objection" : cur.stage,
                lastUpdateAt: Date.now(),
              },
            },
          };
        });
        get().pushAlert({
          tourId,
          leadName: get().records[tourId]?.leadName ?? "Lead",
          severity: "warn",
          kind: "objection",
          message: `Objection logged · ${o.category} → ${o.subType}`,
        });
      },

      addCoachNote: (tourId, by, note) =>
        set((s) => {
          const cur = s.records[tourId];
          if (!cur) return s;
          const entry = { id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, by, ts: Date.now(), note };
          return {
            records: {
              ...s.records,
              [tourId]: {
                ...cur,
                coachNotes: [entry, ...(cur.coachNotes ?? [])],
                lastUpdateAt: Date.now(),
              },
            },
          };
        }),

      flagIntervention: (tourId, by, note) =>
        set((s) => {
          const cur = s.records[tourId];
          if (!cur) return s;
          return {
            records: {
              ...s.records,
              [tourId]: {
                ...cur,
                interventionFlag: { by, ts: Date.now(), note },
                lastUpdateAt: Date.now(),
              },
            },
          };
        }),

      clearIntervention: (tourId) =>
        set((s) => {
          const cur = s.records[tourId];
          if (!cur) return s;
          return { records: { ...s.records, [tourId]: { ...cur, interventionFlag: undefined } } };
        }),

      resetDemo: () => set({ records: {}, alerts: [], alertsSeenAt: 0 }),
    }),
    { name: "gh-visit-war-v1" },
  ),
);

export function probabilityFor(r?: Reaction, objections = 0, stage?: VisitStage): number {
  let base = 50;
  if (r === "loved") base = 90;
  else if (r === "interested") base = 70;
  else if (r === "comparing") base = 40;
  else if (r === "average") base = 20;
  else if (r === "rejected") base = 5;

  base -= Math.min(30, objections * 7);

  if (stage === "booked") return 100;
  if (stage === "lost") return 0;
  return Math.max(0, Math.min(100, base));
}

export const STAGE_META: Record<VisitStage, { label: string; bg: string; fg: string }> = {
  scheduled:    { label: "Scheduled",    bg: "#1A1A26", fg: "#9CA3AF" },
  started:      { label: "On The Way",   bg: "#1F2937", fg: "#60A5FA" },
  "at-property":{ label: "At Property",  bg: "#1A2E1A", fg: "#00FF85" },
  "tour-ongoing":{ label: "Tour Ongoing",bg: "#2B1F0A", fg: "#FFD600" },
  completed:    { label: "Visit Done",   bg: "#0F1F2B", fg: "#22D3EE" },
  objection:    { label: "Objection",    bg: "#2B1F0A", fg: "#FF9F1C" },
  "follow-up":  { label: "Follow-up",    bg: "#1F1A2B", fg: "#A78BFA" },
  booked:       { label: "Booked",       bg: "#0F2B1A", fg: "#00FF85" },
  lost:         { label: "Lost",         bg: "#2B0F0F", fg: "#FF2D2D" },
};

export function timerColor(elapsedSec: number): string {
  if (elapsedSec >= 75 * 60) return "#FF2D2D";
  if (elapsedSec >= 45 * 60) return "#FF5C00";
  if (elapsedSec >= 30 * 60) return "#FFD600";
  return "#00FF85";
}

export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export const OBJECTION_CATALOG: Record<ObjectionCategory, string[]> = {
  budget:      ["Expensive", "Deposit High", "Better Option Found"],
  location:    ["Far From Office", "Far From College", "Transport Issue"],
  room:        ["Room Small", "Sharing Issue", "Ventilation Issue", "Furniture Issue"],
  amenities:   ["Food Concern", "WiFi Concern", "Laundry Concern", "Security Concern"],
  family:      ["Parent Not Convinced", "Family Comparing"],
  competition: ["Other PG Shortlisted", "Existing Stay Extended"],
  other:       ["Custom"],
};
