import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useMemo } from "react";
import { IndianRupee, TrendingUp, Users, Building2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useMountedNow } from "@/hooks/use-now";

export const Route = createFileRoute("/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue - Gharpayy" },
      { name: "description", content: "MRR closed, broken down by TCM, property, and source. Live and trending." },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const { bookings, tcms, properties, leads } = useApp();
  const [now] = useMountedNow();

  const totalMRR = bookings.reduce((s, b) => s + b.amount, 0);

  const byTcm = useMemo(() => {
    const map = new Map<string, { tcmId: string; revenue: number; bookings: number }>();
    for (const b of bookings) {
      const e = map.get(b.tcmId) ?? { tcmId: b.tcmId, revenue: 0, bookings: 0 };
      e.revenue += b.amount;
      e.bookings += 1;
      map.set(b.tcmId, e);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  const byProperty = useMemo(() => {
    const map = new Map<string, { propertyId: string; revenue: number; bookings: number }>();
    for (const b of bookings) {
      const e = map.get(b.propertyId) ?? { propertyId: b.propertyId, revenue: 0, bookings: 0 };
      e.revenue += b.amount;
      e.bookings += 1;
      map.set(b.propertyId, e);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  const bySource = useMemo(() => {
    const map = new Map<string, { source: string; revenue: number; bookings: number }>();
    for (const b of bookings) {
      const lead = leads.find((l) => l.id === b.leadId);
      const src = lead?.source ?? "Unknown";
      const e = map.get(src) ?? { source: src, revenue: 0, bookings: 0 };
      e.revenue += b.amount;
      e.bookings += 1;
      map.set(src, e);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [bookings, leads]);

  // 30-day spark
  const trend = useMemo(() => {
    if (!now) return [];
    const days: { day: string; amt: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const next = startOfDay(subDays(now, i - 1));
      const amt = bookings
        .filter((b) => +new Date(b.ts) >= +d && +new Date(b.ts) < +next)
        .reduce((s, b) => s + b.amount, 0);
      days.push({ day: format(d, "MMM d"), amt });
    }
    return days;
  }, [bookings, now]);

  const maxTrend = Math.max(1, ...trend.map((t) => t.amt));
  const last7 = trend.slice(-7).reduce((s, t) => s + t.amt, 0);
  const prev7 = trend.slice(-14, -7).reduce((s, t) => s + t.amt, 0);
  const wow = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-success" /> Revenue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live MRR closed, broken down by closer, property, and source.
          </p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="MRR closed" value={`₹${(totalMRR / 1000).toFixed(0)}k`} sub={`${bookings.length} booking${bookings.length === 1 ? "" : "s"}`} accent="success" />
          <Tile label="Last 7 days" value={`₹${(last7 / 1000).toFixed(0)}k`} sub={prev7 > 0 ? `${wow >= 0 ? "+" : ""}${wow}% WoW` : "-"} accent={wow >= 0 ? "success" : "destructive"} />
          <Tile label="Top closer" value={byTcm[0] ? tcms.find((t) => t.id === byTcm[0].tcmId)?.name?.split(" ")[0] ?? "-" : "-"} sub={byTcm[0] ? `₹${(byTcm[0].revenue / 1000).toFixed(0)}k` : ""} accent="accent" />
          <Tile label="Top property" value={byProperty[0] ? properties.find((p) => p.id === byProperty[0].propertyId)?.name ?? "-" : "-"} sub={byProperty[0] ? `${byProperty[0].bookings} booking${byProperty[0].bookings === 1 ? "" : "s"}` : ""} />
        </div>

        {/* 30-day trend */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <h2 className="font-display text-sm font-semibold">30-day MRR trend</h2>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">peak ₹{(maxTrend / 1000).toFixed(0)}k</div>
          </header>
          <div className="p-4">
            {trend.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">Loading…</div>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {trend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full relative" style={{ height: `${(t.amt / maxTrend) * 100}%`, minHeight: t.amt > 0 ? "4px" : "0" }}>
                      <div className="absolute inset-0 bg-success/70 group-hover:bg-success rounded-sm transition-colors" />
                    </div>
                    {i % 5 === 0 && <span className="text-[9px] font-mono text-muted-foreground">{t.day.split(" ")[1]}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Three breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Breakdown title="By TCM" icon={Users} rows={byTcm.map((r) => ({
            label: tcms.find((t) => t.id === r.tcmId)?.name ?? r.tcmId,
            sub: `${r.bookings} booking${r.bookings === 1 ? "" : "s"}`,
            value: r.revenue,
          }))} total={totalMRR} />
          <Breakdown title="By property" icon={Building2} rows={byProperty.map((r) => ({
            label: properties.find((p) => p.id === r.propertyId)?.name ?? r.propertyId,
            sub: properties.find((p) => p.id === r.propertyId)?.area ?? "",
            value: r.revenue,
          }))} total={totalMRR} />
          <Breakdown title="By source" icon={TrendingUp} rows={bySource.map((r) => ({
            label: r.source,
            sub: `${r.bookings} booking${r.bookings === 1 ? "" : "s"}`,
            value: r.revenue,
          }))} total={totalMRR} />
        </div>
      </div>
    </AppShell>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: "success" | "accent" | "destructive" }) {
  const cls = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : accent === "accent" ? "text-accent" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-semibold mt-1 ${cls}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub || "\u00a0"}</div>
    </div>
  );
}

function Breakdown({ title, icon: Icon, rows, total }: { title: string; icon: typeof Users; rows: { label: string; sub: string; value: number }[]; total: number }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold">{title}</h2>
      </header>
      <div className="divide-y divide-border">
        {rows.length === 0 && <div className="p-6 text-xs text-center text-muted-foreground">No bookings yet.</div>}
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
          return (
            <div key={r.label} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.sub}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">₹{(r.value / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{pct}%</div>
                </div>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-success" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
