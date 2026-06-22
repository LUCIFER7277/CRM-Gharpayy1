import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp, computePropertyMetrics } from "@/lib/store";
import { useMemo } from "react";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [{ title: "Inventory pressure - Gharpayy" }, { name: "description", content: "Demand, conversion and pressure scores per property - directs where to push." }],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { properties, leads, tours } = useApp();
  const metrics = useMemo(() => computePropertyMetrics(properties, leads, tours), [properties, leads, tours]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Inventory pressure</h1>
          <p className="text-sm text-muted-foreground">Demand vs conversion vs vacancy. Each card tells you what to do next.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <article key={m.property.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-sm leading-tight">{m.property.name}</h2>
                  <div className="text-xs text-muted-foreground">{m.property.area}</div>
                </div>
                <Signal signal={m.signal} />
              </header>

              <div className="grid grid-cols-2 gap-2">
                <Tile label="Demand" value={m.demandScore} suffix="/100" />
                <Tile label="Pressure" value={m.pressureScore} suffix="/100" accent />
                <Tile label="Conversion" value={m.conversionPct} suffix="%" />
                <Tile label="Occupancy" value={m.occupancyPct} suffix="%" />
              </div>

              <div className="space-y-1.5">
                <Bar label="Pressure" value={m.pressureScore} />
                <Bar label="Conversion" value={m.conversionPct} tone="success" />
                <Bar label="Occupancy" value={m.occupancyPct} tone="info" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-border">
                <KV label="Leads" value={m.leadCount} />
                <KV label="Tours" value={m.tourCount} />
                <KV label="Vacant" value={`${m.property.vacantBeds}/${m.property.totalBeds}`} />
              </div>

              <Recommendation signal={m.signal} property={m.property} />
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Tile({ label, value, suffix, accent }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-lg font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>
        {value}<span className="text-muted-foreground text-xs font-normal">{suffix}</span>
      </div>
    </div>
  );
}

function Bar({ label, value, tone = "accent" }: { label: string; value: number; tone?: "accent" | "success" | "info" }) {
  const cls = { accent: "bg-accent", success: "bg-success", info: "bg-info" }[tone];
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${cls} transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium">{value}</div>
    </div>
  );
}

function Signal({ signal }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"] }) {
  const map = {
    "high-demand-low-conv": { label: "Pricing", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    "low-demand-high-vacancy": { label: "Marketing", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    "high-conv-low-supply": { label: "Expand", cls: "bg-success/10 text-success border-success/30" },
    "balanced": { label: "Balanced", cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const cfg = map[signal];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Recommendation({ signal, property }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"]; property: import("@/lib/types").Property }) {
  const text = {
    "high-demand-low-conv": `Strong demand but conversion lags - review pricing at ₹${property.pricePerBed.toLocaleString()}.`,
    "low-demand-high-vacancy": `${property.vacantBeds} beds vacant. Push marketing in ${property.area}.`,
    "high-conv-low-supply": `Hot conversion with only ${property.vacantBeds} bed${property.vacantBeds === 1 ? "" : "s"} left. Plan expansion.`,
    "balanced": `Healthy. Maintain current playbook.`,
  }[signal];
  return (
    <p className="text-[11px] text-muted-foreground border-t border-border pt-2">{text}</p>
  );
}
