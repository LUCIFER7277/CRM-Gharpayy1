const IST = "Asia/Kolkata";

function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Calendar day in IST as YYYY-MM-DD for reliable same-day checks. */
export function calendarDayIST(iso: string | Date): string {
  const d = iso instanceof Date ? iso : parseInstant(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** True when the instant falls on today's calendar date in IST. */
export function isTodayIST(iso: string | null | undefined): boolean {
  if (!iso?.trim()) return false;
  const day = calendarDayIST(iso);
  if (!day) return false;
  return day === calendarDayIST(new Date());
}

export function isTomorrowIST(iso: string | null | undefined): boolean {
  if (!iso?.trim()) return false;
  const day = calendarDayIST(iso);
  if (!day) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return day === calendarDayIST(tomorrow);
}

/** Human label for tour cards: "Today 11:00 AM", "Tomorrow 3:00 PM", etc. */
export function fmtTourScheduleLabel(iso: string | null | undefined): string {
  const d = parseInstant(iso);
  if (!d) return "—";
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  if (isTodayIST(iso)) return `Today ${time}`;
  if (isTomorrowIST(iso)) return `Tomorrow ${time}`;
  const date = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  return `${date} · ${time}`;
}

/** Minutes until tour start (negative = overdue). */
export function minutesUntilTour(iso: string, nowMs = Date.now()): number {
  const d = parseInstant(iso);
  if (!d) return Infinity;
  return Math.round((+d - nowMs) / 60000);
}
