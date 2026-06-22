import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useSettings } from "@/myt/lib/settings-context";
import { zoneSnapshots } from "@/lib/crm10x/analytics";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Layers, Users, IndianRupee, Activity, AlertTriangle,
  TrendingUp, TrendingDown, ArrowRight, Brain, Building2,
} from "lucide-react";

/**
 * Zone P&L + Capacity Brain - per-zone revenue, conversion, SLA and
 * TCM load with auto rebalancing recommendations.
 */
export function ZoneBrain() {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const bookings = useApp((s) => s.bookings);
  const { settings } = useSettings();

  const zones = useMemo(
    () => zoneSnapshots({ zones: settings.zones, tcms, leads, bookings }),
    [settings.zones, tcms, leads, bookings],
  );

  // Aggregates
  const totalRevenue = zones.reduce((a, z) => a + z.revenueINR, 0);
  const totalActive = zones.reduce((a, z) => a + z.activeLeads, 0);
  const totalSlaFail = zones.reduce((a, z) => a + z.slaBreaches, 0);
  const overloaded = zones.filter((z) => z.pressureLevel === "overloaded");
  const underloaded = zones.filter((z) => z.pressureLevel === "underloaded");
  const leaking = zones.filter((z) => z.pressureLevel === "leaking");

  // Rebalancing suggestions: pair overloaded with underloaded
  const rebalances = useMemo(() => {
    const moves: { from: string; to: string; suggestedLeads: number; reason: string }[] = [];
    overloaded.forEach((src) => {
      const target = underloaded[0];
      if (target) {
        const excess = Math.max(0, src.activeLeads - 25 * Math.max(1, src.tcmIds.length));
        const transfer = Math.min(excess, Math.max(5, 25 * target.tcmIds.length - target.activeLeads));
        if (transfer > 0) {
          moves.push({
            from: src.zoneName,
            to: target.zoneName,
            suggestedLeads: transfer,
            reason: `${src.zoneName} at ${src.loadPerTcm}/TCM, ${target.zoneName} has spare capacity.`,
          });
        }
      }
    });
    return moves;
  }, [overloaded, underloaded]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-accent" /> Zone Brain
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-zone revenue, capacity load, SLA health and auto-rebalancing across {zones.length} Bangalore zones.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={IndianRupee} label="Total MRR" value={`₹${(totalRevenue / 1000).toFixed(0)}k`} tone="success" />
        <Stat icon={Activity} label="Active leads" value={totalActive} />
        <Stat icon={Users} label="TCMs" value={tcms.length} />
        <Stat icon={AlertTriangle} label="SLA breaches" value={totalSlaFail} tone={totalSlaFail > 0 ? "danger" : "success"} />
      </div>

      {/* Rebalancing */}
      {(rebalances.length > 0 || leaking.length > 0) && (
        <Card className="p-4 space-y-2 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-accent" />
            <h2 className="font-display font-semibold">Rebalance suggestions</h2>
          </div>
          {rebalances.map((r, i) => (
            <div key={i} className="rounded-md border border-accent/30 bg-card p-2.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Badge className="bg-warning/15 text-warning text-[10px]">{r.from}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge className="bg-info/15 text-info text-[10px]">{r.to}</Badge>
                <span className="text-xs text-muted-foreground">~{r.suggestedLeads} leads</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{r.reason}</div>
            </div>
          ))}
          {leaking.map((z) => (
            <div key={z.zoneId} className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm">
              <div className="font-medium text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> Leaking · {z.zoneName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">→ {z.recommendation}</div>
            </div>
          ))}
        </Card>
      )}

      {/* Zone grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map((z) => (
          <Card
            key={z.zoneId}
            className={`p-4 space-y-3 ${
              z.pressureLevel === "leaking"
                ? "border-destructive/40 bg-destructive/5"
                : z.pressureLevel === "overloaded"
                  ? "border-warning/40 bg-warning/5"
                  : z.pressureLevel === "underloaded"
                    ? "border-info/40 bg-info/5"
                    : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-base">{z.zoneName}</div>
                <div className="text-[11px] text-muted-foreground">{z.city} · {z.tcmIds.length} TCM</div>
              </div>
              <PressurePill level={z.pressureLevel} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Mini label="Active" value={z.activeLeads} />
              <Mini label="Booked" value={z.bookings} />
              <Mini label="Conv%" value={`${z.conversion}%`} tone={z.conversion >= 20 ? "good" : z.conversion >= 10 ? "neutral" : "bad"} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Mini label="₹/mo" value={`₹${(z.revenueINR / 1000).toFixed(0)}k`} tone={z.revenueINR > 0 ? "good" : "neutral"} />
              <Mini label="Load/TCM" value={z.loadPerTcm} tone={z.loadPerTcm > 25 ? "bad" : z.loadPerTcm > 15 ? "neutral" : "good"} />
              <Mini label="SLA fail" value={z.slaBreaches} tone={z.slaBreaches >= 3 ? "bad" : z.slaBreaches > 0 ? "neutral" : "good"} />
            </div>

            <div className="text-[11px] text-muted-foreground italic border-l-2 border-accent pl-2">
              {z.recommendation}
            </div>

            {z.tcmIds.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                {z.tcmIds.map((id) => {
                  const t = tcms.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <Badge key={id} variant="outline" className="text-[9px]">
                      {t.initials}
                    </Badge>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Capacity formula explainer */}
      <Card className="p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <Building2 className="h-4 w-4" /> How load is calculated
        </div>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong className="text-foreground">Load/TCM</strong> = active leads ÷ TCM count for that zone.</li>
          <li><strong className="text-warning">Overloaded</strong> ≥ 25 active leads per TCM.</li>
          <li><strong className="text-info">Underloaded</strong> &lt; 5 active leads per TCM (capacity available).</li>
          <li><strong className="text-destructive">Leaking</strong> = no TCMs assigned, or 3+ leads never contacted in 24h+, or conversion below 15%.</li>
        </ul>
      </Card>
    </div>
  );
}

function PressurePill({ level }: { level: "balanced" | "overloaded" | "underloaded" | "leaking" }) {
  const map = {
    balanced: { label: "Balanced", icon: TrendingUp, cls: "border-success text-success" },
    overloaded: { label: "Overloaded", icon: TrendingUp, cls: "border-warning text-warning" },
    underloaded: { label: "Spare cap.", icon: TrendingDown, cls: "border-info text-info" },
    leaking: { label: "Leaking", icon: AlertTriangle, cls: "border-destructive text-destructive" },
  } as const;
  const m = map[level];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${m.cls}`}>
      <Icon className="h-2.5 w-2.5" /> {m.label}
    </Badge>
  );
}

function Stat({
  icon: Icon, label, value, tone,
}: { icon: typeof Layers; label: string; value: string | number; tone?: "success" | "danger" }) {
  const cls =
    tone === "success" ? "text-success border-success/30 bg-success/5"
      : tone === "danger" ? "text-destructive border-destructive/30 bg-destructive/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "neutral" ? "text-warning" : "";
  return (
    <div className="rounded bg-background/60 px-1.5 py-1.5 text-center">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold font-mono ${cls}`}>{value}</div>
    </div>
  );
}
