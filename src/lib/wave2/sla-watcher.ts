/**
 * SLA Watcher - runs in the browser tab, scans live leads + todos, and
 * pushes notifications via the unified notif-bus when an SLA is about to
 * breach or has breached. Idempotent (dedup window in notif-bus prevents
 * spam). Start once at app shell mount.
 */
import type { Lead, Todo } from "@/contracts";
import { slaFor } from "@/lib/intel-core";
import { pushNotif } from "./notif-bus";
import { bucketFor } from "./todo-engine";

export interface WatcherDeps {
  getLeads: () => Lead[];
  getTodos: () => Todo[];
  /** last activity ms per lead (optional) */
  getLeadLastActivityAt?: (leadId: string) => string | null;
}

let timer: ReturnType<typeof setInterval> | null = null;
let deps: WatcherDeps | null = null;

export function startSlaWatcher(d: WatcherDeps, intervalMs = 60_000): void {
  deps = d;
  if (timer) clearInterval(timer);
  tick();
  timer = setInterval(tick, intervalMs);
}
export function stopSlaWatcher(): void { if (timer) clearInterval(timer); timer = null; }

function tick(): void {
  if (!deps) return;
  for (const l of deps.getLeads()) {
    const last = deps.getLeadLastActivityAt?.(l._id) ?? null;
    const sla = slaFor(l, last);
    if (sla.status === "warn") {
      pushNotif({
        kind: "lead.sla.warn",
        leadId: l._id,
        title: `SLA warning · ${l.name}`,
        body: `Stage ${l.stage} - ${sla.message}`,
        severity: "warn",
        href: `/live-leads?focus=${l._id}`,
        groupKey: `sla|${l._id}`,
      });
    } else if (sla.status === "breach") {
      pushNotif({
        kind: "lead.sla.breach",
        leadId: l._id,
        title: `SLA BREACHED · ${l.name}`,
        body: sla.message,
        severity: "critical",
        href: `/live-leads?focus=${l._id}`,
        groupKey: `sla|${l._id}`,
      });
    }
  }
  for (const t of deps.getTodos()) {
    if (t.status === "done" || t.status === "cancelled") continue;
    const b = bucketFor(t);
    if (b === "overdue") {
      pushNotif({
        kind: "todo.overdue",
        title: `Task overdue · ${t.title}`,
        body: t.dueAt ? `Was due ${new Date(t.dueAt).toLocaleString()}` : "",
        severity: "warn",
        href: "/my-tasks",
        groupKey: `todo|${t._id}`,
      });
    }
  }
}
