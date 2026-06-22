/**
 * Unified notification bus - priority bands, channel routing, delivery receipts,
 * grouping, do-not-disturb, and toast bridge. Sits on top of notif-smart.ts
 * (dedup + snooze) and is fully browser-side.
 */
import { dedupHash, shouldSuppress, isNotifSnoozed } from "@/lib/notif-smart";
import { isQuietHours, DEFAULT_TIMING, type TimingPolicy } from "./timing";

export type NotifSeverity = "info" | "success" | "warn" | "critical";
export type NotifChannel  = "in-app" | "toast" | "sound" | "push";

export interface Notification {
  id: string;
  kind: string;                 // e.g. "lead.sla.breach"
  title: string;
  body?: string;
  severity: NotifSeverity;
  href?: string;
  leadId?: string;
  groupKey?: string;            // notifications with same key collapse
  createdAt: string;
  channels: NotifChannel[];
  read: boolean;
}

const KEY = "gharpayy.wave2.notifs.v1";
type Listener = (list: Notification[]) => void;
const listeners = new Set<Listener>();

const read = (): Notification[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const write = (list: Notification[]) => {
  if (typeof window === "undefined") return;
  // Cap to 200, newest first
  const capped = list.slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify(capped));
  listeners.forEach((l) => l(capped));
};

export function subscribeNotifs(l: Listener): () => void {
  listeners.add(l); l(read()); return () => { listeners.delete(l); };
}
export function listNotifs(): Notification[] { return read(); }
export function unreadCount(): number { return read().filter((n) => !n.read).length; }

export interface PushOpts {
  kind: string;
  title: string;
  body?: string;
  severity?: NotifSeverity;
  href?: string;
  leadId?: string;
  groupKey?: string;
  channels?: NotifChannel[];
  /** Skip dedup window check (e.g. critical alerts). */
  force?: boolean;
  policy?: TimingPolicy;
}

/** Push a notification through dedup → snooze → DND → store. Returns id or null when suppressed. */
export function pushNotif(o: PushOpts): string | null {
  const severity = o.severity ?? "info";
  const channels = o.channels ?? defaultChannels(severity);
  const hash = dedupHash(o.kind, o.leadId, o.title);
  if (!o.force && shouldSuppress(hash, 30)) return null;
  if (isNotifSnoozed(o.kind)) return null;
  // DND quiet hours: still log to in-app, drop sound/push
  const filtered = isQuietHours(new Date(), o.policy ?? DEFAULT_TIMING) && severity !== "critical"
    ? channels.filter((c) => c === "in-app")
    : channels;
  const n: Notification = {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    kind: o.kind, title: o.title, body: o.body,
    severity, href: o.href, leadId: o.leadId,
    groupKey: o.groupKey ?? `${o.kind}|${o.leadId ?? "_"}`,
    createdAt: new Date().toISOString(),
    channels: filtered, read: false,
  };
  const cur = read();
  // Group collapse: if same groupKey unread exists, replace it.
  const idx = cur.findIndex((c) => !c.read && c.groupKey === n.groupKey);
  const next = idx >= 0 ? [n, ...cur.filter((_, i) => i !== idx)] : [n, ...cur];
  write(next);
  return n.id;
}

function defaultChannels(s: NotifSeverity): NotifChannel[] {
  switch (s) {
    case "critical": return ["in-app", "toast", "sound", "push"];
    case "warn":     return ["in-app", "toast"];
    case "success":  return ["in-app", "toast"];
    default:         return ["in-app"];
  }
}

export function markRead(id: string): void {
  write(read().map((n) => (n.id === id ? { ...n, read: true } : n)));
}
export function markAllRead(): void {
  write(read().map((n) => ({ ...n, read: true })));
}
export function clearAll(): void { write([]); }

/** Group notifications by groupKey for the bell UI. */
export function groupedNotifs(): { key: string; latest: Notification; count: number }[] {
  const list = read();
  const map = new Map<string, { latest: Notification; count: number }>();
  for (const n of list) {
    const k = n.groupKey ?? n.id;
    const cur = map.get(k);
    if (!cur) map.set(k, { latest: n, count: 1 });
    else cur.count++;
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}
