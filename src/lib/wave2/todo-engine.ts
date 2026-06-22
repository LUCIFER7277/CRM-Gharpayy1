/**
 * Todo Engine - overdue/today/upcoming buckets, smart sort, focus mode,
 * checklist/sub-task synthesis, and effort estimates. Pure utility layer
 * that consumes the existing Todo contract.
 */
import type { Todo } from "@/contracts";

export type Bucket = "overdue" | "today" | "tomorrow" | "this-week" | "later" | "no-due";

const PRIORITY_W: Record<NonNullable<Todo["priority"]>, number> = {
  urgent: 100, high: 70, med: 40, low: 15,
};

export function bucketFor(t: Todo, now: Date = new Date()): Bucket {
  if (!t.dueAt) return "no-due";
  const due = new Date(t.dueAt);
  const ms = due.getTime() - now.getTime();
  const day = 86_400_000;
  if (ms < 0) return "overdue";
  const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
  const endToday  = startOfDay.getTime() + day;
  const endTomorrow = endToday + day;
  if (due.getTime() < endToday)    return "today";
  if (due.getTime() < endTomorrow) return "tomorrow";
  if (ms < 7 * day)                return "this-week";
  return "later";
}

export interface BucketedTodos {
  overdue: Todo[]; today: Todo[]; tomorrow: Todo[]; "this-week": Todo[]; later: Todo[]; "no-due": Todo[];
}
export function bucketize(todos: Todo[], now: Date = new Date()): BucketedTodos {
  const out: BucketedTodos = { overdue: [], today: [], tomorrow: [], "this-week": [], later: [], "no-due": [] };
  for (const t of todos) {
    if (t.status === "done" || t.status === "cancelled" || t.status === "declined") continue;
    out[bucketFor(t, now)].push(t);
  }
  for (const k of Object.keys(out) as Bucket[]) out[k] = smartSort(out[k]);
  return out;
}

/** Score a todo for ranking: priority + due proximity + bonus for in-progress. */
export function rankScore(t: Todo, now: Date = new Date()): number {
  let s = PRIORITY_W[t.priority] ?? 40;
  if (t.dueAt) {
    const ms = new Date(t.dueAt).getTime() - now.getTime();
    if (ms < 0)                  s += 50 + Math.min(50, -ms / 3_600_000);
    else if (ms < 3_600_000)     s += 35;
    else if (ms < 24*3_600_000)  s += 20;
    else if (ms < 72*3_600_000)  s += 8;
  }
  if (t.status === "in-progress") s += 10;
  if (t.status === "pending-accept") s += 5;
  return s;
}
export function smartSort(todos: Todo[], now: Date = new Date()): Todo[] {
  return [...todos].sort((a, b) => rankScore(b, now) - rankScore(a, now));
}

/** Pick top-N actionable todos for "focus mode". */
export function focusQueue(todos: Todo[], n = 5, now: Date = new Date()): Todo[] {
  return smartSort(todos.filter((t) =>
    t.status === "open" || t.status === "accepted" || t.status === "in-progress"
  ), now).slice(0, n);
}

/** Heuristic effort estimate (mins) from title/notes - for sequencing the day. */
export function estimateMins(t: Todo): number {
  const text = `${t.title} ${t.notes ?? ""}`.toLowerCase();
  if (/call|dial|ring/.test(text))         return 8;
  if (/whatsapp|message|sms|text/.test(text)) return 3;
  if (/visit|tour|inspection|site/.test(text)) return 60;
  if (/email|draft|write/.test(text))      return 12;
  if (/review|read|check/.test(text))      return 6;
  if (/meeting|sync|standup/.test(text))   return 30;
  return 10;
}

export interface DayPlan {
  totalMins: number;
  blocks: { todo: Todo; mins: number; cumulative: number }[];
}
/** Greedy day planner - packs focus queue into a budget (default 4h). */
export function planDay(todos: Todo[], budgetMins = 240): DayPlan {
  const queue = smartSort(todos.filter((t) => t.status !== "done" && t.status !== "cancelled"));
  let total = 0;
  const blocks: DayPlan["blocks"] = [];
  for (const t of queue) {
    const m = estimateMins(t);
    if (total + m > budgetMins) break;
    total += m;
    blocks.push({ todo: t, mins: m, cumulative: total });
  }
  return { totalMins: total, blocks };
}

/** Synthesize a default checklist for a stage transition. */
export function checklistForStage(stage: string): string[] {
  switch (stage) {
    case "tour-scheduled": return ["Confirm tour 1h before", "Send PG location pin", "Brief property owner"];
    case "tour-done":      return ["Capture lead feedback", "Send pricing PDF", "Ask for booking decision in 24h"];
    case "negotiation":    return ["Confirm move-in date", "Lock token amount", "Send agreement draft"];
    case "booked":         return ["Collect token payment", "Schedule onboarding", "Hand off to ops"];
    default:               return ["Initial WhatsApp intro", "First call", "Qualify budget + move-in"];
  }
}
