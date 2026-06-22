// Property Hub page — integrates the full property-genius catalog into the
// Impact Queue ecosystem. Browse, search, matcher + Closer module, with
// PGDetail dossier and shortlist tray.

import { useMemo, useState } from "react";
import type { PG, Landmark, Gender } from "@/property-genius/data/types";
import { PGS } from "@/property-genius/data/pgs";
import { AREAS, DISTANCE } from "@/property-genius/data/areas";
import { searchPGs } from "@/property-genius/lib/search";
import { matchLead, rating, type Lead as MatchLead } from "@/property-genius/lib/matcher";
import { UniversalSearch } from "@/property-genius/components/UniversalSearch";
import { PGTile } from "@/property-genius/components/PGTile";
import { PGDetail } from "@/property-genius/components/PGDetail";
import { ShortlistTray } from "@/property-genius/components/ShortlistTray";
import { CloserModule } from "@/property-genius/components/CloserModule";
import { AreaMoodCard, DualMatcher } from "@/property-genius/components/AreaPlus";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Brain, MapPin, Ruler, Zap, Sparkles, Footprints, Filter } from "lucide-react";

type Tab = "closer" | "hub" | "matcher" | "area" | "distance";

export function PropertyHubPage() {
  const [tab, setTab] = useState<Tab>("hub");
  const [active, setActive] = useState<PG | null>(null);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="font-display text-sm font-semibold">Property Hub</div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {PGS.length} PGs
          </Badge>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
          Connected to Impact Queue
        </div>
      </header>

      <main className="container py-4 sm:py-6 pb-24">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="h-9">
            <TabsTrigger value="closer" className="text-xs gap-1.5"><Zap className="h-3.5 w-3.5" />Closer</TabsTrigger>
            <TabsTrigger value="hub" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" />Hub</TabsTrigger>
            <TabsTrigger value="matcher" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" />Matcher</TabsTrigger>
            <TabsTrigger value="area" className="text-xs gap-1.5"><MapPin className="h-3.5 w-3.5" />Area Intel</TabsTrigger>
            <TabsTrigger value="distance" className="text-xs gap-1.5"><Ruler className="h-3.5 w-3.5" />Distance</TabsTrigger>
          </TabsList>

          <TabsContent value="closer" className="mt-4">
            <CloserModule onOpen={setActive} />
          </TabsContent>
          <TabsContent value="hub" className="mt-4">
            <PropertyHub onOpen={setActive} />
          </TabsContent>
          <TabsContent value="matcher" className="mt-4">
            <LeadMatcherTab onOpen={setActive} />
          </TabsContent>
          <TabsContent value="area" className="mt-4">
            <AreaIntelTab />
          </TabsContent>
          <TabsContent value="distance" className="mt-4">
            <DistanceFinderTab />
          </TabsContent>
        </Tabs>
      </main>

      <ShortlistTray onOpenPG={setActive} />
      <PGDetail pg={active} onClose={() => setActive(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Property Hub — search + filter grid                                */
/* ------------------------------------------------------------------ */

function PropertyHub({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [submitted, setSubmitted] = useState("");
  const [area, setArea] = useState("All");
  const [gender, setGender] = useState("All");
  const [pickedLandmark, setPickedLandmark] = useState<Landmark | null>(null);
  const allAreas = useMemo(() => Array.from(new Set(PGS.map((p) => p.area))).sort(), []);

  const list = useMemo(() => {
    let arr: PG[] = submitted ? searchPGs(submitted, 400).map((h) => h.pg) : [...PGS];
    if (area !== "All") arr = arr.filter((p) => p.area === area);
    if (gender !== "All") arr = arr.filter((p) => p.gender === gender);
    arr.sort((a, b) => b.iq - a.iq);
    return arr.slice(0, 60);
  }, [submitted, area, gender]);

  return (
    <div className="space-y-4">
      <UniversalSearch
        onPickLandmark={(lm: Landmark) => { setPickedLandmark(lm); setSubmitted(lm.n); }}
        onPickPG={onOpen}
        placeholder="Search Tonic Kora, Manyata, Christ back gate, Goldman Sachs, 560066…"
      />

      {pickedLandmark && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Footprints className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Filtered near <b>{pickedLandmark.n}</b></span>
          </div>
          <button onClick={() => { setPickedLandmark(null); setSubmitted(""); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:border-primary/40 shrink-0">Clear</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 p-3">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectChip label="Area" value={area} options={["All", ...allAreas]} onChange={setArea} />
        <SelectChip label="Gender" value={gender} options={["All", "Boys", "Girls", "Co-live"]} onChange={setGender} />
        <div className="ml-auto text-[10px] text-muted-foreground">{list.length} results</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((pg) => (
          <PGTile key={pg.id} pg={pg} onClick={() => onOpen(pg)} />
        ))}
      </div>
      {list.length === 0 && (
        <div className="rounded-md border bg-muted/30 p-8 text-center text-xs text-muted-foreground">
          No PGs match those filters.
        </div>
      )}
    </div>
  );
}

function SelectChip({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Lead Matcher tab                                                  */
/* ------------------------------------------------------------------ */

function LeadMatcherTab({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [lead, setLead] = useState<MatchLead>({
    area: "Whitefield",
    gender: "Any",
    budgetMin: 10000,
    budgetMax: 18000,
    audience: "Working",
    occupancy: "Any",
  });

  const results = useMemo(() => matchLead(lead).slice(0, 12), [lead]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <label className="space-y-1">
          <div className="text-muted-foreground">Area / landmark</div>
          <input value={lead.area} onChange={(e) => setLead({ ...lead, area: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Gender</div>
          <select value={lead.gender} onChange={(e) => setLead({ ...lead, gender: e.target.value as Gender | "Any" })}
            className="w-full rounded-md border bg-background px-2 py-1.5">
            <option>Any</option><option>Boys</option><option>Girls</option><option>Co-live</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Budget min</div>
          <input type="number" value={lead.budgetMin} onChange={(e) => setLead({ ...lead, budgetMin: Number(e.target.value) })}
            className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Budget max</div>
          <input type="number" value={lead.budgetMax} onChange={(e) => setLead({ ...lead, budgetMax: Number(e.target.value) })}
            className="w-full rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Sharing</div>
          <select value={lead.occupancy} onChange={(e) => setLead({ ...lead, occupancy: e.target.value as MatchLead["occupancy"] })}
            className="w-full rounded-md border bg-background px-2 py-1.5">
            <option>Any</option><option>Single</option><option>Double</option><option>Triple</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((r) => {
          const rt = rating(r.total);
          return (
            <button key={r.pg.id} onClick={() => onOpen(r.pg)}
              className="text-left rounded-lg border bg-card hover:border-accent/60 transition p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-sm truncate flex-1">{r.pg.name}</div>
                <Badge variant="outline" className={`text-[9px] font-mono ${rt.color}`}>{r.total}</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">{r.pg.area} · {r.pg.gender} · {r.bedLabel}</div>
              <div className="text-[10px]">{rt.label} — {rt.action}</div>
              {r.commuteKm !== null && <div className="text-[10px] text-muted-foreground">{r.commuteKm} km away</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Area Intel tab                                                    */
/* ------------------------------------------------------------------ */

function AreaIntelTab() {
  const [areaName, setAreaName] = useState(AREAS[0]?.area ?? "Whitefield");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Area</span>
        <select value={areaName} onChange={(e) => setAreaName(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-xs">
          {AREAS.map((a) => <option key={a.area} value={a.area}>{a.area}</option>)}
        </select>
      </div>
      <AreaMoodCard area={areaName} />
      <DualMatcher onOpen={() => { /* noop in tab */ }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Distance Finder tab                                               */
/* ------------------------------------------------------------------ */

function DistanceFinderTab() {
  const areas = useMemo(() => Object.keys(DISTANCE).sort(), []);
  const [from, setFrom] = useState(areas[0] ?? "");
  const row = DISTANCE[from] ?? {};
  const list = Object.entries(row).sort((a, b) => a[1] - b[1]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">From</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-xs">
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Sparkles className="h-3.5 w-3.5 text-accent ml-2" />
        <span className="text-[10px] text-muted-foreground">{list.length} known links</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {list.map(([to, km]) => (
          <div key={to} className="rounded-md border bg-card p-2.5 text-xs">
            <div className="font-medium truncate">{to}</div>
            <div className="text-muted-foreground">{km} km</div>
          </div>
        ))}
      </div>
    </div>
  );
}
