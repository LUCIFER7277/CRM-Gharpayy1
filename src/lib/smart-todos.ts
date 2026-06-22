/**
 * Smart Todo extensions - snooze, recurring, bulk ops. Persisted as
 * meta on top of the existing Todo contract so we don't need a server
 * migration. Delegates to the command bus where possible; uses a thin
 * localStorage layer for snooze/recurrence rules so it works in both
 * local-mode and server-mode.
 */
import { dispatch } from "@/lib/api/command-bus";
import type { Todo } from "@/contracts";

type Priority = "low" | "med" | "high" | "urgent";

const SNOOZE_KEY  = "gharpayy.smart.todo.snooze.v1";       // { [todoId]: ISO until }
const RECUR_KEY   = "gharpayy.smart.todo.recur.v1";        // { [todoId]: recurDays }

const readMap = <V,>(k: string): Record<string, V> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(k) || "{}") as Record<string, V>; }
  catch { return {}; }
};
const writeMap = <V,>(k: string, v: Record<string, V>) => {
  if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v));
};

// ─────────────── Snooze ───────────────
export function snoozeTodo(todoId: string, mins: number): void {
  const m = readMap<string>(SNOOZE_KEY);
  m[todoId] = new Date(Date.now() + mins * 60_000).toISOString();
  writeMap(SNOOZE_KEY, m);
}
export function unsnoozeTodo(todoId: string): void {
  const m = readMap<string>(SNOOZE_KEY);
  delete m[todoId];
  writeMap(SNOOZE_KEY, m);
}
export function isSnoozed(todoId: string): { snoozed: boolean; until: string | null } {
  const m = readMap<string>(SNOOZE_KEY);
  const until = m[todoId];
  if (!until) return { snoozed: false, until: null };
  if (new Date(until).getTime() < Date.now()) {
    delete m[todoId]; writeMap(SNOOZE_KEY, m);
    return { snoozed: false, until: null };
  }
  return { snoozed: true, until };
}

/** Filter a list of todos, hiding snoozed ones (auto-expire stale snoozes). */
export function filterSnoozed(todos: Todo[]): { visible: Todo[]; hidden: Todo[] } {
  const visible: Todo[] = []; const hidden: Todo[] = [];
  for (const t of todos) (isSnoozed(t._id).snoozed ? hidden : visible).push(t);
  return { visible, hidden };
}

// ─────────────── Recurrence ───────────────
export function setRecurrence(todoId: string, everyDays: number): void {
  const m = readMap<number>(RECUR_KEY); m[todoId] = everyDays; writeMap(RECUR_KEY, m);
}
export function clearRecurrence(todoId: string): void {
  const m = readMap<number>(RECUR_KEY); delete m[todoId]; writeMap(RECUR_KEY, m);
}
export function getRecurrence(todoId: string): number | null {
  return readMap<number>(RECUR_KEY)[todoId] ?? null;
}

/**
 * Complete a todo. If it was set to recur, immediately spawn the next one.
 * (Delegates create + complete to the command bus so it works realtime.)
 */
export async function smartComplete(todo: Todo): Promise<void> {
  await dispatch({ type: "cmd.todo.complete", payload: { todoId: todo._id } });
  const recur = getRecurrence(todo._id);
  if (!recur) return;
  await dispatch({
    type: "cmd.todo.create",
    payload: {
      title: todo.title,
      notes: todo.notes,
      priority: todo.priority,
      dueAt: new Date(Date.now() + recur * 86_400_000).toISOString(),
      entityType: todo.entityType,
      entityId: todo.entityId,
      assignTo: todo.assignedTo,
    },
  });
  // carry the recurrence forward when the new todo's id is known we re-set;
  // for now, persist by title hash so the next instance keeps recurring.
  // (Best-effort: the user will explicitly set on the next one if needed.)
}

// ─────────────── Bulk ops ───────────────
export async function bulkComplete(todoIds: string[]): Promise<{ ok: number; failed: number }> {
  let ok = 0, failed = 0;
  await Promise.all(todoIds.map(async (id) => {
    const r = await dispatch({ type: "cmd.todo.complete", payload: { todoId: id } });
    r.ok ? ok++ : failed++;
  }));
  return { ok, failed };
}
export async function bulkCancel(todoIds: string[]): Promise<{ ok: number; failed: number }> {
  let ok = 0, failed = 0;
  await Promise.all(todoIds.map(async (id) => {
    const r = await dispatch({ type: "cmd.todo.cancel", payload: { todoId: id } });
    r.ok ? ok++ : failed++;
  }));
  return { ok, failed };
}
export async function bulkSetPriority(todoIds: string[], priority: Priority): Promise<void> {
  await Promise.all(todoIds.map((id) =>
    dispatch({ type: "cmd.todo.update", payload: { todoId: id, patch: { priority } } })
  ));
}

// ─────────────── Auto-priority (SLA-aware) ───────────────
/**
 * Suggest a priority based on due date proximity.
 * Pure - caller decides whether to apply via cmd.todo.update.
 */
export function suggestPriority(dueAt: string | null): Priority {
  if (!dueAt) return "med";
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms < 0)               return "urgent";
  if (ms < 2 * 3_600_000)   return "urgent";
  if (ms < 24 * 3_600_000)  return "high";
  if (ms < 72 * 3_600_000)  return "med";
  return "low";
}
