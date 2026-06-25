// Property Hub page — integrates the full property-genius catalog into the
// Impact Queue ecosystem. Browse, search, matcher + Closer module, with
// PGDetail dossier and shortlist tray.

import { useMemo, useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Brain, MapPin, Ruler, Zap, Sparkles, Footprints, Filter } from "lucide-react";

type Tab = "closer" | "hub" | "matcher" | "area" | "distance";

export function PropertyHubPage() {
  const [tab, setTab] = useState<Tab>("hub");
  const [active, setActive] = useState<PG | null>(null);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <main className="container py-4 sm:py-6 pb-24 space-y-6">
        <header className="relative flex items-center justify-between flex-wrap gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent pb-1">
              Property Hub
            </h1>
            <p className="text-sm text-muted-foreground flex items-center flex-wrap mt-1.5">
              {PGS.length} properties indexed. Connected to Impact Queue.
              <span className="relative flex h-2 w-2 mx-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-primary font-mono font-medium animate-pulse">live</span>
            </p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col space-y-4">
          <TabsList className="h-auto justify-start self-start bg-muted/60 p-1 rounded-full">
            <TabsTrigger value="closer" className="text-[13px] gap-2 rounded-full px-4 py-1.5 data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground transition-all"><Zap className="h-3.5 w-3.5 text-accent" />Closer</TabsTrigger>
            <TabsTrigger value="hub" className="text-[13px] gap-2 rounded-full px-4 py-1.5 data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground transition-all"><Building2 className="h-3.5 w-3.5" />Hub</TabsTrigger>
            <TabsTrigger value="matcher" className="text-[13px] gap-2 rounded-full px-4 py-1.5 data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground transition-all"><Brain className="h-3.5 w-3.5" />Matcher</TabsTrigger>
            <TabsTrigger value="area" className="text-[13px] gap-2 rounded-full px-4 py-1.5 data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground transition-all"><MapPin className="h-3.5 w-3.5" />Area Intel</TabsTrigger>
            <TabsTrigger value="distance" className="text-[13px] gap-2 rounded-full px-4 py-1.5 data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground transition-all"><Ruler className="h-3.5 w-3.5" />Distance</TabsTrigger>
          </TabsList>

          <TabsContent value="closer" className="mt-0 outline-none">
            <CloserModule onOpen={setActive} />
          </TabsContent>
          <TabsContent value="hub" className="mt-0 outline-none">
            <PropertyHub onOpen={setActive} />
          </TabsContent>
          <TabsContent value="matcher" className="mt-0 outline-none">
            <LeadMatcherTab onOpen={setActive} />
          </TabsContent>
          <TabsContent value="area" className="mt-0 outline-none">
            <AreaIntelTab />
          </TabsContent>
          <TabsContent value="distance" className="mt-0 outline-none">
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

  const [currentPage, setCurrentPage] = useState(1);

  const list = useMemo(() => {
    let arr: PG[] = submitted ? searchPGs(submitted, 400).map((h) => h.pg) : [...PGS];
    if (area !== "All") arr = arr.filter((p) => p.area === area);
    if (gender !== "All") arr = arr.filter((p) => p.gender === gender);
    arr.sort((a, b) => b.iq - a.iq);
    return arr;
  }, [submitted, area, gender]);

  useEffect(() => {
    setCurrentPage(1);
  }, [submitted, area, gender]);

  const PAGE_SIZE = 24;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pagedItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Clean Header-style Control Panel inside the tab */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
        <div className="flex-1 min-w-[280px] max-w-xl">
          <UniversalSearch
            onPickLandmark={(lm: Landmark) => { setPickedLandmark(lm); setSubmitted(lm.n); }}
            onPickPG={onOpen}
            placeholder="Search Tonic Kora, Manyata, Christ back gate, 560066…"
            variant="default"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SelectChip label="Area" value={area} options={["All", ...allAreas]} onChange={setArea} />
          <SelectChip label="Gender" value={gender} options={["All", "Boys", "Girls", "Co-live"]} onChange={setGender} />
          <div className="ml-2 text-xs text-muted-foreground font-mono">
            {list.length} results
          </div>
        </div>
      </div>
      {pickedLandmark && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Footprints className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">Filtered near <b className="font-semibold">{pickedLandmark.n}</b></span>
          </div>
          <button onClick={() => { setPickedLandmark(null); setSubmitted(""); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted/40 transition-colors shrink-0">Clear</button>
        </div>
      )}

      {/* Grid Results */}
      <section className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pagedItems.map((pg) => (
            <PGTile key={pg.id} pg={pg} onClick={() => onOpen(pg)} />
          ))}
          {pagedItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No PGs match your current filters.
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-t border-border">
            <div className="text-xs text-muted-foreground font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, list.length)} of {list.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SelectChip({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[130px] text-sm rounded-full bg-background border-input hover:border-accent/40 transition-colors gap-2 px-3 focus:ring-1 focus:ring-ring">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-muted-foreground">{label}:</span>
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-sm rounded-md">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-semibold">Lead parameters</h2>
        </header>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-muted/5 border-b border-border">
          <label className="space-y-1">
            <div className="text-muted-foreground">Area / landmark</div>
            <input value={lead.area} onChange={(e) => setLead({ ...lead, area: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5" />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Gender</div>
            <div className="flex bg-muted/50 p-1 rounded-full border border-border">
              {(["Any", "Boys", "Girls", "Co-live"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLead({ ...lead, gender: opt })}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                    lead.gender === opt ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <label className="space-y-1">
            <div className="text-muted-foreground">Budget min</div>
            <input type="number" value={lead.budgetMin} onChange={(e) => setLead({ ...lead, budgetMin: Number(e.target.value) })}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 tabular-nums" />
          </label>
          <label className="space-y-1">
            <div className="text-muted-foreground">Budget max</div>
            <input type="number" value={lead.budgetMax} onChange={(e) => setLead({ ...lead, budgetMax: Number(e.target.value) })}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 tabular-nums" />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Sharing</div>
            <div className="flex bg-muted/50 p-1 rounded-full border border-border">
              {(["Any", "Single", "Double", "Triple"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLead({ ...lead, occupancy: opt as MatchLead["occupancy"] })}
                  className={`flex-1 px-2 py-1.5 text-[12px] font-medium rounded-full transition-all ${
                    lead.occupancy === opt ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((r) => {
            const rt = rating(r.total);
            return (
              <button key={r.pg.id} onClick={() => onOpen(r.pg)}
                className="text-left rounded-xl border border-border bg-card hover:border-accent/40 hover:bg-muted/40 transition-colors p-3.5 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="font-semibold text-sm truncate flex-1">{r.pg.name}</div>
                  <Badge variant="outline" className={`text-[10px] font-mono border-border ${rt.color}`}>{r.total}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{r.pg.area}</span> · {r.pg.gender} · {r.bedLabel}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <div className={`text-[10px] font-medium ${rt.color}`}>{rt.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">— {rt.action}</div>
                </div>
                {r.commuteKm !== null && <div className="text-[10px] text-muted-foreground bg-surface-2 w-fit px-1.5 py-0.5 rounded-md border border-border">{r.commuteKm} km away</div>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Area Intel tab                                                    */
/* ------------------------------------------------------------------ */

function AreaIntelTab() {
  const [areaName, setAreaName] = useState(AREAS[0]?.area ?? "Whitefield");
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Select Area</span>
        <select value={areaName} onChange={(e) => setAreaName(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
          {AREAS.map((a) => <option key={a.area} value={a.area}>{a.area}</option>)}
        </select>
      </section>
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
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
          <span className="text-xs font-medium text-muted-foreground">Origin Node</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="ml-auto text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md border border-border">
            {list.length} known links
          </div>
        </header>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {list.map(([to, km]) => (
            <div key={to} className="rounded-xl border border-border bg-muted/10 p-3 flex flex-col gap-1">
              <div className="font-medium text-sm truncate">{to}</div>
              <div className="text-xs font-mono text-muted-foreground bg-surface-2 w-fit px-1.5 py-0.5 rounded-md border border-border">{km} km</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
