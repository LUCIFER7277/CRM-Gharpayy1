import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { searchPGs } from "@/supply-hub/lib/search";
import { personaBadge, personaStyle, scarcity, perDayLabel, freshness } from "@/supply-hub/lib/intel";
import { PGS } from "@/supply-hub/data/pgs";
import { Search, MapPin, Sparkles, Flame, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supply-hub/")({
  head: () => ({
    meta: [
      { title: "Inventory Supply Hub - Gharpayy" },
      { name: "description", content: "200+ verified PGs with persona, scarcity, commute and value intelligence." },
    ],
  }),
  component: SupplyHubHome,
});

const TIERS = ["All", "Premium", "Mid", "Budget"] as const;
const GENDERS = ["All", "Boys", "Girls", "Co-live"] as const;

function SupplyHubHome() {
  const { role } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (role === "owner") navigate({ to: "/property-owner/inventory" });
  }, [role, navigate]);

  const [q, setQ] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("All");
  const [area, setArea] = useState("All");

  const areas = useMemo(() => ["All", ...Array.from(new Set(PGS.map((p) => p.area))).filter(Boolean).sort()], []);

  const results = useMemo(() => {
    let hits = q.trim() ? searchPGs(q, 60) : PGS.slice(0, 60).map((pg) => ({ pg, score: 1, matched: [] as string[] }));
    return hits.filter((h) => {
      if (tier !== "All" && h.pg.tier !== tier) return false;
      if (gender !== "All" && h.pg.gender !== gender) return false;
      if (area !== "All" && h.pg.area !== area) return false;
      return true;
    });
  }, [q, tier, gender, area]);

  const stats = useMemo(() => {
    const total = PGS.length;
    const premium = PGS.filter((p) => p.tier === "Premium").length;
    const hot = PGS.filter((p) => scarcity(p).hot).length;
    const fresh = PGS.filter((p) => freshness(p).isFresh).length;
    return { total, premium, hot, fresh };
  }, []);

  if (role === "owner") return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Internal · HR / Flow Ops / TCM</div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Inventory Supply Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">Verified PG network - search by name, area, landmark, or company. Every tile is computed live: persona, scarcity, freshness, value.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/supply-hub/match" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"><Sparkles className="h-4 w-4" /> Lead Matcher</Link>
            <Link to="/supply-hub/areas" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><MapPin className="h-4 w-4" /> Area Mood</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Properties", value: stats.total, sub: "Verified inventory" },
            { label: "Premium tier", value: stats.premium, sub: "₹22k+/mo cohort" },
            { label: "Hot scarcity", value: stats.hot, sub: "1–2 beds left", accent: true },
            { label: "Updated <30d", value: stats.fresh, sub: "Fresh re-engagement angle" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-lg border bg-card p-4", s.accent && "border-accent/40")}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 font-display text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by PG name, area, landmark, company (e.g. 'Manyata', 'Christ', 'koramangala girls')"
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <Pill label="Tier" value={tier} options={TIERS as readonly string[]} onChange={(v) => setTier(v as typeof tier)} />
          <Pill label="Gender" value={gender} options={GENDERS as readonly string[]} onChange={(v) => setGender(v as typeof gender)} />
          <Pill label="Area" value={area} options={areas} onChange={setArea} />
          <div className="text-xs text-muted-foreground ml-auto">{results.length} matches</div>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.slice(0, 60).map(({ pg, matched }) => {
            const sc = scarcity(pg);
            const persona = personaBadge(pg);
            const ps = personaStyle(persona);
            const fr = freshness(pg);
            const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
            return (
              <Link
                key={pg.id}
                to="/supply-hub/$id"
                params={{ id: pg.id }}
                className="group rounded-lg border border-border bg-card p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pg.area} · {pg.tier} · {pg.gender}</div>
                    <h3 className="mt-0.5 font-semibold truncate group-hover:text-accent">{pg.name}</h3>
                    <div className="text-xs text-muted-foreground truncate">{pg.locality}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold">{cheap < 99999 ? `₹${(cheap / 1000).toFixed(0)}k` : "-"}</div>
                    <div className="text-[10px] text-muted-foreground">{cheap < 99999 ? perDayLabel(cheap) : ""}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", ps.color)}>
                    <BadgeCheck className="h-3 w-3" /> {persona}
                  </span>
                  {sc.hot && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-400/10 text-rose-300 px-1.5 py-0.5 text-[10px] font-semibold">
                      <Flame className="h-3 w-3" /> {sc.level}
                    </span>
                  )}
                  {!sc.hot && sc.level !== "AVAILABLE" && (
                    <span className="rounded-md border border-amber-400/40 bg-amber-400/10 text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">{sc.level}</span>
                  )}
                  {fr.isFresh && fr.changeKind && (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">{fr.changeKind}</span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">IQ {pg.iq}</span>
                </div>
                {matched.length > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground truncate">Matched: {matched.slice(0, 2).join(" · ")}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Pill({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
