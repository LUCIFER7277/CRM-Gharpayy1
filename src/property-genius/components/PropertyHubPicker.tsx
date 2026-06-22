// Compact Property Hub picker for Impact Queue dialogs (quotations, tours, etc.).
// Searches the full PGS catalog — same source as Property Hub.

import { useMemo, useState } from "react";
import { PGS } from "@/property-genius/data/pgs";
import { searchPGs } from "@/property-genius/lib/search";
import { perDay } from "@/property-genius/lib/intel";
import type { PG } from "@/property-genius/data/types";
import { formatINR } from "@/lib/utils";
import { Search, Building2, ExternalLink, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function cheapestBed(pg: PG): number {
  const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0);
  return beds.length ? Math.min(...beds) : pg.prices.min || 0;
}

export function pgQuoteDefaults(pg: PG) {
  const discounted = cheapestBed(pg) || pg.prices.min || 12000;
  const actualRent = pg.prices.max || Math.round(discounted * 1.15);
  const roomType =
    pg.prices.triple > 0 && discounted === pg.prices.triple
      ? "Triple Sharing"
      : pg.prices.double > 0 && discounted === pg.prices.double
        ? "Double Sharing"
        : pg.prices.single > 0
          ? "Private"
          : "Shared";
  const depositMatch = /one\s*month|1\s*month/i.test(pg.deposit ?? "");
  const deposit = depositMatch ? discounted : Math.round(discounted * 0.5) || 5000;
  return {
    propertyId: pg.id,
    propertyName: pg.name,
    actualRent,
    discounted,
    deposit,
    roomType,
    lockIn: pg.minStay || "3 Months",
    area: pg.area,
  };
}

interface Props {
  selected: PG | null;
  onSelect: (pg: PG) => void;
  onClear?: () => void;
  preferredArea?: string;
  placeholder?: string;
  className?: string;
}

export function PropertyHubPicker({
  selected,
  onSelect,
  onClear,
  preferredArea,
  placeholder = "Search Property Hub — name, area, landmark…",
  className,
}: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim();
    if (q) return searchPGs(q, 8).map((h) => h.pg);
    if (preferredArea) {
      const byArea = PGS.filter((p) =>
        p.area.toLowerCase().includes(preferredArea.toLowerCase()) ||
        preferredArea.toLowerCase().includes(p.area.toLowerCase()),
      );
      if (byArea.length) return byArea.slice(0, 8);
    }
    return [...PGS].sort((a, b) => b.iq - a.iq).slice(0, 8);
  }, [query, preferredArea]);

  const showList = !selected || query.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Property Hub
        </div>
        <a
          href="/property-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
        >
          Open hub <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {selected && !query && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{selected.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {selected.area} · {selected.gender} · IQ {selected.iq}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              From {formatINR(cheapestBed(selected))}/mo · ₹{perDay(cheapestBed(selected))}/day
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onClear?.(); setQuery(""); }}
            className="shrink-0 rounded p-1 hover:bg-muted"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <InputLike
          value={selected && !query ? selected.name : query}
          onChange={(v) => { setQuery(v); if (selected && v !== selected.name) onClear?.(); }}
          placeholder={placeholder}
        />
      </div>

      {showList && (
        <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border border-border divide-y divide-border">
          {results.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No properties in Property Hub match.</div>
          )}
          {results.map((pg) => (
            <button
              key={pg.id}
              type="button"
              onClick={() => { onSelect(pg); setQuery(""); }}
              className={cn(
                "w-full text-left px-2.5 py-2 hover:bg-muted/50 transition-colors",
                selected?.id === pg.id && "bg-primary/10",
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{pg.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {pg.area} · {formatINR(cheapestBed(pg))}/mo · IQ {pg.iq}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InputLike({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 rounded-md border border-border bg-transparent pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
