import { useMemo } from "react";
import { Link } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useSettings } from "@/myt/lib/settings-context";
import { useTourData } from "@/myt/lib/tour-data-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PropAgg {
  name: string;
  area: string;
  tours: number;
  bookings: number;
  conv: number;
  objections: Map<string, number>;
  topObjection?: string;
}

export default function InventoryFeedback() {
  const { tours } = useAppState();
  const { settings } = useSettings();
  const { reports, feedback } = useTourData();

  const aggregates = useMemo(() => {
    const m = new Map<string, PropAgg>();
    tours.forEach((t) => {
      const cur = m.get(t.propertyName) ?? {
        name: t.propertyName,
        area: t.area,
        tours: 0,
        bookings: 0,
        conv: 0,
        objections: new Map<string, number>(),
      };
      cur.tours += 1;
      const r = reports[t.id];
      const f = feedback[t.id];
      if (r?.outcome === "booked" || t.tokenPaid) cur.bookings += 1;
      if (r?.firstObjection) cur.objections.set(r.firstObjection, (cur.objections.get(r.firstObjection) ?? 0) + 1);
      if (f?.comment) {
        const c = f.comment.toLowerCase();
        ["expensive", "small", "location", "food", "noisy", "dirty"].forEach((kw) => {
          if (c.includes(kw)) cur.objections.set(kw, (cur.objections.get(kw) ?? 0) + 1);
        });
      }
      cur.conv = cur.tours ? cur.bookings / cur.tours : 0;
      m.set(t.propertyName, cur);
    });
    const arr = Array.from(m.values()).map((p) => {
      const top = Array.from(p.objections.entries()).sort((a, b) => b[1] - a[1])[0];
      return { ...p, topObjection: top ? `${top[0]} (${top[1]})` : undefined };
    });
    return arr;
  }, [tours, reports, feedback]);

  const dead = aggregates.filter((p) => p.tours >= 3 && p.conv === 0).sort((a, b) => b.tours - a.tours);
  const winners = aggregates.filter((p) => p.tours <= 5 && p.bookings >= 1).sort((a, b) => b.conv - a.conv);
  const ranked = [...aggregates].sort((a, b) => b.conv - a.conv);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold">Inventory Feedback Loop</h1>
        <p className="text-sm text-muted-foreground">Self-optimizing supply: which inventory closes vs wastes time, with the real reason.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">⚰️ Dead inventory (≥3 tours, 0 conversion)</CardTitle></CardHeader>
          <CardContent>
            {dead.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dead inventory yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {dead.map((p) => (
                  <li key={p.name} className="text-sm flex items-center justify-between border-b py-1.5 last:border-0">
                    <span>{p.name} <span className="text-muted-foreground">· {p.area}</span></span>
                    <span className="text-xs text-muted-foreground">{p.tours} tours · {p.topObjection ?? "no signal"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">💎 Hidden winners (low tours, high conv)</CardTitle></CardHeader>
          <CardContent>
            {winners.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hidden winners yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {winners.map((p) => (
                  <li key={p.name} className="text-sm flex items-center justify-between border-b py-1.5 last:border-0">
                    <span>{p.name} <span className="text-muted-foreground">· {p.area}</span></span>
                    <span className="text-xs">{p.bookings}/{p.tours} <span className="text-emerald-500">({Math.round(p.conv * 100)}%)</span></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All properties - conversion ranking</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Property</th>
                  <th className="text-left py-2">Area</th>
                  <th className="text-right py-2">Tours</th>
                  <th className="text-right py-2">Bookings</th>
                  <th className="text-right py-2">Conv %</th>
                  <th className="text-left py-2 pl-4">Top objection</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.name} className="border-b border-border/50">
                    <td className="py-1.5">{p.name}</td>
                    <td className="py-1.5 text-muted-foreground">{p.area}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.tours}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.bookings}</td>
                    <td className="py-1.5 text-right tabular-nums">{Math.round(p.conv * 100)}%</td>
                    <td className="py-1.5 pl-4 text-xs text-muted-foreground">{p.topObjection ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Edit objection tags & add custom properties in <Link to="/myt/settings" className="underline">Settings</Link>.
      </div>
    </div>
  );
}
