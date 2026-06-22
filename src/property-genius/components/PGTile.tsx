// PG tile — Closer Pack lives here.
// Surfaces: persona badge, scarcity signal, ₹/day reframe, freshness tag,
// nearest landmark walk-time, IQ score. Every signal is real (derived from
// existing data). One-tap shortlist via the heart.

import type { PG } from "@/property-genius/data/types";
import { MapPin, Footprints, Phone, Star, StarOff, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShortlist } from "@/property-genius/lib/useShortlist";
import { personaBadge, personaStyle, scarcity, freshness, perDay } from "@/property-genius/lib/intel";

const tierColor = (t: string) =>
  t === "Premium" ? "text-accent border-accent/40 bg-accent/10"
  : t === "Mid" ? "text-info border-info/40 bg-info/10"
  : "text-muted-foreground border-border bg-muted";

const genderColor = (g: string) =>
  g === "Girls" ? "text-pink-400 bg-pink-400/10"
  : g === "Boys" ? "text-blue-400 bg-blue-400/10"
  : "text-emerald-400 bg-emerald-400/10";

function iqColor(iq: number) {
  if (iq >= 75) return "text-emerald-400";
  if (iq >= 60) return "text-amber-400";
  if (iq >= 40) return "text-orange-400";
  return "text-rose-400";
}

function priceLabel(pg: PG): { primary: string; perDay: string | null } {
  const parts: string[] = [];
  if (pg.prices.triple) parts.push(`T ${Math.round(pg.prices.triple / 1000)}k`);
  if (pg.prices.double) parts.push(`D ${Math.round(pg.prices.double / 1000)}k`);
  if (pg.prices.single) parts.push(`S ${Math.round(pg.prices.single / 1000)}k`);
  const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((p) => p > 0);
  const cheapest = beds.length ? Math.min(...beds) : 0;
  return {
    primary: parts.length ? parts.join(" · ") : "On call",
    perDay: cheapest ? `₹${perDay(cheapest)}/day` : null,
  };
}

export function PGTile({ pg, onClick, badge }: { pg: PG; onClick: () => void; badge?: string }) {
  const { has, toggle } = useShortlist();
  const saved = has(pg.id);
  const closest = pg.nearbyLandmarks?.[0];
  const price = priceLabel(pg);
  const persona = personaBadge(pg);
  const pStyle = personaStyle(persona);
  const sc = scarcity(pg);
  const fr = freshness(pg);

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex w-full flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 text-left shadow-card transition-smooth hover:border-primary/40 hover:shadow-glow"
      >
        {badge && (
          <div className="absolute -top-2 left-3 z-10 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary">
            {badge}
          </div>
        )}

        {/* Top row: name + IQ */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-7">
            <div className="font-display text-base font-semibold leading-tight truncate">{pg.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <MapPin className="h-3 w-3 shrink-0" /> {pg.area}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div className={cn("font-mono text-2xl font-bold leading-none tabular-nums", iqColor(pg.iq))}>
              {pg.iq}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">IQ</div>
          </div>
        </div>

        {/* Persona pitch badge — single chip, 2-second read */}
        <div className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium", pStyle.color)}>
          <Sparkles className="h-3 w-3" />
          <span className="truncate">{persona}</span>
        </div>

        {/* Nearest landmark — the metres-not-kilometres play */}
        {closest && (
          <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-xs">
            <Footprints className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate flex-1">{closest.n}</span>
            <span className="font-mono text-muted-foreground shrink-0">
              {closest.w <= 0 ? "<1m" : `${closest.w}m walk`}
            </span>
          </div>
        )}

        {/* Tier · Gender · Food chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium", tierColor(pg.tier))}>{pg.tier}</span>
          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", genderColor(pg.gender))}>{pg.gender}</span>
          {pg.foodType && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">{pg.foodType}</span>}
          {fr.isFresh && fr.changeKind && (
            <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300" title={fr.message}>
              ✦ {fr.changeKind}
            </span>
          )}
        </div>

        {/* Bottom row: price + per-day + scarcity */}
        <div className="flex items-end justify-between border-t border-border pt-2.5">
          <div>
            <div className="font-mono text-sm tabular-nums">{price.primary}</div>
            {price.perDay && (
              <div className="font-mono text-[10px] text-emerald-400 tabular-nums leading-none mt-0.5">
                {price.perDay}
              </div>
            )}
          </div>
          {sc.hot ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse-dot">
              <Flame className="h-3 w-3" /> {sc.level}
            </span>
          ) : sc.level === "FEW LEFT" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              {sc.level}
            </span>
          ) : sc.level === "FULL" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Waitlist
            </span>
          ) : pg.manager.phone ? (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Phone className="h-3 w-3" /> {pg.manager.phone}
            </span>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(pg.id); }}
        title={saved ? "Remove from shortlist" : "Add to shortlist"}
        className={cn(
          "absolute right-3 top-3 z-10 rounded-md p-1.5 transition-smooth",
          saved ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-surface-2"
        )}
      >
        {saved ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
      </button>
    </div>
  );
}
