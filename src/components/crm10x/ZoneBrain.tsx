import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers, Users, IndianRupee, Activity, AlertTriangle,
  TrendingUp, TrendingDown, Brain, Building2, Home, ChevronLeft
} from "lucide-react";

interface ZoneBrainData {
  zoneId: string;
  zoneName: string;
  city: string;
  tcmCount: number;
  propertiesCount: number;
  properties: { id: string; name: string }[];
  activeLeads: number;
  revenueINR: number;
  slaBreaches: number;
}

/**
 * Zone P&L + Capacity Brain - per-zone revenue, capacity load,
 * SLA health, and property assignment synced from backend.
 */
export function ZoneBrain() {
  const navigate = useNavigate();
  const [zones, setZones] = useState<ZoneBrainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient.get<ZoneBrainData[]>("/zones/brain");
        setZones(data);
      } catch (err) {
        console.error("Failed to load zone brain data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalRevenue = zones.reduce((a, z) => a + z.revenueINR, 0);
  const totalActive = zones.reduce((a, z) => a + z.activeLeads, 0);
  const totalSlaFail = zones.reduce((a, z) => a + z.slaBreaches, 0);
  const totalTcms = zones.reduce((a, z) => a + z.tcmCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => navigate({ to: "/" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Zone Brain
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-zone revenue, capacity load, SLA health and properties across {zones.length} zones.
          </p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={IndianRupee} label="Total MRR" value={`₹${(totalRevenue / 1000).toFixed(0)}k`} tone="success" />
        <Stat icon={Activity} label="Active leads" value={totalActive} />
        <Stat icon={Users} label="TCMs" value={totalTcms} />
        <Stat icon={AlertTriangle} label="SLA breaches" value={totalSlaFail} tone={totalSlaFail > 0 ? "danger" : "success"} />
      </div>

      {/* Zone grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map((z) => {
          const loadPerTcm = z.tcmCount === 0 ? z.activeLeads : +(z.activeLeads / z.tcmCount).toFixed(1);
          let pressureLevel: "balanced" | "overloaded" | "underloaded" | "leaking" = "balanced";
          
          if (z.tcmCount === 0 && z.activeLeads > 0) pressureLevel = "leaking";
          else if (loadPerTcm > 25) pressureLevel = "overloaded";
          else if (loadPerTcm < 5 && z.activeLeads > 0) pressureLevel = "underloaded";
          else if (z.slaBreaches >= 3) pressureLevel = "leaking";

          return (
            <Card
              key={z.zoneId}
              className={`p-4 space-y-3 ${
                pressureLevel === "leaking"
                  ? "border-destructive/40 bg-destructive/5"
                  : pressureLevel === "overloaded"
                    ? "border-warning/40 bg-warning/5"
                    : pressureLevel === "underloaded"
                      ? "border-info/40 bg-info/5"
                      : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display font-bold text-base">{z.zoneName}</div>
                  <div className="text-[11px] text-muted-foreground">{z.city} · {z.tcmCount} TCM{z.tcmCount !== 1 ? 's' : ''} assigned</div>
                </div>
                <PressurePill level={pressureLevel} />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Mini label="Active" value={z.activeLeads} />
                <Mini label="₹/mo" value={`₹${(z.revenueINR / 1000).toFixed(0)}k`} tone={z.revenueINR > 0 ? "good" : "neutral"} />
                <Mini label="SLA fail" value={z.slaBreaches} tone={z.slaBreaches >= 3 ? "bad" : z.slaBreaches > 0 ? "neutral" : "good"} />
              </div>
              
              <div className="grid grid-cols-2 gap-1.5">
                <Mini label="TCMs" value={z.tcmCount} tone={z.tcmCount > 0 ? "good" : "bad"} />
                <Mini label="Properties" value={z.propertiesCount} tone={z.propertiesCount > 0 ? "good" : "neutral"} />
              </div>

              {z.properties.length > 0 && (
                <div className="pt-2 border-t border-border mt-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Home className="h-3 w-3" /> Properties
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {z.properties.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-[10px] font-normal bg-accent/10 hover:bg-accent/20">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

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
