/**
 * Timing engine - IST-aware quiet hours, business windows, "send-now vs wait"
 * decisions, and human-friendly relative time. Pure & deterministic.
 */
const IST_OFFSET_MIN = 330; // +05:30

export interface TimingPolicy {
  quietStartHour: number;   // local IST hour, e.g. 22
  quietEndHour: number;     // 8
  businessStartHour: number;// 9
  businessEndHour: number;  // 21
  weekendQuiet: boolean;
}
export const DEFAULT_TIMING: TimingPolicy = {
  quietStartHour: 22, quietEndHour: 8,
  businessStartHour: 9, businessEndHour: 21,
  weekendQuiet: false,
};

const istParts = (d: Date) => {
  const t = new Date(d.getTime() + (IST_OFFSET_MIN + d.getTimezoneOffset()) * 60_000);
  return { hour: t.getHours(), min: t.getMinutes(), dow: t.getDay(), date: t };
};

export function isQuietHours(at: Date = new Date(), p: TimingPolicy = DEFAULT_TIMING): boolean {
  const { hour, dow } = istParts(at);
  if (p.weekendQuiet && (dow === 0 || dow === 6)) return true;
  if (p.quietStartHour > p.quietEndHour) return hour >= p.quietStartHour || hour < p.quietEndHour;
  return hour >= p.quietStartHour && hour < p.quietEndHour;
}
export function isBusinessHours(at: Date = new Date(), p: TimingPolicy = DEFAULT_TIMING): boolean {
  const { hour } = istParts(at);
  return hour >= p.businessStartHour && hour < p.businessEndHour && !isQuietHours(at, p);
}

/** Returns the next millisecond timestamp at which it's safe to send. */
export function nextSafeSendAt(from: Date = new Date(), p: TimingPolicy = DEFAULT_TIMING): Date {
  const probe = new Date(from);
  for (let i = 0; i < 48; i++) {
    if (isBusinessHours(probe, p)) return probe;
    probe.setTime(probe.getTime() + 30 * 60_000);
  }
  return probe;
}

export interface SendDecision {
  send: boolean;
  reason: string;
  deferUntil: string | null;
  deferMins: number;
}
export function decideSend(now: Date = new Date(), p: TimingPolicy = DEFAULT_TIMING): SendDecision {
  if (isBusinessHours(now, p)) return { send: true, reason: "Within business hours", deferUntil: null, deferMins: 0 };
  const next = nextSafeSendAt(now, p);
  const mins = Math.round((next.getTime() - now.getTime()) / 60_000);
  return {
    send: false,
    reason: isQuietHours(now, p) ? "Quiet hours - defer to morning" : "Outside business window",
    deferUntil: next.toISOString(),
    deferMins: mins,
  };
}

/** Human relative time - "in 3h", "5m ago", "tomorrow 9am". */
export function relTime(at: string | Date | null | undefined, base: Date = new Date()): string {
  if (!at) return "-";
  const t = typeof at === "string" ? new Date(at) : at;
  const diff = t.getTime() - base.getTime();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  let out: string;
  if (abs < min) out = "just now";
  else if (abs < hr)  out = `${Math.round(abs / min)}m`;
  else if (abs < day) out = `${Math.round(abs / hr)}h`;
  else if (abs < 7 * day) out = `${Math.round(abs / day)}d`;
  else out = t.toLocaleDateString();
  return past && abs >= min ? `${out} ago` : abs >= min ? `in ${out}` : out;
}

export function fmtIST(at: string | Date): string {
  const t = typeof at === "string" ? new Date(at) : at;
  return t.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}
