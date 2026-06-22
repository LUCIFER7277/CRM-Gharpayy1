import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectTeamPulse, type TeamPulseRow } from "@/lib/visits/selectors";
import { useVisitWar } from "@/lib/visits/war-store";
import { AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { CopyChip } from "@/components/atc/CopyChip";
import { hrCoachBlock } from "@/lib/impact/copy-formats";

export function TeamPulseGrid({ now }: { now: number }) {
  const records = useVisitWar((s) => s.records);
  const rows = selectTeamPulse(records, now);

  if (rows.length === 0) {
    return <div className="text-sm py-16 text-center text-muted-foreground">No visit activity yet today.</div>;
  }

  const teamConv = (() => {
    const c = rows.reduce((s, r) => s + r.completed, 0);
    const b = rows.reduce((s, r) => s + r.booked, 0);
    return c > 0 ? Math.round((b / c) * 100) : 0;
  })();
  const teamLive = rows.reduce((s, r) => s + r.live, 0);
  const teamSla = rows.reduce((s, r) => s + r.slaBreaches, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <KPI icon={Activity} label="Team live" value={teamLive} tone="info" />
        <KPI icon={TrendingUp} label="Team conv" value={`${teamConv}%`} tone="success" />
        <KPI icon={AlertTriangle} label="SLA breaches" value={teamSla} tone="destructive" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/40 px-3 py-2 border-b">
          <div className="col-span-3">TCM</div>
          <div className="col-span-1 text-center">Live</div>
          <div className="col-span-1 text-center">Done</div>
          <div className="col-span-1 text-center">Book</div>
          <div className="col-span-2 text-center">Conv</div>
          <div className="col-span-1 text-center">SLA</div>
          <div className="col-span-3">Coach</div>
        </div>
        {rows.map((r) => <PulseRow key={r.tcmId} r={r} />)}
      </Card>
    </div>
  );
}

function PulseRow({ r }: { r: TeamPulseRow }) {
  const convTone = r.conv >= 50 ? "text-success" : r.conv >= 25 ? "text-warning-foreground" : "text-destructive";
  return (
    <div className="grid grid-cols-12 items-center px-3 py-2 border-b last:border-0 text-xs hover:bg-muted/30">
      <div className="col-span-3 min-w-0">
        <div className="font-semibold truncate">{r.tcmName}</div>
        {r.topObjection && <div className="text-[10px] text-warning-foreground truncate">top: {r.topObjection}</div>}
      </div>
      <div className="col-span-1 text-center font-mono tabular-nums">{r.live}</div>
      <div className="col-span-1 text-center font-mono tabular-nums">{r.completed}</div>
      <div className="col-span-1 text-center font-mono tabular-nums text-success font-bold">{r.booked}</div>
      <div className={cn("col-span-2 text-center font-mono tabular-nums font-bold", convTone)}>{r.conv}%</div>
      <div className="col-span-1 text-center">
        {r.slaBreaches > 0
          ? <Badge variant="destructive" className="h-4 px-1 text-[9px]">{r.slaBreaches}</Badge>
          : <span className="text-muted-foreground">—</span>}
      </div>
      <div className="col-span-3 flex justify-end gap-1">
        <CopyChip
          size="xs"
          label="Coach"
          text={hrCoachBlock({
            tcmName: r.tcmName,
            leadName: "(team)",
            propertyName: r.topObjection ?? "today's visits",
            issue: r.slaBreaches > 0 ? `${r.slaBreaches} SLA breach(es) today` : `Conv ${r.conv}%`,
            suggestion: r.topObjection
              ? `Address recurring objection: ${r.topObjection}`
              : "Pair with a high-converting peer for next 2 visits",
          })}
        />
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | number; tone: "info" | "success" | "destructive" }) {
  const cls = tone === "success" ? "text-success bg-success/10"
    : tone === "destructive" ? "text-destructive bg-destructive/10"
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
