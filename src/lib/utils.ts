import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime12h(time24?: string) {
  if (!time24 || typeof time24 !== 'string') return "";
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${ampm}`;
}

export function localDateISO(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

export function tourTimeSlotsForDate(dateISO?: string) {
  const slots: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const todayISO = localDateISO(now);
  const isToday = dateISO === todayISO;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let mins = 9 * 60; mins <= 21 * 60; mins += 30) {
    if (isToday && mins <= currentMinutes) continue;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${pad(h)}:${pad(m)}`);
  }

  return slots;
}

export function formatINR(n: number): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
