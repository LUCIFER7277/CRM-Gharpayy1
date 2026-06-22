import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuditEntityType =
  | "lead"
  | "tour"
  | "property"
  | "booking"
  | "follow-up"
  | "owner-block"
  | "room"
  | "owner";

export interface AuditEntry {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  summary: string;
}

interface AuditState {
  entries: AuditEntry[];
  log: (e: Omit<AuditEntry, "id" | "ts">) => AuditEntry;
  recentFor: (entityType: AuditEntityType, entityId: string, limit?: number) => AuditEntry[];
  recentForActor: (actorId: string, limit?: number) => AuditEntry[];
  recentAll: (limit?: number) => AuditEntry[];
  clear: () => void;
}

const MAX_ENTRIES = 5000;

export const useAuditLog = create<AuditState>()(
  persist(
    (set, get) => ({
      entries: [],
      log: (e) => {
        const entry: AuditEntry = {
          ...e,
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          ts: new Date().toISOString(),
        };
        set((s) => ({ entries: [entry, ...s.entries].slice(0, MAX_ENTRIES) }));
        return entry;
      },
      recentFor: (entityType, entityId, limit = 20) =>
        get().entries
          .filter((e) => e.entityType === entityType && e.entityId === entityId)
          .slice(0, limit),
      recentForActor: (actorId, limit = 20) =>
        get().entries.filter((e) => e.actorId === actorId).slice(0, limit),
      recentAll: (limit = 50) => get().entries.slice(0, limit),
      clear: () => set({ entries: [] }),
    }),
    { name: "gharpayy.audit-log.v1" }
  )
);

export function formatDiff(before: unknown, after: unknown): string {
  if (before === undefined && after === undefined) return "";
  const b = before == null ? "—" : String(before);
  const a = after == null ? "—" : String(after);
  return `${b} → ${a}`;
}
