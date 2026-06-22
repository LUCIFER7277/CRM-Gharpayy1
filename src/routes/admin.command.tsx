import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { useApp } from "@/lib/store";
import { useAuditLog } from "@/lib/crm10x/audit-log";
import { bulkReassign, flagIntervention } from "@/admin/lib/admin-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ShieldAlert, Power, Megaphone, Snowflake, Download, UserCheck } from "lucide-react";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/command")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Command Bridge \u2014 Admin" }] }),
  component: CommandBridge,
});

const KILL_KEY = "admin.kill.sequences";

function CommandBridge() {
  const rows = useAdminRows();
  const { tcms, setRole, setCurrentTcmId } = useApp();
  const log = useAuditLog((s) => s.log);

  const [impersonateId, setImpersonateId] = useState<string>("");
  const [broadcast, setBroadcast] = useState("");
  const [paused, setPaused] = useState<boolean>(() =>
    typeof window !== "undefined" && localStorage.getItem(KILL_KEY) === "1"
  );

  const dormant = useMemo(() => rows.filter((r) => r.status === "dormant"), [rows]);
  const stuckHot = useMemo(
    () => rows.filter((r) => !r.booked && r.status !== "lost" && r.probability >= 70 &&
      Date.now() - r.lastTouchTs > 2 * 86_400_000),
    [rows],
  );

  function doImpersonate() {
    if (!impersonateId) return;
    setRole("tcm");
    setCurrentTcmId(impersonateId);
    const t = tcms.find((x) => x.id === impersonateId);
    log({ actorId: "admin", actorName: "Admin", entityType: "lead" as any, entityId: impersonateId, action: "admin.impersonate", summary: `Impersonating ${t?.name ?? impersonateId}` });
    toast.warning(`Now impersonating ${t?.name}. Switch back via View as.`);
  }

  function togglePause() {
    const next = !paused;
    setPaused(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(KILL_KEY, next ? "1" : "0");
    }
    log({ actorId: "admin", actorName: "Admin", entityType: "tour" as any, entityId: "sequences", action: next ? "admin.kill.on" : "admin.kill.off", summary: next ? "Paused all sequences" : "Resumed sequences" });
    toast[next ? "warning" : "success"](next ? "All sequences paused org-wide" : "Sequences resumed");
  }

  function sendBroadcast() {
    if (!broadcast.trim()) return;
    log({ actorId: "admin", actorName: "Admin", entityType: "owner" as any, entityId: String(Date.now()), action: "admin.broadcast", summary: `Broadcast \u2192 ${tcms.length} TCMs: ${broadcast.slice(0, 80)}` });
    navigator.clipboard?.writeText(broadcast).catch(() => {});
    toast.success(`Broadcast queued for ${tcms.length} TCMs \u00B7 copied to clipboard`);
    setBroadcast("");
  }

  function snapshotNow() {
    const blob = new Blob([JSON.stringify({ ts: Date.now(), rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `admin-snapshot-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    log({ actorId: "admin", actorName: "Admin", entityType: "tour" as any, entityId: "snapshot", action: "admin.snapshot", summary: `Snapshot of ${rows.length} rows downloaded` });
  }

  function rebalanceDormant() {
    if (!dormant.length) return toast.info("No dormant leads to rebalance");
    if (!tcms.length) return;
    const fittest = tcms.slice().sort((a, b) => (b as any).conversionRate - (a as any).conversionRate)[0];
    bulkReassign(dormant.map((d) => d.lead.id), fittest.id);
  }

  return (
    <AdminShell title="Command Bridge" sub="Impersonate, broadcast, pause, snapshot \u2014 every god-mode lever.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card icon={<UserCheck className="h-4 w-4" />} title="Impersonate" tone="warn">
          <p className="text-[11px] text-muted-foreground mb-2">Sign in as any TCM to debug their desk. Logged + reversible.</p>
          <select
            value={impersonateId}
            onChange={(e) => setImpersonateId(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 mb-2"
          >
            <option value="">Select TCM\u2026</option>
            {tcms.map((t) => <option key={t.id} value={t.id}>{t.name} \u00B7 {t.zone}</option>)}
          </select>
          <button onClick={doImpersonate} disabled={!impersonateId}
            className="w-full text-xs bg-warning text-warning-foreground rounded py-1.5 font-medium disabled:opacity-40">
            Become this TCM
          </button>
        </Card>

        <Card icon={<Power className="h-4 w-4" />} title="Kill switch" tone={paused ? "danger" : "ok"}>
          <p className="text-[11px] text-muted-foreground mb-2">Pause every WhatsApp sequence + automation org-wide. Use during incidents.</p>
          <div className={cn("text-center py-2 rounded mb-2 font-mono text-xs",
            paused ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
            {paused ? "PAUSED" : "RUNNING"}
          </div>
          <button onClick={togglePause}
            className={cn("w-full text-xs rounded py-1.5 font-medium",
              paused ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground")}>
            {paused ? "Resume sequences" : "Pause all sequences"}
          </button>
        </Card>

        <Card icon={<Download className="h-4 w-4" />} title="Snapshot now" tone="info">
          <p className="text-[11px] text-muted-foreground mb-2">Download current state of every joined admin row as JSON. Use for forensics or BI export.</p>
          <div className="text-[10px] text-muted-foreground mb-2 font-mono">{rows.length} rows \u00B7 {(JSON.stringify(rows).length / 1024).toFixed(1)} KB</div>
          <button onClick={snapshotNow}
            className="w-full text-xs bg-info text-info-foreground rounded py-1.5 font-medium">
            Download snapshot
          </button>
        </Card>

        <Card icon={<Megaphone className="h-4 w-4" />} title="Broadcast to all TCMs" tone="info" className="md:col-span-2">
          <textarea
            value={broadcast}
            onChange={(e) => setBroadcast(e.target.value)}
            placeholder="One message \u2014 every TCM sees this on next refresh + WhatsApp copy."
            rows={3}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 mb-2 font-mono"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">{broadcast.length}/280 \u00B7 {tcms.length} recipients</span>
            <button onClick={sendBroadcast} disabled={!broadcast.trim()}
              className="text-xs bg-accent text-accent-foreground rounded px-3 py-1.5 font-medium disabled:opacity-40">
              Send + copy
            </button>
          </div>
        </Card>

        <Card icon={<Snowflake className="h-4 w-4" />} title="Rebalance dormant" tone="warn">
          <p className="text-[11px] text-muted-foreground mb-2">Bulk-reassign every dormant lead to the top-converting TCM.</p>
          <div className="text-[10px] text-muted-foreground mb-2 font-mono">{dormant.length} dormant lead(s)</div>
          <button onClick={rebalanceDormant}
            className="w-full text-xs bg-warning text-warning-foreground rounded py-1.5 font-medium">
            Rebalance now
          </button>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <div className="text-xs font-semibold">Intervention queue \u00B7 hot leads going cold</div>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
            <tr><th className="text-left py-1.5">Lead</th><th className="text-left">TCM</th><th className="text-right">Prob</th><th className="text-right">Age</th><th></th></tr>
          </thead>
          <tbody>
            {stuckHot.map((r) => (
              <tr key={r.lead.id} className="border-b border-border/60">
                <td className="py-1.5">{r.lead.name}</td>
                <td className="text-muted-foreground">{r.tcm?.name ?? "\u2014"}</td>
                <td className="text-right font-mono text-accent">{r.probability}%</td>
                <td className="text-right font-mono">{Math.round((Date.now() - r.lastTouchTs) / 86_400_000)}d</td>
                <td className="text-right">
                  <button
                    onClick={() => flagIntervention(r.lead.id, "Hot lead stalled \u00B7 admin escalation")}
                    className="text-[10px] px-2 py-0.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25"
                  >Flag</button>
                </td>
              </tr>
            ))}
            {!stuckHot.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No hot leads stalled. Excellent.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Card({ icon, title, tone, children, className }: {
  icon: React.ReactNode; title: string; tone: "ok" | "info" | "warn" | "danger";
  children: React.ReactNode; className?: string;
}) {
  const border = {
    ok: "border-success/40", info: "border-info/40", warn: "border-warning/40", danger: "border-destructive/40",
  }[tone];
  return (
    <div className={cn("rounded-xl border bg-card p-3", border, className)}>
      <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold">{icon}{title}</div>
      {children}
    </div>
  );
}
