import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalEvent } from "@/lib/calendar-store";

export type CalendarView = "month" | "week" | "day" | "agenda";

export function monthGrid(focus: Date): Date[] {
  const start = startOfWeek(startOfMonth(focus), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(focus), { weekStartsOn: 0 });
  const out: Date[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function weekDays(focus: Date): Date[] {
  const start = startOfWeek(focus, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function eventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  return events
    .filter((e) => isSameDay(new Date(e.start), day) || isWithinSpan(e, day))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

function isWithinSpan(e: CalEvent, day: Date): boolean {
  const s = new Date(e.start);
  const en = new Date(e.end);
  return day >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && day <= en;
}

export function navigate(view: CalendarView, focus: Date, dir: -1 | 1): Date {
  if (view === "month") return addMonths(focus, dir);
  if (view === "week") return addDays(focus, 7 * dir);
  return addDays(focus, dir);
}

export function headerLabel(view: CalendarView, focus: Date): string {
  if (view === "month") return format(focus, "MMMM yyyy");
  if (view === "week") {
    const days = weekDays(focus);
    return `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;
  }
  return format(focus, "EEEE, MMMM d, yyyy");
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function durationMinutes(e: CalEvent): number {
  return Math.max(15, (+new Date(e.end) - +new Date(e.start)) / 60000);
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}
