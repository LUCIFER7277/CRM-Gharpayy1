export const GOALS = {
  leadsAdded: 40,
  toursScheduled: 10,
  quotesSent: 10,
} as const;

export function buildIstDayRange(dateInput?: string | null) {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  let selectedDate = "";
  if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    selectedDate = dateInput;
  } else {
    const now = new Date();
    selectedDate = new Date(now.getTime() + istOffsetMs).toISOString().slice(0, 10);
  }

  const [year, month, day] = selectedDate.split("-").map((val) => parseInt(val, 10));
  const utcMidnightForIstDay = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - istOffsetMs;
  const dayStart = new Date(utcMidnightForIstDay);
  const dayEnd = new Date(utcMidnightForIstDay + 24 * 60 * 60 * 1000 - 1);

  return {
    selectedDate,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
  };
}

export type LeaderboardPeriod = "this_month" | "all_time" | "today" | "last_30_days" | "custom";

export function getPeriodBounds(period: Exclude<LeaderboardPeriod, "custom">) {
  const now = new Date();

  if (period === "all_time") {
    return { from: null as string | null, to: null as string | null };
  }

  if (period === "today") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    return { from: from.toISOString(), to: now.toISOString() };
  }

  if (period === "last_30_days") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    from.setUTCHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: now.toISOString() };
  }

  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return { from: from.toISOString(), to: now.toISOString() };
}
