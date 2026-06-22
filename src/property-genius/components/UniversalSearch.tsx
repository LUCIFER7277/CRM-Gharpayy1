// Universal landmark search — Google-grade. Operates on 1100+ landmarks
// + 132 PGs. Type a company name, mall, metro, area, pincode, or partial
// nickname; get a unified result list with type chips and "find PGs near".

import { useEffect, useMemo, useRef, useState } from "react";
import { searchLandmarks, searchPGs } from "@/property-genius/lib/search";
import type { Landmark, PG } from "@/property-genius/data/types";
import { Search, MapPin, Building2, GraduationCap, Hospital, Train, Briefcase, Banknote, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, typeof MapPin> = {
  "Tech Park": Building2,
  "MNC": Briefcase,
  "Unicorn": Sparkles,
  "Startup": Sparkles,
  "GCC": Briefcase,
  "Coworking": Briefcase,
  "Hospital": Hospital,
  "College": GraduationCap,
  "Metro": Train,
  "Bank": Banknote,
  "Retail HQ": Building2,
  "Pharma": Hospital,
  "Gaming/AI": Sparkles,
  "Govt": Building2,
};

const TYPE_COLOR: Record<string, string> = {
  "Tech Park": "text-cyan-400 bg-cyan-400/10",
  "MNC": "text-violet-400 bg-violet-400/10",
  "Unicorn": "text-pink-400 bg-pink-400/10",
  "Startup": "text-fuchsia-400 bg-fuchsia-400/10",
  "GCC": "text-indigo-400 bg-indigo-400/10",
  "Coworking": "text-teal-400 bg-teal-400/10",
  "Hospital": "text-rose-400 bg-rose-400/10",
  "College": "text-amber-400 bg-amber-400/10",
  "Metro": "text-emerald-400 bg-emerald-400/10",
  "Bank": "text-blue-400 bg-blue-400/10",
  "Retail HQ": "text-orange-400 bg-orange-400/10",
  "Pharma": "text-red-400 bg-red-400/10",
  "Gaming/AI": "text-purple-400 bg-purple-400/10",
  "Govt": "text-slate-400 bg-slate-400/10",
};

interface Props {
  onPickLandmark: (lm: Landmark) => void;
  onPickPG: (pg: PG) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const RECENT_KEY = "gh_recent_searches";

export function UniversalSearch({ onPickLandmark, onPickPG, placeholder, autoFocus }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const r = sessionStorage.getItem(RECENT_KEY);
      if (r) setRecent(JSON.parse(r));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const lmHits = useMemo(() => searchLandmarks(q, 12), [q]);
  const pgHits = useMemo(() => (q ? searchPGs(q, 6) : []), [q]);

  const saveRecent = (term: string) => {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  const pickLM = (lm: Landmark) => {
    saveRecent(lm.n);
    setQ(lm.n);
    setOpen(false);
    onPickLandmark(lm);
  };

  const pickPG = (pg: PG) => {
    saveRecent(pg.name);
    setQ(pg.name);
    setOpen(false);
    onPickPG(pg);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-smooth",
        open && "ring-glow",
      )}>
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search anything — Manyata, Tonic Kora, Christ back gate, 560066, Goldman Sachs, NEX COED…"}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
        />
        {q && (
          <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-card animate-fade-up">
          {!q && recent.length > 0 && (
            <div className="p-3">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Recent</div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((r) => (
                  <button key={r} onClick={() => { setQ(r); inputRef.current?.focus(); }}
                    className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs hover:border-primary/50">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && lmHits.length === 0 && pgHits.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results for "{q}". Try a different spelling, area name, or pincode.
            </div>
          )}

          {pgHits.length > 0 && (
            <div className="border-b border-border">
              <div className="px-3 pt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Properties</div>
              <ul>
                {pgHits.map((h) => (
                  <li key={h.pg.id}>
                    <button onClick={() => pickPG(h.pg)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium truncate">
                          {h.pg.name}
                          <span className="font-mono text-[10px] text-muted-foreground">IQ {h.pg.iq}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {h.pg.area} · {h.pg.gender} · {h.pg.tier}
                          {h.matched[0] && <span className="text-primary/80"> · {h.matched[0]}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lmHits.length > 0 && (
            <div>
              <div className="px-3 pt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Landmarks · {lmHits.length}</div>
              <ul>
                {lmHits.map((lm, i) => {
                  const Icon = TYPE_ICON[lm.t] ?? MapPin;
                  const color = TYPE_COLOR[lm.t] ?? "text-muted-foreground bg-muted";
                  return (
                    <li key={`${lm.n}-${i}`}>
                      <button onClick={() => pickLM(lm)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", color)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium truncate">
                            {lm.n}
                            <span className="text-[10px] font-mono text-muted-foreground">{Math.round(lm.score * 100)}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {lm.t}{lm.a && ` · ${lm.a}`}{lm.p && ` · ${lm.p}`}
                            {lm.x && <span className="text-muted-foreground/70"> · {lm.x}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
