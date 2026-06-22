import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VisitRecord, VisitStage } from "@/lib/visits/war-store";

const STAGE_BG: Record<VisitStage, string> = {
  scheduled:     "bg-muted",
  started:       "bg-info/80",
  "at-property": "bg-success/80",
  "tour-ongoing":"bg-warning/80",
  completed:     "bg-info/60",
  objection:     "bg-warning/70",
  "follow-up":   "bg-accent/70",
  booked:        "bg-success",
  lost:          "bg-destructive/70",
};

export function DayPlannerStrip({
  visits, now, onFocus, focusTourId,
}: {
  visits: VisitRecord[];
  now: number;
  onFocus: (tourId: string) => void;
  focusTourId?: string | null;
}) {
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return +d;
  }, []);
  const dayEnd = today + 24 * 3600_000;
  const todayVisits = visits.filter((v) => v.scheduledAt >= today && v.scheduledAt < dayEnd);

  if (todayVisits.length === 0) {
    return (
      <Card className="px-3 py-2 text-[11px] text-muted-foreground">
        No visits scheduled today.
      </Card>
    );
  }

  const lanes = new Map<string, { tcmName: string; visits: VisitRecord[] }>();
  todayVisits.forEach((v) => {
    if (!lanes.has(v.tcmId)) lanes.set(v.tcmId, { tcmName: v.tcmName, visits: [] });
    lanes.get(v.tcmId)!.visits.push(v);
  });

  const times = todayVisits.map((v) => (v.scheduledAt - today) / 3600_000);
  const minH = Math.max(6, Math.floor(Math.min(...times) - 1));
  const maxH = Math.min(23, Math.ceil(Math.max(...times) + 2));
  const span = Math.max(1, maxH - minH);

  const nowFrac = ((now - today) / 3600_000 - minH) / span;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent">
          Day Planner · {new Date(today).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {minH}:00 → {maxH}:00 · {todayVisits.length} visits
        </div>
      </div>

      <div className="relative h-4 mb-1 border-b border-border/60">
        {Array.from({ length: span + 1 }).map((_, i) => {
          const left = (i / span) * 100;
          return (
            <div key={i} className="absolute top-0 -translate-x-1/2 text-[9px] text-muted-foreground font-mono"
                 style={{ left: `${left}%` }}>
              {String(minH + i).padStart(2, "0")}
            </div>
          );
        })}
      </div>

      <div className="relative">
        {nowFrac >= 0 && nowFrac <= 1 && (
          <div className="absolute top-0 bottom-0 w-px bg-destructive z-10 pointer-events-none"
               style={{ left: `${nowFrac * 100}%` }}>
            <div className="absolute -top-1 -left-[3px] h-1.5 w-1.5 rounded-full bg-destructive" />
          </div>
        )}

        <div className="space-y-1">
          {Array.from(lanes.entries()).map(([tcmId, lane]) => (
            <div key={tcmId} className="relative h-7 rounded bg-muted/30">
              <div className="absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-muted-foreground truncate z-[5] pointer-events-none">
                {lane.tcmName.split(" ")[0]}
              </div>
              {lane.visits.map((v) => {
                const startH = (v.scheduledAt - today) / 3600_000;
                const left = ((startH - minH) / span) * 100;
                const width = (1 / span) * 100;
                const focused = focusTourId === v.tourId;
                return (
                  <button
                    key={v.tourId}
                    onClick={() => onFocus(v.tourId)}
                    className={cn(
                      "absolute top-0.5 bottom-0.5 rounded text-[9px] font-semibold text-white px-1 truncate transition",
                      STAGE_BG[v.stage],
                      focused && "ring-2 ring-accent",
                      v.escalated && "ring-2 ring-destructive animate-pulse",
                    )}
                    style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(2, width)}%` }}
                    title={`${v.leadName} · ${v.propertyName} · ${new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                  >
                    {v.propertyName.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-[9px] text-muted-foreground">
        <Badge variant="outline" className="bg-info/15 text-info border-info/40 text-[9px]">Started</Badge>
        <Badge variant="outline" className="bg-success/15 text-success border-success/40 text-[9px]">At property</Badge>
        <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/40 text-[9px]">Tour ongoing</Badge>
        <Badge variant="outline" className="bg-muted text-[9px]">Scheduled</Badge>
        <span className="ml-auto">Red line = now</span>
      </div>
    </Card>
  );
}
