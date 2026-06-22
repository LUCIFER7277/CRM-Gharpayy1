import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVisitWar } from "@/lib/visits/war-store";
import { useApp } from "@/lib/store";
import {
  selectZoneRollups, selectRevenueWalking, selectExpectedBookings,
  selectTopLostReasons, selectInterventionQueue,
} from "@/lib/visits/selectors";
import { cn } from "@/lib/utils";
import { Wallet, TrendingUp, Siren, Flame } from "lucide-react";

export function WarMapPanel({ now }: { now: number }) {
  const records = useVisitWar((s) => s.records);
  const { properties } = useApp();
  const priceFor = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p.pricePerBed] as const));
    return (id: string) => map.get(id) ?? 12000;
  }, [properties]);

  const zones = selectZoneRollups(records, priceFor);
  const walking = selectRevenueWalking(records, priceFor, now);
  const expected = selectExpectedBookings(records, now);
  const topLost = selectTopLostReasons(records, 5);
  const intervention = selectInterventionQueue(records, now);
  const maxWalk = Math.max(1, ...zones.map((z) => z.walking));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroStat icon={Wallet} label="Revenue walking" value={`₹${(walking / 1000).toFixed(0)}k`} tone="success" />
        <HeroStat icon={TrendingUp} label="Expected bookings (24h)" value={expected} tone="info" />
        <HeroStat icon={Flame} label="Intervention queue" value={intervention.length} tone="warning" />
        <HeroStat icon={Siren} label="Active zones" value={zones.length} tone="accent" />
      </div>

      <Card className="p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent mb-3">
          Revenue Heatmap · by zone
        </div>
        {zones.length === 0
          ? <div className="text-xs text-muted-foreground">No zone activity yet.</div>
          : <div className="space-y-2.5">
              {zones.map((z) => (
                <div key={z.area}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold">{z.area}</span>
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      ₹{(z.walking / 1000).toFixed(0)}k walking · {z.total} visits · {z.booked} booked
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-success"
                      style={{ width: `${(z.walking / maxWalk) * 100}%` }}
                    />
                  </div>
                  {z.topObjection && (
                    <div className="text-[10px] text-warning-foreground mt-0.5">leak: {z.topObjection}</div>
                  )}
                </div>
              ))}
            </div>}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent mb-3">
            Top Lost Reasons
          </div>
          {topLost.length === 0
            ? <div className="text-xs text-muted-foreground">No losses logged.</div>
            : <ul className="space-y-1.5">
                {topLost.map(([reason, count]) => (
                  <li key={reason} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{reason.replace(/-/g, " ")}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{count}</Badge>
                  </li>
                ))}
              </ul>}
        </Card>

        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent mb-3">
            Intervention Queue
          </div>
          {intervention.length === 0
            ? <div className="text-xs text-muted-foreground">All clear.</div>
            : <ul className="space-y-1.5">
                {intervention.slice(0, 6).map((v) => (
                  <li key={v.tourId} className="text-xs flex items-center gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                    <Siren className="h-3 w-3 text-destructive shrink-0" />
                    <span className="font-semibold truncate flex-1">{v.leadName}</span>
                    <span className="text-muted-foreground truncate">{v.propertyName}</span>
                  </li>
                ))}
              </ul>}
        </Card>
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, tone }: {
  icon: typeof Wallet; label: string; value: string | number;
  tone: "success" | "info" | "warning" | "accent";
}) {
  const cls = tone === "success" ? "text-success bg-success/10"
    : tone === "warning" ? "text-warning-foreground bg-warning/15"
    : tone === "accent" ? "text-accent bg-accent/10"
    : "text-info bg-info/10";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", cls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
