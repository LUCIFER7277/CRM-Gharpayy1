// Sticky "PG near …" shelf chips for the active zone. Click → setQuery + scroll.
import { useZone } from "@/property-genius/lib/zones";
import { ZONES, accentClasses } from "@/property-genius/data/zones";
import { Phone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Optional click handler that consumes the shelf query (e.g. to set search). */
  onShelfClick?: (query: string) => void;
}

export function ZoneShelfBar({ onShelfClick }: Props) {
  const { zone } = useZone();
  if (zone === "all") return null;
  const z = ZONES.find((x) => x.id === zone);
  if (!z) return null;
  const acc = accentClasses(z.accent);

  return (
    <div className={cn("sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur")}>
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 scrollbar-none">
        <div className={cn("flex items-center gap-1.5 shrink-0 rounded-md border px-2 py-1 text-xs font-medium", acc.text, acc.bg, acc.border)}>
          <Sparkles className="h-3 w-3" /> {z.short}
        </div>
        <a
          href={`tel:+91${z.phone}`}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] hover:border-primary/40"
          title={`Call ${z.label}`}
        >
          <Phone className="h-3 w-3 text-primary" /> {z.phone}
        </a>
        <span className="h-4 w-px shrink-0 bg-border" />
        {z.shelves.map((s) => (
          <button
            key={s.label}
            onClick={() => onShelfClick?.(s.query)}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/50 hover:bg-primary/5 transition-smooth"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
