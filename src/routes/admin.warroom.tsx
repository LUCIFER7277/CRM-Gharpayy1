import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { computeMoneyMap, computeSlaBreaches } from "@/admin/lib/supreme-metrics";
import { useVisitWar } from "@/lib/visits/war-store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/warroom")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "War-Room TV \u2014 Admin" }] }),
  component: WarRoomTV,
});

function inrL(n: number) {
  if (n >= 10_000_000) return `\u20B9${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `\u20B9${(n / 100_000).toFixed(1)}L`;
  return `\u20B9${Math.round(n).toLocaleString("en-IN")}`;
}

function WarRoomTV() {
  const rows = useAdminRows();
  const alerts = useVisitWar((s) => s.alerts).slice(0, 8);
  const money = useMemo(() => computeMoneyMap(rows), [rows]);
  const breaches = useMemo(() => computeSlaBreaches(rows).slice(0, 8), [rows]);
  const hot = useMemo(() => rows.filter((r) => !r.booked && r.probability >= 70).sort((a, b) => b.probability - a.probability).slice(0, 8), [rows]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="fixed inset-0 bg-background text-foreground overflow-auto p-6 font-display">
      <header className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-destructive font-bold">War-Room \u00B7 Live \u00B7 Admin TV</div>
          <h1 className="text-4xl font-bold tracking-tight">Gharpayy Cockpit</h1>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono tabular-nums">{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="text-[11px] text-muted-foreground">auto-refresh \u00B7 last tick #{tick}</div>
          <Link to="/admin" className="text-[11px] underline text-muted-foreground">exit</Link>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-3 mb-4">
        <BigTile label="Booked 12mo" value={inrL(money.bookedRevenue)} tone="success" />
        <BigTile label="Weighted pipeline" value={inrL(money.pipelineRevenue)} tone="info" />
        <BigTile label="Hot \u226570%" value={inrL(money.hotRevenue)} tone="accent" />
        <BigTile label="At risk" value={inrL(money.atRiskRevenue)} tone="warn" />
        <BigTile label="Walking 30d" value={inrL(money.walkingRevenue)} tone="danger" />
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Wall title="\uD83D\uDD25 Most likely to close">
          {hot.map((r, i) => (
            <Row key={r.lead.id} idx={i + 1} left={r.lead.name} mid={r.tcm?.name ?? "\u2014"} right={`${r.probability}%`} />
          ))}
          {!hot.length && <Empty>No hot leads.</Empty>}
        </Wall>
        <Wall title="\u23F0 SLA breaches by \u20B9">
          {breaches.map((b, i) => (
            <Row key={b.leadId + b.type} idx={i + 1} left={b.leadName} mid={b.type} right={inrL(b.expectedValue)} tone="danger" />
          ))}
          {!breaches.length && <Empty>No breaches. Clean.</Empty>}
        </Wall>
        <Wall title="\uD83D\uDCE1 Live alerts">
          {alerts.map((a) => (
            <li key={a.id} className="flex gap-3 text-base py-1 border-b border-border/40">
              <span className="font-mono text-muted-foreground text-sm">{new Date(a.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="flex-1">{a.message}</span>
            </li>
          ))}
          {!alerts.length && <Empty>Silent. All quiet.</Empty>}
        </Wall>
      </section>
    </div>
  );
}

function BigTile({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "accent" | "warn" | "danger" }) {
  const cls = { success: "text-success", info: "text-info", accent: "text-accent", warn: "text-warning", danger: "text-destructive" }[tone];
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-5xl font-bold mt-2 tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Wall({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="text-lg font-semibold mb-2">{title}</div>
      <ul className="space-y-0">{children}</ul>
    </div>
  );
}

function Row({ idx, left, mid, right, tone }: { idx: number; left: string; mid: string; right: string; tone?: "danger" }) {
  return (
    <li className="flex items-center gap-3 py-1.5 border-b border-border/40 text-base">
      <span className="w-6 text-center font-mono text-muted-foreground">{idx}</span>
      <span className="flex-1 truncate font-medium">{left}</span>
      <span className="text-sm text-muted-foreground truncate w-24 text-right">{mid}</span>
      <span className={`font-mono tabular-nums w-20 text-right ${tone === "danger" ? "text-destructive" : "text-accent"}`}>{right}</span>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="text-muted-foreground py-3 text-center">{children}</li>;
}
