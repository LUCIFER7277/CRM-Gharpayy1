// THE CLOSER — single command-center module that powers 8 of the 15 features
// at once. Built for one job: a rep takes a 60-second call and walks away
// with a property locked.
//
// Tabs:
//   ① Instant Match     — office + budget → 1 best PG + WhatsApp ready (#1)
//   ② Send 3 Options    — area + gender + budget → 3 forwardable picks (#2, #10)
//   ③ Objection Pivot   — pick a PG + objection → 3 alternatives + stretch (#3, #4)
//   ④ Re-Engage         — pick a stale lead's PG → 3 stage-aware messages (#14)
//
// All output is pre-formatted for WhatsApp + has copy / send buttons.

import { useEffect, useMemo, useState } from "react";
import type { PG, Gender } from "@/property-genius/data/types";
import { PGS } from "@/property-genius/data/pgs";
import { LANDMARKS } from "@/property-genius/data/landmarks";
import { AREA_CENTROID } from "@/property-genius/data/areas";
import {
  Zap, Send, Shield, MessageCircle, Clock, MapPin, Brain, Search,
  TrendingUp, Phone, Sparkles, Flame, ArrowRight, IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scarcity, freshness, perDay, valueScore, commuteEstimate,
  findAlternatives, budgetStretch, type Objection, seasonalNudge,
} from "@/property-genius/lib/intel";
import {
  buildInstantMatch, buildThreeOptions, buildReengagement,
} from "@/property-genius/lib/messages";
import { waLink, telLink } from "@/property-genius/lib/wa";
import { CopyButton } from "./CopyButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tab = "instant" | "send3" | "objection" | "reengage";

function hav(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180, dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function resolveOffice(name: string): { lat: number; lng: number; label: string } | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  const lm = LANDMARKS.find((l) => l.lat && l.lng && l.n.toLowerCase().includes(n));
  if (lm?.lat && lm?.lng) return { lat: lm.lat, lng: lm.lng, label: lm.n };
  for (const [k, v] of Object.entries(AREA_CENTROID)) {
    if (k.toLowerCase().includes(n) || n.includes(k.toLowerCase())) return { ...v, label: k };
  }
  return null;
}

