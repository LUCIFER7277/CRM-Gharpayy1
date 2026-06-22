// Floating shortlist tray. Bottom-right (mobile: full-width bar). Click → compare modal.

import { useMemo, useState } from "react";
import { PGS } from "@/property-genius/data/pgs";
import { useShortlist } from "@/property-genius/lib/useShortlist";
import { Star, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PG } from "@/property-genius/data/types";

interface Props {
  onOpenPG: (pg: PG) => void;
}

export function ShortlistTray({ onOpenPG }: Props) {
  const { ids, remove, clear, count } = useShortlist();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => ids.map((id) => PGS.find((p) => p.id === id)).filter(Boolean) as PG[], [ids]);

  if (count === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2.5 font-display text-sm font-medium text-amber-300 shadow-glow backdrop-blur transition-smooth hover:bg-amber-400/25 sm:left-auto sm:right-6 sm:translate-x-0"
      >
        <Star className="h-4 w-4 fill-current" />
        Shortlist
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 font-mono text-[10px] text-amber-950">{count}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-up sm:items-center" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-background p-4 shadow-card sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">Compare {items.length} {items.length === 1 ? "property" : "properties"}</h3>
                <p className="text-xs text-muted-foreground">Side-by-side view. Tap a card to open full playbook.</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={clear} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:border-rose-400/40 hover:text-rose-400">Clear all</button>
                <button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-surface-2"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div className={cn(
              "grid gap-3",
              items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {items.map((pg) => <CompareCard key={pg.id} pg={pg} onOpen={() => { onOpenPG(pg); setOpen(false); }} onRemove={() => remove(pg.id)} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CompareCard({ pg, onOpen, onRemove }: { pg: PG; onOpen: () => void; onRemove: () => void }) {
  const closest = pg.nearbyLandmarks?.[0];
  return (
    <div className="relative rounded-lg border border-border bg-card p-4">
      <button onClick={onRemove} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-rose-400">
        <X className="h-3.5 w-3.5" />
      </button>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="font-display text-sm font-semibold pr-6 truncate">{pg.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">{pg.area} · {pg.gender} · {pg.tier}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Row label="IQ" value={String(pg.iq)} />
          <Row label="Triple" value={pg.prices.triple ? `₹${(pg.prices.triple / 1000).toFixed(0)}k` : "—"} />
          <Row label="Double" value={pg.prices.double ? `₹${(pg.prices.double / 1000).toFixed(0)}k` : "—"} />
          <Row label="Single" value={pg.prices.single ? `₹${(pg.prices.single / 1000).toFixed(0)}k` : "—"} />
          <Row label="Food" value={pg.foodType || "—"} />
          <Row label="Deposit" value={pg.deposit?.split(" ")[0] || "—"} />
        </div>
        {closest && (
          <div className="mt-3 rounded-md bg-surface-2 px-2 py-1.5 text-[11px]">
            <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
            {closest.w <= 0 ? "<1" : closest.w} min walk to <b>{closest.n}</b>
          </div>
        )}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
