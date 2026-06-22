import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useMemo } from "react";
import { MapPin, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [
      { title: "Demand heatmap - Gharpayy" },
      { name: "description", content: "Area-level demand vs supply: leads, tours, conversion, vacancy, with strategic insights." },
    ],
  }),
  component: HeatmapPage,
});

interface AreaRow {
  area: string;
  leads: number;
  hotLeads: number;
  tours: number;
  bookings: number;
  conversion: number;
  avgBudget: number;
  totalBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  insight: { label: string; tone: "hot" | "warm" | "cold" | "balanced"; detail: string };
  pressure: number; // 0-100
}

function HeatmapPage() {
  const { leads, tours, properties, bookings } = useApp();

  const rows = useMemo<AreaRow[]>(() => {
    const areas = new Set<string>();
    properties.forEach((p) => areas.add(p.area));
    leads.forEach((l) => areas.add(l.preferredArea));

    return Array.from(areas).map((area) => {
      const areaLeads = leads.filter((l) => l.preferredArea.toLowerCase() === area.toLowerCase());
      const areaProps = properties.filter((p) => p.area.toLowerCase() === area.toLowerCase());
      const areaTours = tours.filter((t) => {
        const prop = properties.find((p) => p.id === t.propertyId);
        return prop?.area.toLowerCase() === area.toLowerCase();
      });
      const areaBookings = bookings.filter((b) => {
        const prop = properties.find((p) => p.id === b.propertyId);
        return prop?.area.toLowerCase() === area.toLowerCase();
      }).length;
      const completedTours = areaTours.filter((t) => t.status === "completed").length;
      const conversion = completedTours > 0 ? Math.round((areaBookings / completedTours) * 100) : 0;
      const totalBeds = areaProps.reduce((s, p) => s + p.totalBeds, 0);
      const vacantBeds = areaProps.reduce((s, p) => s + p.vacantBeds, 0);
      const occupancy = totalBeds > 0 ? Math.round(((totalBeds - vacantBeds) / totalBeds) * 100) : 0;
      const hotLeads = areaLeads.filter((l) => l.intent === "hot").length;
      const avgBudget = areaLeads.length > 0
        ? Math.round(areaLeads.reduce((s, l) => s + l.budget, 0) / areaLeads.length)
        : 0;

      // Demand vs supply insight
      const demand = areaLeads.length;
      const supply = vacantBeds;
      let insight: AreaRow["insight"];
      if (demand >= supply * 2 && supply > 0) {
        insight = { label: "Expand supply", tone: "hot", detail: `${demand} leads vs ${supply} beds - high demand, undersupplied.` };
      } else if (supply >= demand * 2 && totalBeds > 0) {
        insight = { label: "Push marketing", tone: "cold", detail: `${supply} vacant vs ${demand} leads - oversupply, weak demand.` };
      } else if (conversion >= 40) {
        insight = { label: "High-converting", tone: "warm", detail: `${conversion}% close rate - replicate playbook elsewhere.` };
      } else if (demand > 0 && conversion < 15) {
        insight = { label: "Pricing issue?", tone: "hot", detail: `${demand} leads but only ${conversion}% convert - investigate.` };
      } else {
        insight = { label: "Balanced", tone: "balanced", detail: "Healthy demand-supply ratio." };
      }

      const pressure = Math.min(100, Math.round((demand / Math.max(1, supply)) * 50));
      return { area, leads: demand, hotLeads, tours: completedTours, bookings: areaBookings, conversion, avgBudget, totalBeds, vacantBeds, occupancyPct: occupancy, insight, pressure };
    }).sort((a, b) => b.pressure - a.pressure);
  }, [leads, tours, properties, bookings]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <MapPin className="h-6 w-6 text-accent" /> Demand heatmap
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where the market is hot and where you're leaking. Strategic, not operational.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const cfg = {
              hot: { border: "border-destructive/40", bg: "bg-destructive/5", text: "text-destructive", icon: TrendingUp },
              warm: { border: "border-success/40", bg: "bg-success/5", text: "text-success", icon: TrendingUp },
              cold: { border: "border-warning/40", bg: "bg-warning/10", text: "text-warning-foreground", icon: TrendingDown },
              balanced: { border: "border-border", bg: "bg-card", text: "text-muted-foreground", icon: AlertCircle },
            }[r.insight.tone];
            const Icon = cfg.icon;
            return (
              <div key={r.area} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-semibold">{r.area}</div>
                    <div className={`inline-flex items-center gap-1 text-[11px] font-medium mt-0.5 ${cfg.text}`}>
                      <Icon className="h-3 w-3" /> {r.insight.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pressure</div>
                    <div className="font-mono text-sm font-semibold">{r.pressure}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="Leads" value={r.leads} hot={r.hotLeads} />
                  <Stat label="Tours" value={r.tours} />
                  <Stat label="Booked" value={r.bookings} mono />
                  <Stat label="Conv %" value={`${r.conversion}%`} mono />
                  <Stat label="Vacant" value={`${r.vacantBeds}/${r.totalBeds}`} mono />
                  <Stat label="Avg ₹" value={r.avgBudget ? `${(r.avgBudget / 1000).toFixed(0)}k` : "-"} mono />
                </div>

                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${r.insight.tone === "hot" ? "bg-destructive" : r.insight.tone === "warm" ? "bg-success" : r.insight.tone === "cold" ? "bg-warning" : "bg-muted-foreground"}`} style={{ width: `${r.pressure}%` }} />
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">{r.insight.detail}</p>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No area data yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, mono, hot }: { label: string; value: string | number; mono?: boolean; hot?: number }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>
        {value}
        {hot !== undefined && hot > 0 && <span className="ml-1 text-destructive font-mono text-[10px]">·{hot}🔥</span>}
      </div>
    </div>
  );
}
