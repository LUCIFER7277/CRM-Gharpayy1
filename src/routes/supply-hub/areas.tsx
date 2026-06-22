import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo } from "react";
import { AREAS } from "@/supply-hub/data/areas";
import { areaMood } from "@/supply-hub/lib/intel";
import { PGS } from "@/supply-hub/data/pgs";
import { ArrowLeft, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supply-hub/areas")({
  head: () => ({ meta: [{ title: "Area Mood Board - Supply Hub" }] }),
  component: AreasPage,
});

function AreasPage() {
  const { role } = useApp();
  const navigate = useNavigate();
  useEffect(() => { if (role === "owner") navigate({ to: "/property-owner/inventory" }); }, [role, navigate]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    PGS.forEach((p) => { c[p.area] = (c[p.area] ?? 0) + 1; });
    return c;
  }, []);

  if (role === "owner") return null;

  return (
    <AppShell>
      <div className="space-y-5">
        <Link to="/supply-hub" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
          <ArrowLeft className="h-4 w-4" /> Supply Hub
        </Link>
        <header>
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Area Mood Board</div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Where each Bangalore zone fits</h1>
          <p className="text-sm text-muted-foreground mt-1">Crowd, age band, nightlife, weekend feel - instant context for any lead's location question.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AREAS.map((a) => {
            const m = areaMood(a.area);
            const tone = m?.nightlife === "High" ? "border-fuchsia-400/30" : m?.nightlife === "Medium" ? "border-cyan-400/30" : "border-border";
            return (
              <div key={a.area} className={cn("rounded-lg border bg-card p-4", tone)}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent" /> {a.area}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{counts[a.area] ?? 0} PGs</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{a.budget} · Demand: {a.demand}</div>
                {m && (
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <Item k="Crowd" v={m.crowd} />
                    <Item k="Age" v={m.ageBand} />
                    <Item k="Nightlife" v={m.nightlife} />
                    <Item k="Noise" v={m.noise} />
                  </div>
                )}
                {m && <div className="mt-2 text-xs italic text-muted-foreground">{m.weekend}</div>}
                <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Top companies</div>
                <div className="mt-1 text-xs">{a.topCompanies}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  );
}
