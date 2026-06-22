/**
 * Notification dedup + snooze layer (additive, sits on top of the existing
 * connector-driven notifications store). Pure browser-side.
 */
const SNOOZE_KEY = "gharpayy.notif.snooze.v1";   // { [key]: ISO until }
const SEEN_KEY   = "gharpayy.notif.seen.v1";     // { [hash]: ts } - for dedup

const readMap = <V,>(k: string): Record<string, V> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(k) || "{}") as Record<string, V>; }
  catch { return {}; }
};
const writeMap = <V,>(k: string, v: Record<string, V>) => {
  if (typeof window !== "undefined") localStorage.setItem(k, JSON.stringify(v));
};

export function dedupHash(kind: string, leadId: string | undefined, title: string): string {
  return `${kind}|${leadId ?? "_"}|${title.slice(0, 80)}`;
}

/** Returns true if this notification was seen within the dedup window. */
export function shouldSuppress(hash: string, windowMins = 30): boolean {
  const seen = readMap<number>(SEEN_KEY);
  const now = Date.now();
  // GC stale entries
  for (const [k, ts] of Object.entries(seen)) {
    if (now - ts > 24 * 3_600_000) delete seen[k];
  }
  const last = seen[hash];
  seen[hash] = now;
  writeMap(SEEN_KEY, seen);
  return !!last && now - last < windowMins * 60_000;
}

export function snoozeNotification(key: string, mins: number): void {
  const m = readMap<string>(SNOOZE_KEY);
  m[key] = new Date(Date.now() + mins * 60_000).toISOString();
  writeMap(SNOOZE_KEY, m);
}
export function isNotifSnoozed(key: string): boolean {
  const m = readMap<string>(SNOOZE_KEY);
  const until = m[key];
  if (!until) return false;
  if (new Date(until).getTime() < Date.now()) {
    delete m[until]; writeMap(SNOOZE_KEY, m);
    return false;
  }
  return true;
}
