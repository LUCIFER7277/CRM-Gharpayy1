import type { Role } from "@/lib/types";

export type QueueChipFilter =
  | "all"
  | "hot"
  | "warm"
  | "cold"
  | "overdue"
  | "tour-today"
  | "quote-pending";

const VIEW_KEY = "gharpayy.impact.view";
const OVERDUE_HOME_KEY = "gharpayy.impact.overdue-home";
const DIGEST_DATE_KEY = "gharpayy.impact.digest-date";

export type ViewMode = "stack" | "board";

export const CHIP_LABELS: Record<QueueChipFilter, string> = {
  all: "All leads",
  hot: "Hot only",
  warm: "Warm only",
  cold: "Cold only",
  overdue: "Overdue only",
  "tour-today": "Tour today",
  "quote-pending": "Quote pending",
};

export function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "board";
  const v = localStorage.getItem(VIEW_KEY);
  return v === "stack" || v === "board" ? v : "board";
}

export function writeStoredView(view: ViewMode) {
  localStorage.setItem(VIEW_KEY, view);
}

/** TCMs can opt into opening on Overdue only each session. */
export function readOverdueHomeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(OVERDUE_HOME_KEY) === "1";
}

export function writeOverdueHomeEnabled(on: boolean) {
  localStorage.setItem(OVERDUE_HOME_KEY, on ? "1" : "0");
}

export function initialChipFilter(role: Role): QueueChipFilter {
  if (role === "tcm" && readOverdueHomeEnabled()) return "overdue";
  return "all";
}

export function digestSentToday(): boolean {
  if (typeof window === "undefined") return true;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return localStorage.getItem(DIGEST_DATE_KEY) === today;
}

export function markDigestSentToday() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  localStorage.setItem(DIGEST_DATE_KEY, today);
}

/** True when local time is 9:00–9:15 IST and digest not sent today. */
export function shouldPromptMorningDigest(): boolean {
  if (typeof window === "undefined" || digestSentToday()) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 99);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 99);
  return hour === 9 && minute < 15;
}
