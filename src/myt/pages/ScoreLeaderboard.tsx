import { useMemo } from "react";
import { Link } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useSettings } from "@/myt/lib/settings-context";
import { useTourData } from "@/myt/lib/tour-data-context";
import { computeTourScore } from "@/myt/lib/intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ScoreLeaderboard() {
  const { tours } = useAppState();
  const { settings } = useSettings();
  const { events, feedback, reports } = useTourData();

  const scored = useMemo(() => {
    return tours.map((t) => {
      const tourEvents = events.filter((e) => e.tourId === t.id);
      const s = computeTourScore(t, tourEvents, settings.weights, feedback[t.id], reports[t.id]);
      return { tour: t, score: s.total };
    });
  }, [tours, events, feedback, reports, settings.weights]);

  function group<K extends string>(keyFn: (r: (typeof scored)[number]) => { id: K; name: string }) {
    const m = new Map<K, { name: string; count: number; sum: number }>();
    scored.forEach((r) => {
      const { id, name } = keyFn(r);
      const cur = m.get(id) ?? { name, count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += r.score;
      m.set(id, cur);
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v, avg: v.count ? Math.round(v.sum / v.count) : 0 }))
      .sort((a, b) => b.avg - a.avg);
  }

  const tcmRanks = group((r) => ({ id: r.tour.assignedTo, name: r.tour.assignedToName }));
  const propRanks = group((r) => ({ id: r.tour.propertyName, name: r.tour.propertyName }));
  const areaRanks = group((r) => ({ id: r.tour.area, name: r.tour.area }));

  function Bars({ rows }: { rows: { id: string; name: string; avg: number; count: number }[] }) {
    const max = Math.max(1, ...rows.map((r) => r.avg));
    return (
      <div className="space-y-1.5">
        {rows.slice(0, 12).map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="w-36 text-sm truncate">{r.name}</div>
            <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.avg / max) * 100}%` }} />
            </div>
            <div className="text-xs tabular-nums w-20 text-right">{r.avg} <span className="text-muted-foreground">({r.count})</span></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold">Tour Score Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Weighted score (configurable in <Link className="underline" to="/myt/settings">Settings</Link>) ranks who actually converts vs who just tours.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardHeader><CardTitle className="text-base">TCM ranking</CardTitle></CardHeader><CardContent><Bars rows={tcmRanks} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Property ranking</CardTitle></CardHeader><CardContent><Bars rows={propRanks} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Area ranking</CardTitle></CardHeader><CardContent><Bars rows={areaRanks} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top scoring tours</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {[...scored].sort((a, b) => b.score - a.score).slice(0, 20).map(({ tour, score }) => (
              <Link key={tour.id} to={`/myt/tour/${tour.id}`} className="flex items-center justify-between py-2 hover:text-primary">
                <div className="text-sm">{tour.leadName} · {tour.propertyName} · <span className="text-muted-foreground">{tour.assignedToName}</span></div>
                <div className="font-bold tabular-nums">{score}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
