import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import {
  computeMoneyMap, computeTcmHealth, computeAreaPulse,
  computeSourceROI, collectVoiceOfCustomer, computeSlaBreaches,
} from "@/admin/lib/supreme-metrics";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/supreme")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Admin Supreme \u2014 God Mode" }] }),
  component: SupremePage,
});

function inrL(n: number) {
  if (n >= 10_000_000) return `\u20B9${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `\u20B9${(n / 100_000).toFixed(1)}L`;
  return `\u20B9${Math.round(n).toLocaleString("en-IN")}`;
}
function pct(n: number) { return `${Math.round(n * 100)}%`; }

function SupremePage() {
  const rows = useAdminRows();
  const money = useMemo(() => computeMoneyMap(rows), [rows]);
  const tcms = useMemo(() => computeTcmHealth(rows), [rows]);
  const areas = useMemo(() => computeAreaPulse(rows), [rows]).slice(0, 8);
  const sources = useMemo(() => computeSourceROI(rows), [rows]).slice(0, 6);
  const voices = useMemo(() => collectVoiceOfCustomer(rows, 10), [rows]);
  const breaches = useMemo(() => computeSlaBreaches(rows), [rows]);

  return (
    <AdminShell title="Admin Supreme \u00B7 God Mode" sub="Every rupee, every person, every breach \u2014 one screen.">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Booked revenue (12mo)" value={inrL(money.bookedRevenue)} tone="success" />
        <Tile label="Pipeline (weighted)" value={inrL(money.pipelineRevenue)} tone="info" />
        <Tile label="Hot revenue \u226570%" value={inrL(money.hotRevenue)} tone="accent" />
        <Tile label="At-risk (stale \u22653d)" value={inrL(money.atRiskRevenue)} tone="warn" />
        <Tile label="Walking (lost 30d)" value={inrL(money.walkingRevenue)} tone="danger" />
      </section>

      <div className="grid lg:grid-cols-3 gap-3 mt-3">
        <Panel title="SLA breach board" sub="Most expensive overdue work first" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
                <tr><th className="text-left py-1.5">Lead</th><th className="text-left">TCM</th><th className="text-left">Breach</th><th className="text-right">Age</th><th className="text-right">Prob</th><th className="text-right">EV</th></tr>
              </thead>
              <tbody>
                {breaches.map((b) => (
                  <tr key={b.leadId + b.type} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-1.5"><Link to="/admin/leads" className="hover:underline">{b.leadName}</Link></td>
                    <td className="text-muted-foreground">{b.tcm}</td>
                    <td><span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[10px]">{b.type}</span></td>
                    <td className="text-right font-mono">{Math.round(b.ageHrs)}h</td>
                    <td className="text-right font-mono">{b.probability}%</td>
                    <td className="text-right font-mono text-accent">{inrL(b.expectedValue)}</td>
                  </tr>
                ))}
                {!breaches.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No breaches. Clean slate.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Voice of customer" sub="Raw objections & lost-reasons, latest first">
          <ul className="space-y-2 text-xs max-h-[420px] overflow-auto pr-1">
            {voices.map((v, i) => (
              <li key={i} className="border-l-2 border-destructive/60 pl-2">
                <div className="text-foreground">"{v.text}"</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">\u2014 {v.leadName} \u00B7 {new Date(v.ts).toLocaleDateString("en-IN")}</div>
              </li>
            ))}
            {!voices.length && <li className="text-muted-foreground">No captured voice yet.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="People health \u00B7 load & burn" sub="Watch and burn flags drive coaching priority" className="mt-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {tcms.map((t) => (
            <div key={t.tcmId} className={cn(
              "rounded-lg border p-2.5 bg-card",
              t.riskFlag === "burn" && "border-destructive/60",
              t.riskFlag === "watch" && "border-warning/60",
              t.riskFlag === "ok" && "border-border",
            )}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{t.name}</div>
                <span className={cn(
                  "text-[10px] uppercase px-1.5 py-0.5 rounded",
                  t.riskFlag === "burn" && "bg-destructive/20 text-destructive",
                  t.riskFlag === "watch" && "bg-warning/20 text-warning",
                  t.riskFlag === "ok" && "bg-success/20 text-success",
                )}>{t.riskFlag}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
                <Stat k="Open" v={t.open} />
                <Stat k="Hot" v={t.hot} accent />
                <Stat k="Dormant" v={t.dormant} />
                <Stat k="Booked" v={t.booked} />
                <Stat k="Lost" v={t.lost} />
                <Stat k="CVR" v={pct(t.conversion)} />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground flex justify-between">
                <span>Pipeline {inrL(t.pipelineValue)}</span>
                <span>Age {t.avgAgeDays}d</span>
              </div>
              <div className="mt-1 h-1 rounded bg-muted overflow-hidden">
                <div className={cn(
                  "h-full",
                  t.loadScore > 80 ? "bg-destructive" : t.loadScore > 55 ? "bg-warning" : "bg-success",
                )} style={{ width: `${t.loadScore}%` }} />
              </div>
            </div>
          ))}
          {!tcms.length && <div className="text-muted-foreground text-xs">No TCM data.</div>}
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <Panel title="Area pulse" sub="Demand vs lost-rate by preferred area">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr><th className="text-left py-1.5">Area</th><th className="text-right">Leads</th><th className="text-right">Hot</th><th className="text-right">Booked</th><th className="text-right">Lost %</th><th className="text-right">Revenue</th><th className="text-left pl-2">Top objection</th></tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.area} className="border-b border-border/60">
                  <td className="py-1.5 font-medium">{a.area}</td>
                  <td className="text-right font-mono">{a.leads}</td>
                  <td className="text-right font-mono text-accent">{a.hot}</td>
                  <td className="text-right font-mono text-success">{a.booked}</td>
                  <td className={cn("text-right font-mono", a.lostRate > 0.4 && "text-destructive")}>{pct(a.lostRate)}</td>
                  <td className="text-right font-mono">{inrL(a.revenue)}</td>
                  <td className="pl-2 text-muted-foreground">{a.topObjection}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Source ROI" sub="Which channel actually books beds">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr><th className="text-left py-1.5">Source</th><th className="text-right">Leads</th><th className="text-right">Booked</th><th className="text-right">CVR</th><th className="text-right">Avg \u20B9</th><th className="text-right">Revenue</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-b border-border/60">
                  <td className="py-1.5 font-medium capitalize">{s.source}</td>
                  <td className="text-right font-mono">{s.leads}</td>
                  <td className="text-right font-mono text-success">{s.booked}</td>
                  <td className="text-right font-mono">{pct(s.cvr)}</td>
                  <td className="text-right font-mono">{inrL(s.avgBudget)}</td>
                  <td className="text-right font-mono text-accent">{inrL(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </AdminShell>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "accent" | "warn" | "danger" }) {
  const cls = {
    success: "text-success", info: "text-info", accent: "text-accent",
    warn: "text-warning", danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-display font-semibold", cls)}>{value}</div>
    </div>
  );
}

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <div className="mb-2">
        <div className="text-xs font-semibold">{title}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string | number; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-muted-foreground">{k}</div>
      <div className={cn("font-mono text-sm", accent && "text-accent")}>{v}</div>
    </div>
  );
}
