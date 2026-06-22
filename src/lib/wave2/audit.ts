/**
 * Local audit trail - every command dispatched from this browser is mirrored
 * into a circular ring buffer for debug, "undo last", and showing the user
 * what just happened. Persisted to localStorage. 500-event cap.
 */
const KEY = "gharpayy.wave2.audit.v1";
const CAP = 500;

export interface AuditEntry {
  id: string;
  type: string;          // command type, e.g. "cmd.lead.update"
  payload: unknown;
  at: string;            // ISO
  ok: boolean;
  error?: string;
  durationMs?: number;
}

type Listener = (l: AuditEntry[]) => void;
const listeners = new Set<Listener>();

const read = (): AuditEntry[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const write = (l: AuditEntry[]) => {
  if (typeof window === "undefined") return;
  const c = l.slice(0, CAP);
  localStorage.setItem(KEY, JSON.stringify(c));
  listeners.forEach((cb) => cb(c));
};

export function recordAudit(e: Omit<AuditEntry, "id" | "at"> & { at?: string }): void {
  const entry: AuditEntry = {
    id: `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    at: e.at ?? new Date().toISOString(),
    type: e.type, payload: e.payload, ok: e.ok, error: e.error, durationMs: e.durationMs,
  };
  write([entry, ...read()]);
}
export function listAudit(): AuditEntry[] { return read(); }
export function subscribeAudit(l: Listener): () => void {
  listeners.add(l); l(read()); return () => { listeners.delete(l); };
}
export function clearAudit(): void { write([]); }

/** Return the inverse command for a given audited command, when known. */
export function inverseCommand(e: AuditEntry): { type: string; payload: Record<string, unknown> } | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "cmd.todo.complete": return { type: "cmd.todo.update", payload: { todoId: p.todoId, patch: { status: "open" } } };
    case "cmd.todo.cancel":   return { type: "cmd.todo.update", payload: { todoId: p.todoId, patch: { status: "open" } } };
    case "cmd.lead.assign":   return null; // need previous assignee
    default: return null;
  }
}
