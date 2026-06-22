import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { AdminFilters } from "@/admin/lib/filter-schema";
import { defaultAdminFilters } from "@/admin/lib/filter-schema";

interface Props {
  filters: AdminFilters;
  onChange: (f: AdminFilters) => void;
  tcms: Array<{ id: string; name: string; zone: string }>;
  sources?: string[];
  stages?: string[];
  addedByOptions?: string[];
}

const STAGES = ["new", "contacted", "tour-scheduled", "tour-done", "negotiation", "booked", "dropped"];
const STATUSES: Array<"open" | "booked" | "lost" | "dormant"> = ["open", "booked", "lost", "dormant"];
const BUCKETS: Array<"cold" | "warm" | "hot"> = ["cold", "warm", "hot"];

export function AdminFilterBar({ filters, onChange, tcms, sources = [], stages = STAGES, addedByOptions = [] }: Props) {
  const [savedViewName, setSavedViewName] = useState("");
  const zones = useMemo(() => Array.from(new Set(tcms.map((t) => t.zone))), [tcms]);

  const toggle = <K extends keyof AdminFilters>(key: K, value: string) => {
    const cur = filters[key] as unknown as string[];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange({ ...filters, [key]: next });
  };

  const reset = () => onChange(defaultAdminFilters);

  const saveView = () => {
    if (!savedViewName.trim()) return;
    const views: Record<string, AdminFilters> = JSON.parse(localStorage.getItem("admin.views") ?? "{}");
    views[savedViewName] = filters;
    localStorage.setItem("admin.views", JSON.stringify(views));
    setSavedViewName("");
  };

  const savedViews: Record<string, AdminFilters> = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("admin.views") ?? "{}");
    } catch {
      return {};
    }
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search by name, phone, area, TCM…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="h-8 max-w-xs"
        />
        <Select value={filters.sort} onValueChange={(v) => onChange({ ...filters, sort: v })}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated:desc">Last updated</SelectItem>
            <SelectItem value="prob:desc">Probability ↓</SelectItem>
            <SelectItem value="prob:asc">Probability ↑</SelectItem>
            <SelectItem value="value:desc">Expected ₹ ↓</SelectItem>
            <SelectItem value="name:asc">Name A→Z</SelectItem>
            <SelectItem value="stage:asc">Stage</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={reset} className="h-8 text-xs">
          <X className="h-3 w-3 mr-1" /> Reset
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Input
            placeholder="Save view as…"
            value={savedViewName}
            onChange={(e) => setSavedViewName(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Button size="sm" variant="outline" onClick={saveView} className="h-8 text-xs">
            Save
          </Button>
          {Object.keys(savedViews).length > 0 && (
            <Select onValueChange={(v) => onChange(savedViews[v])}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Load…" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(savedViews).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <ChipRow label="Stage" values={stages} active={filters.stage} onToggle={(v) => toggle("stage", v)} />
      <ChipRow label="Status" values={STATUSES} active={filters.status} onToggle={(v) => toggle("status", v)} />
      <ChipRow label="Probability" values={BUCKETS} active={filters.probBucket} onToggle={(v) => toggle("probBucket", v)} />
      <ChipRow
        label="TCM"
        values={tcms.map((t) => t.id)}
        labels={Object.fromEntries(tcms.map((t) => [t.id, t.name]))}
        active={filters.assignedTo}
        onToggle={(v) => toggle("assignedTo", v)}
      />
      <ChipRow label="Zone" values={zones} active={filters.zone} onToggle={(v) => toggle("zone", v)} />
      {sources.length > 0 && <ChipRow label="Source" values={sources} active={filters.source} onToggle={(v) => toggle("source", v)} />}
      <ChipRow label="Dormant" values={["30d", "60d", "90d"]} active={filters.dormant} onToggle={(v) => toggle("dormant", v)} />
      <ChipRow label="Date Added" values={["today", "yesterday", "this-week", "this-month"]} active={filters.dateAdded || []} onToggle={(v) => toggle("dateAdded", v)} />
      {addedByOptions.length > 0 && <ChipRow label="Added By" values={addedByOptions} active={filters.addedBy || []} onToggle={(v) => toggle("addedBy", v)} />}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Quick:</span>
        <Button
          size="sm"
          variant={filters.hasVisit === true ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => onChange({ ...filters, hasVisit: filters.hasVisit === true ? undefined : true })}
        >
          Has visit
        </Button>
        <Button
          size="sm"
          variant={filters.booked === true ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => onChange({ ...filters, booked: filters.booked === true ? undefined : true })}
        >
          Booked
        </Button>
        <Button
          size="sm"
          variant={filters.booked === false ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => onChange({ ...filters, booked: filters.booked === false ? undefined : false })}
        >
          Not booked
        </Button>
      </div>
    </div>
  );
}

function ChipRow({
  label,
  values,
  active,
  onToggle,
  labels,
}: {
  label: string;
  values: readonly string[] | string[];
  active: readonly string[];
  onToggle: (v: string) => void;
  labels?: Record<string, string>;
}) {
  if (!values.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16">{label}</span>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className={cn(
            "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
            active.includes(v) ? "bg-accent text-accent-foreground border-accent" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted",
          )}
        >
          {labels?.[v] ?? v}
        </button>
      ))}
    </div>
  );
}
