import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MapPin } from "lucide-react";

interface PropertyEntry {
  id: string;
  name: string;
  area: string;
  count: number;
}

interface Props {
  properties: PropertyEntry[];
  selectedPropertyId: string | null;
  onSelect: (id: string | null) => void;
}

export function PropertySidebar({ properties, selectedPropertyId, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q),
    );
  }, [properties, query]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/40">
        <div className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Properties
          <span className="text-muted-foreground/60 font-normal">({properties.length})</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-xs text-muted-foreground text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
            {query
              ? "No properties match your search."
              : properties.length === 0
              ? "No owner bookings yet."
              : "No properties found."}
          </div>
        )}

        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
              selectedPropertyId === p.id
                ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/30"
                : "text-foreground hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{p.name}</span>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${
                selectedPropertyId === p.id ? "border-primary/30" : ""
              }`}>{p.count}</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.area}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
