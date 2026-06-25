import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp, computePropertyMetrics } from "@/lib/store";
import { useMemo, useState } from "react";
import { Building2, AlertTriangle, ArrowUpRight, TrendingUp, Users, CheckCircle2, Search, Filter } from "lucide-react";
import { KpiCard } from "@/components/atoms";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [{ title: "Inventory pressure - Gharpayy" }, { name: "description", content: "Demand, conversion and pressure scores per property - directs where to push." }],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { properties, leads, tours } = useApp();
  const metrics = useMemo(() => computePropertyMetrics(properties, leads, tours), [properties, leads, tours]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSignal, setFilterSignal] = useState("all");

  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      const matchesSearch = 
        m.property.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.property.area || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSignal = filterSignal === "all" || m.signal === filterSignal;
      return matchesSearch && matchesSignal;
    });
  }, [metrics, searchTerm, filterSignal]);

  // Aggregate stats
  const totalProperties = properties.length;
  const totalVacant = properties.reduce((sum, p) => sum + p.vacantBeds, 0);
  const totalBeds = properties.reduce((sum, p) => sum + p.totalBeds, 0);
  const attentionNeeded = metrics.filter(m => m.signal !== "balanced").length;

  const SIGNALS = [
    { id: "all", label: "All Properties" },
    { id: "high-demand-low-conv", label: "Pricing Issue" },
    { id: "low-demand-high-vacancy", label: "Push Marketing" },
    { id: "high-conv-low-supply", label: "Expand Capacity" },
    { id: "balanced", label: "Balanced" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-8 pb-12 max-w-7xl mx-auto">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Inventory Intelligence</h1>
          <p className="text-sm text-muted-foreground">Demand, conversion, and vacancy mapped to actionable signals.</p>
        </header>

        {/* Top KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard 
            label="Total Properties" 
            value={totalProperties} 
            sub="Active portfolio" 
            tone="default" 
          />
          <KpiCard 
            label="Vacant Beds" 
            value={totalVacant} 
            sub={`${Math.round(((totalBeds - totalVacant) / totalBeds) * 100) || 0}% overall occupancy`} 
            tone="info" 
          />
          <KpiCard 
            label="Action Required" 
            value={attentionNeeded} 
            sub="Properties flagged" 
            tone={attentionNeeded > 0 ? "destructive" : "success"} 
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search properties or areas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />
            {SIGNALS.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterSignal(s.id)}
                className={`shrink-0 snap-start rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${filterSignal === s.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Property Grid */}
        {filteredMetrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-muted/30 rounded-2xl border-2 border-dashed border-border/60">
            <div className="h-12 w-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 shadow-sm">
              <Filter className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No properties found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
              There are no properties matching the "{SIGNALS.find(s => s.id === filterSignal)?.label}" signal right now.
            </p>
            {(searchTerm !== "" || filterSignal !== "all") && (
              <button 
                onClick={() => { setSearchTerm(""); setFilterSignal("all"); }}
                className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMetrics.map((m) => (
            <article 
              key={m.property.id} 
              className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-all duration-300 hover:border-accent/40"
            >
              {/* Header */}
              <div className="p-3 border-b border-border/50 bg-muted/10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display font-semibold text-sm leading-tight truncate group-hover:text-accent transition-colors">{m.property.name}</h2>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {m.property.area}
                  </div>
                </div>
                <div className="shrink-0">
                  <SignalBadge signal={m.signal} />
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 flex flex-col gap-4">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Leads" value={m.leadCount} icon={Users} />
                  <Stat label="Tours" value={m.tourCount} icon={ArrowUpRight} />
                  <Stat label="Vacant" value={`${m.property.vacantBeds}/${m.property.totalBeds}`} />
                </div>

                {/* Progress Bars */}
                <div className="space-y-2.5 mt-auto">
                  <ProgressBar label="Demand Score" value={m.demandScore} max={100} tone="primary" />
                  <ProgressBar label="Conversion" value={m.conversionPct} max={100} tone="success" suffix="%" />
                  <ProgressBar label="Occupancy" value={m.occupancyPct} max={100} tone="info" suffix="%" />
                  <ProgressBar label="Overall Pressure" value={m.pressureScore} max={100} tone="accent" />
                </div>
              </div>

              {/* Action Banner */}
              <ActionBanner signal={m.signal} property={m.property} />
            </article>
          ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon?: any; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-muted/40 border border-transparent hover:border-border transition-colors">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`text-sm font-semibold font-display tabular-nums mt-0.5 ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max = 100, tone = "primary", suffix = "" }: { label: string; value: number; max?: number; tone?: "primary" | "accent" | "success" | "info" | "warning" | "destructive"; suffix?: string }) {
  const tones = {
    primary: "bg-primary text-primary",
    accent: "bg-accent text-accent",
    success: "bg-success text-success",
    info: "bg-info text-info",
    warning: "bg-warning text-warning-foreground",
    destructive: "bg-destructive text-destructive",
  };
  const colorCls = tones[tone];
  
  // Clean up NaN fallback just in case
  const safeValue = Number.isNaN(value) ? 0 : value;
  const pct = Math.min(100, Math.max(0, (safeValue / max) * 100));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-end">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{safeValue}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden relative">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${colorCls.split(' ')[0]}`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

function SignalBadge({ signal }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"] }) {
  const map = {
    "high-demand-low-conv": { label: "Pricing Issue", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive border-destructive/30" },
    "low-demand-high-vacancy": { label: "Push Marketing", icon: TrendingUp, cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    "high-conv-low-supply": { label: "Expand Capacity", icon: CheckCircle2, cls: "bg-success/10 text-success border-success/30" },
    "balanced": { label: "Balanced", icon: CheckCircle2, cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const cfg = map[signal];
  const Icon = cfg.icon;

  return (
    <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </div>
  );
}

function ActionBanner({ signal, property }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"]; property: import("@/lib/types").Property }) {
  const map = {
    "high-demand-low-conv": { 
      text: `Strong demand but conversion lags. Review pricing (currently ₹${property.pricePerBed.toLocaleString()}).`,
      cls: "bg-destructive/10 text-destructive border-t-destructive/20"
    },
    "low-demand-high-vacancy": { 
      text: `${property.vacantBeds} beds vacant. Increase top-of-funnel marketing in ${property.area}.`,
      cls: "bg-warning/10 text-warning-foreground border-t-warning/20"
    },
    "high-conv-low-supply": { 
      text: `Hot conversion with only ${property.vacantBeds} bed${property.vacantBeds === 1 ? "" : "s"} left. Plan expansion.`,
      cls: "bg-success/10 text-success border-t-success/20"
    },
    "balanced": { 
      text: `Healthy metrics. Maintain current operational playbook.`,
      cls: "bg-muted/30 text-muted-foreground border-t-border"
    },
  };
  
  const cfg = map[signal];
  return (
    <div className={`px-3 py-2 text-[10px] font-medium border-t ${cfg.cls}`}>
      {cfg.text}
    </div>
  );
}