export function CloserModule({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [tab, setTab] = useState<Tab>("instant");

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 shadow-sm overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary"><Zap className="h-4 w-4" /></span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent pb-1">The Closer</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            One screen. Four moves. Built for the 60-second call. {seasonalNudge()}
          </p>
        </div>
      </header>

      <div className="flex overflow-x-auto rounded-full bg-muted/60 p-1 scrollbar-none self-start w-fit">
        {([
          { k: "instant",   l: "Instant Match", I: Zap },
          { k: "send3",     l: "Send 3",        I: Send },
          { k: "objection", l: "Objection Pivot", I: Shield },
          { k: "reengage",  l: "Re-Engage",     I: MessageCircle },
        ] as const).map(({ k, l, I }) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all",
              tab === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <I className={cn("h-3.5 w-3.5", tab === k ? "text-primary" : "")} /> {l}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-up">
        {tab === "instant"   && <InstantMatch onOpen={onOpen} />}
        {tab === "send3"     && <SendThree onOpen={onOpen} />}
        {tab === "objection" && <ObjectionPivot onOpen={onOpen} />}
        {tab === "reengage"  && <ReEngage onOpen={onOpen} />}
      </div>
    </div>
  );
}

/* ============== ① INSTANT MATCH (#1) ============== */
function InstantMatch({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [office, setOffice] = useState("Goldman Sachs");
  const [budget, setBudget] = useState(18000);
  const [gender, setGender] = useState<Gender | "Any">("Any");
  const [leadName, setLeadName] = useState("");

  const office_ = useMemo(() => resolveOffice(office), [office]);

  const pick = useMemo(() => {
    const candidates = PGS
      .filter((p) => gender === "Any" || p.gender === gender || p.gender === "Co-live")
      .map((pg) => {
        const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0);
        const cheap = beds.length ? Math.min(...beds) : 99999;
        // disqualify >15% over budget
        if (cheap > budget * 1.15) return null;
        const km = office_ && pg.lat && pg.lng ? hav(office_.lat, office_.lng, pg.lat, pg.lng) : null;
        if (km !== null && km > 15) return null;
        // Score: budget fit + proximity + IQ
        const budgetFit = cheap <= budget ? 40 : 25;
        const distScore = km === null ? 15 : km <= 3 ? 35 : km <= 6 ? 25 : km <= 10 ? 15 : 5;
        const iqScore = (pg.iq / 100) * 25;
        return { pg, score: budgetFit + distScore + iqScore, km, cheap };
      })
      .filter((x): x is { pg: PG; score: number; km: number | null; cheap: number } => !!x)
      .sort((a, b) => b.score - a.score);
    return candidates[0] ?? null;
  }, [office, budget, gender, office_]);

  const card = useMemo(() => pick ? buildInstantMatch(pick.pg, {
    leadName: leadName || undefined,
    office: office_?.label || office,
    budget,
    commute: pick.km !== null ? { km: pick.km, mins: Math.round(pick.km * 2.8) } : null,
  }) : "", [pick, leadName, office, office_, budget]);

  const wa = pick ? waLink(pick.pg.manager.phone, card) : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Inputs */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-24 lg:h-fit">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> 30-second sell
        </h3>
        <p className="text-xs text-muted-foreground">Two questions. One answer. One copy button.</p>

        <Field label="Lead's name (optional)">
          <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="e.g. Kruthika"
            className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/60" />
        </Field>

        <Field label="Where do they work / study?">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={office} onChange={(e) => setOffice(e.target.value)} placeholder="Goldman Sachs, Manyata, Christ…"
              className="w-full rounded-md border border-input bg-surface-1 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60" />
          </div>
          {office_ && <div className="mt-1 text-[10px] text-emerald-400">✓ Found: {office_.label}</div>}
          {office.length > 2 && !office_ && <div className="mt-1 text-[10px] text-amber-400">Will use as area name</div>}
        </Field>

        <Field label={`Budget: ₹${budget.toLocaleString("en-IN")} / mo (₹${perDay(budget)}/day)`}>
          <input type="range" min={9000} max={35000} step={500} value={budget}
            onChange={(e) => setBudget(+e.target.value)}
            className="w-full accent-primary" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>9k</span><span>22k</span><span>35k</span>
          </div>
        </Field>

        <Field label="Gender">
          <div className="flex gap-1 rounded-full bg-muted/60 p-1">
            {(["Any", "Boys", "Girls", "Co-live"] as const).map((g) => (
              <button key={g} onClick={() => setGender(g)}
                className={cn("flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium transition-all",
                  gender === g ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {g}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Result */}
      <div>
        {pick ? (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-glow animate-fade-up">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
                <Zap className="h-3.5 w-3.5" /> The one to send · score {Math.round(pick.score)}
              </div>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl font-bold leading-tight">{pick.pg.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {pick.pg.area}
                <span>·</span> <span>{pick.pg.gender}</span>
                <span>·</span> <span>IQ {pick.pg.iq}/100</span>
                {pick.km !== null && (
                  <>
                    <span>·</span>
                    <span className={cn("font-mono", pick.km <= 3 ? "text-emerald-400" : pick.km <= 8 ? "text-amber-400" : "text-orange-400")}>
                      {pick.km}km from {office_?.label || office}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Best fit" value={`₹${(pick.cheap / 1000).toFixed(0)}k/mo`} accent />
                <Stat label="Per day" value={`₹${perDay(pick.cheap)}`} />
                <Stat label="Commute" value={pick.km !== null ? `${Math.round(pick.km * 2.8)} min` : "—"} />
                <Stat label="Inventory" value={scarcity(pick.pg).level} hot={scarcity(pick.pg).hot} />
              </div>

              {pick.pg.usp && (
                <div className="mt-4 rounded-md bg-surface-2 p-3 text-sm leading-relaxed">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Pitch line</span>
                  <p className="mt-1">{pick.pg.usp}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => onOpen(pick.pg)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-all">
                  <Sparkles className="h-3.5 w-3.5" /> Open Playbook
                </button>
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-500 dark:text-emerald-300 shadow-sm hover:bg-emerald-400/20 transition-all">
                  <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
                </a>
                {telLink(pick.pg.manager.phone) && (
                  <a href={telLink(pick.pg.manager.phone)!} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-muted shadow-sm transition-all">
                    <Phone className="h-3.5 w-3.5" /> Call manager
                  </a>
                )}
                <CopyButton text={card} label="Copy message" />
              </div>
            </div>

            <details className="rounded-lg border border-border bg-card p-3 group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none flex items-center justify-between">
                <span>Preview the WhatsApp message</span>
                <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              </summary>
              <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-xs leading-relaxed">{card}</pre>
            </details>
          </div>
        ) : (
          <EmptyState message="No PG fits those filters. Widen budget by 15% or pick a different area." />
        )}
      </div>
    </div>
  );
}

/* ============== ② SEND 3 (#2 + #10) ============== */
function SendThree({ onOpen }: { onOpen: (pg: PG) => void }) {
  const allAreas = useMemo(() => Array.from(new Set(PGS.map((p) => p.area))).sort(), []);
  const [area, setArea] = useState(allAreas[0] || "Koramangala");
  const [gender, setGender] = useState<Gender | "Any">("Any");
  const [budgetMin, setBudgetMin] = useState(12000);
  const [budgetMax, setBudgetMax] = useState(20000);
  const [leadName, setLeadName] = useState("");

  const picks = useMemo(() => {
    return PGS
      .filter((p) => p.area === area)
      .filter((p) => gender === "Any" || p.gender === gender || p.gender === "Co-live")
      .map((p) => {
        const beds = [p.prices.triple, p.prices.double, p.prices.single].filter((x) => x > 0);
        const cheap = beds.length ? Math.min(...beds) : 99999;
        const fits = cheap >= budgetMin * 0.85 && cheap <= budgetMax * 1.15;
        if (!fits) return null;
        const value = valueScore(p);
        return { pg: p, cheap, value };
      })
      .filter((x): x is { pg: PG; cheap: number; value: number } => !!x)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [area, gender, budgetMin, budgetMax]);

  const message = useMemo(() => buildThreeOptions(picks.map((p) => p.pg), {
    leadName: leadName || undefined,
    landmark: area,
    gender: gender !== "Any" ? gender : undefined,
  }), [picks, leadName, area, gender]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Lead name">
          <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Optional"
            className="w-full rounded-xl border border-input bg-surface-1 px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors" />
        </Field>
        <Field label="Area">
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-full rounded-xl border border-input bg-surface-1 px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
              <SelectValue placeholder="Select Area" />
            </SelectTrigger>
            <SelectContent>
              {allAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Gender">
          <Select value={gender} onValueChange={(v) => setGender(v as Gender | "Any")}>
            <SelectTrigger className="w-full rounded-xl border border-input bg-surface-1 px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
              <SelectValue placeholder="Select Gender" />
            </SelectTrigger>
            <SelectContent>
              {["Any", "Boys", "Girls", "Co-live"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Budget ₹${(budgetMin/1000).toFixed(0)}k–${(budgetMax/1000).toFixed(0)}k`}>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={budgetMin} onChange={(e) => setBudgetMin(+e.target.value || 0)}
              className="w-full rounded-xl border border-input bg-surface-1 px-3 py-2.5 text-sm outline-none font-mono focus:border-primary/50 transition-colors" />
            <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(+e.target.value || 0)}
              className="w-full rounded-xl border border-input bg-surface-1 px-3 py-2.5 text-sm outline-none font-mono focus:border-primary/50 transition-colors" />
          </div>
        </Field>
      </div>

      {picks.length === 0 ? (
        <EmptyState message="No 3 options match. Widen budget or pick a different area." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {picks.map((p, i) => (
              <button key={p.pg.id} onClick={() => onOpen(p.pg)}
                className="block w-full rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40 group">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 font-mono text-sm font-bold text-primary group-hover:bg-primary/20 transition-colors">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] font-semibold truncate group-hover:text-primary transition-colors">{p.pg.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {p.pg.area} · ₹{(p.cheap / 1000).toFixed(0)}k (₹{perDay(p.cheap)}/day)
                      {p.pg.nearbyLandmarks?.[0] && ` · ${p.pg.nearbyLandmarks[0].w <= 0 ? "<1m" : p.pg.nearbyLandmarks[0].w + "m"} to ${p.pg.nearbyLandmarks[0].n}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-base font-bold tabular-nums text-emerald-400">{p.value}</div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">Value</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-fit">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Forwardable message
              </h4>
              <CopyButton text={message} label="Copy" className="rounded-full shadow-sm" size="md" />
            </div>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/40 bg-surface-2/50 p-4 text-[11.5px] leading-relaxed">{message}</pre>
            <a href={waLink(undefined, message)} target="_blank" rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 px-4 py-2.5 text-xs font-semibold text-emerald-500 dark:text-emerald-300 shadow-sm hover:bg-emerald-500/25 transition-all">
              <MessageCircle className="h-4 w-4" /> Send via WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== ③ OBJECTION PIVOT (#3 + #4) ============== */
function ObjectionPivot({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [pgId, setPgId] = useState(PGS[0]?.id || "");
  const [objection, setObjection] = useState<Objection>("expensive");
  const pg = PGS.find((p) => p.id === pgId);

  const alternatives = useMemo(() => pg ? findAlternatives(pg, objection, PGS) : [], [pg, objection]);
  const baseBudget = useMemo(() => {
    if (!pg) return 15000;
    const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0);
    return beds.length ? Math.min(...beds) : 15000;
  }, [pg]);
  const stretch = useMemo(() => budgetStretch(baseBudget, PGS, pg?.gender), [baseBudget, pg]);

  const objections: { k: Objection; l: string; emoji: string }[] = [
    { k: "expensive", l: "Too expensive", emoji: "💰" },
    { k: "far",       l: "Too far",      emoji: "📍" },
    { k: "no_gym",    l: "Need gym",     emoji: "💪" },
    { k: "no_meals",  l: "Need meals",   emoji: "🍽" },
    { k: "no_ac",     l: "Need AC",      emoji: "❄️" },
    { k: "wrong_food",l: "Need non-veg", emoji: "🍗" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <Field label="Property the lead is hesitating on">
          <Select value={pgId} onValueChange={setPgId}>
            <SelectTrigger className="w-full rounded-xl border border-input bg-surface-1 px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent>
              {PGS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.area}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Lead's objection</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-6 rounded-2xl bg-muted/60 p-1.5">
            {objections.map((o) => (
              <button key={o.k} onClick={() => setObjection(o.k)}
                className={cn("rounded-xl px-2 py-2 text-xs font-medium transition-all",
                  objection === o.k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <span className="mr-1">{o.emoji}</span>{o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alternatives */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> 3 alternatives that kill this objection
        </h3>
        {alternatives.length === 0 ? (
          <EmptyState message="No alternatives in the same area for that objection. Try a different area or relax filters." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {alternatives.map((alt) => {
              const cheap = Math.min(...[alt.prices.triple, alt.prices.double, alt.prices.single].filter((x) => x > 0).concat(99999));
              return (
                <button key={alt.id} onClick={() => onOpen(alt)}
                  className="rounded-md border border-border bg-surface-1 p-3 text-left transition-smooth hover:border-primary/40">
                  <div className="font-semibold text-sm truncate">{alt.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{alt.area} · IQ {alt.iq}</div>
                  <div className="mt-2 font-mono text-sm tabular-nums text-emerald-400">
                    {cheap < 99999 ? `₹${(cheap / 1000).toFixed(0)}k · ₹${perDay(cheap)}/day` : "On call"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Budget stretch — only relevant when objection = expensive */}
      {objection === "expensive" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Budget stretch — what they unlock
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {stretch.map((s, i) => (
              <div key={s.budget} className={cn("rounded-md border p-3",
                i === 0 ? "border-border bg-surface-1" : i === 1 ? "border-amber-400/40 bg-amber-400/5" : "border-emerald-400/40 bg-emerald-400/5"
              )}>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-base font-bold tabular-nums">₹{(s.budget / 1000).toFixed(0)}k</div>
                  {i > 0 && <div className="text-[10px] text-muted-foreground font-mono">+₹{s.perDayDelta}/day</div>}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Unlocks</div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {s.unlocks.slice(0, 4).map((u) => <li key={u} className="flex gap-1.5"><span className="text-emerald-400">✓</span>{u}</li>)}
                </ul>
                <div className="mt-2 text-[10px] text-muted-foreground">{s.pgs.length} PGs available</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== ④ RE-ENGAGE (#14) ============== */
function ReEngage({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [pgId, setPgId] = useState(PGS[0]?.id || "");
  const [stage, setStage] = useState<"visited" | "got_price" | "browsed">("visited");
  const [leadName, setLeadName] = useState("");
  const pg = PGS.find((p) => p.id === pgId);
  const message = useMemo(() => pg ? buildReengagement(pg, stage) : "", [pg, stage]);
  const personalised = leadName ? message.replace(/^Hi!/, `Hi ${leadName}!`) : message;
  const fr = pg ? freshness(pg) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <Field label="Lead name">
          <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Optional"
            className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none" />
        </Field>
        <Field label="Which property did they engage with?">
          <Select value={pgId} onValueChange={setPgId}>
            <SelectTrigger className="w-full rounded-xl border border-input bg-surface-1 px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent>
              {PGS.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.area}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="What stage did they reach?">
          <div className="flex gap-1 rounded-full bg-muted/60 p-1">
            {(["visited", "got_price", "browsed"] as const).map((s) => (
              <button key={s} onClick={() => setStage(s)}
                className={cn("flex-1 rounded-full px-2 py-2 text-xs font-medium transition-all",
                  stage === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {s === "visited" ? "Visited" : s === "got_price" ? "Got price" : "Just browsed"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {pg && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Re-engagement message
            </h3>
            <CopyButton text={personalised} label="Copy" />
          </div>
          {fr?.isFresh && (
            <div className="mb-3 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
              ✦ {fr.changeKind} {fr.daysAgo} days ago — perfect re-engagement hook.
            </div>
          )}
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-xs leading-relaxed">{personalised}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={waLink(pg.manager.phone, personalised)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 px-4 py-2 text-xs font-medium text-emerald-500 dark:text-emerald-300 shadow-sm hover:bg-emerald-500/25 transition-all">
              <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
            </a>
            <button onClick={() => onOpen(pg)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-muted shadow-sm transition-all">
              <Sparkles className="h-3.5 w-3.5" /> Open property
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== Shared bits ============== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value, accent, hot }: { label: string; value: string; accent?: boolean; hot?: boolean }) {
  return (
    <div className="rounded-md bg-surface-2 p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-mono text-sm font-bold tabular-nums",
        hot ? "text-rose-300" : accent ? "text-primary" : "text-foreground")}>{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Brain className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
