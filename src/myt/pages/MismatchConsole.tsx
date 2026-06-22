import { useMemo } from "react";
import { Link } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useTourData } from "@/myt/lib/tour-data-context";
import { detectMismatches } from "@/myt/lib/intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink } from "lucide-react";

export default function MismatchConsole() {
  const { tours } = useAppState();
  const { feedback, reports } = useTourData();

  const flagged = useMemo(() => {
    const out: { tour: (typeof tours)[number]; reasons: string[]; sev: "low" | "med" | "high" }[] = [];
    tours.forEach((t) => {
      const ms = detectMismatches(t, feedback[t.id], reports[t.id]);
      if (ms.length) {
        const sev = ms.some((m) => m.severity === "high") ? "high" : ms.some((m) => m.severity === "med") ? "med" : "low";
        out.push({ tour: t, reasons: ms.map((m) => m.reason), sev });
      }
    });
    return out;
  }, [tours, feedback, reports]);

  // TCM-level inconsistency score
  const tcmStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; flagged: number }>();
    tours.forEach((t) => {
      const cur = map.get(t.assignedTo) ?? { name: t.assignedToName, total: 0, flagged: 0 };
      const ms = detectMismatches(t, feedback[t.id], reports[t.id]);
      cur.total += 1;
      if (ms.length) cur.flagged += 1;
      map.set(t.assignedTo, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, pct: v.total ? Math.round((v.flagged / v.total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [tours, feedback, reports]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold">Mismatch Detection Engine</h1>
        <p className="text-sm text-muted-foreground">
          Cross-checks customer feedback ↔ TCM report ↔ system actions to expose reality gaps.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Flagged tours</div><div className="text-2xl font-bold">{flagged.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">High severity</div><div className="text-2xl font-bold text-destructive">{flagged.filter((f) => f.sev === "high").length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">TCMs with gaps</div><div className="text-2xl font-bold">{tcmStats.filter((t) => t.flagged > 0).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">TCM inconsistency ranking</CardTitle></CardHeader>
        <CardContent>
          {tcmStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {tcmStats.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate">{t.name}</div>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                    <div className={`h-full ${t.pct > 30 ? "bg-destructive" : t.pct > 10 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${t.pct}%` }} />
                  </div>
                  <div className="text-xs tabular-nums w-24 text-right">{t.flagged}/{t.total} ({t.pct}%)</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Flagged tours</CardTitle></CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mismatches detected - TCM reports and customer feedback are aligned.</p>
          ) : (
            <div className="space-y-2">
              {flagged.map(({ tour, reasons, sev }) => (
                <Link key={tour.id} to={`/myt/tour/${tour.id}`} className="block border rounded p-2 hover:border-primary transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-sm font-medium">{tour.leadName} · {tour.propertyName}</div>
                      <div className="text-xs text-muted-foreground">{tour.assignedToName} · {tour.area}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sev === "high" ? "destructive" : "secondary"} className="capitalize">{sev}</Badge>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                  <ul className="mt-1 text-xs text-destructive">
                    {reasons.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
