import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useTcmContacts } from "@/lib/crm10x/tcm-contacts";
import { formatINR } from "@/lib/crm10x/quotations";
import { memberAreaLabel, memberDisplayName, memberOptionLabel } from "@/hooks/useOrgDirectory";
import {
  allCatalogProperties,
  resolvePropertyById,
  searchPropertyCatalog,
  type CatalogProperty,
} from "@/lib/crm10x/property-catalog";
import { scarcity } from "@/supply-hub/lib/intel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pin, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

function tmName(t: { fullName?: string; name?: string }): string {
  return memberDisplayName(t, "—");
}

function tmInitials(t: { fullName?: string; name?: string }): string {
  const n = tmName(t);
  const parts = n.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function tmZone(t: { zone?: string; zones?: string[] }): string {
  if (t.zone) return t.zone;
  if (Array.isArray(t.zones) && t.zones.length > 0) return t.zones[0];
  return "";
}

function catalogVacantBeds(property: CatalogProperty): number {
  if (property.source === "ops") return Number(property.vacantBeds ?? 0) || 0;
  if (!property.pg) return 0;
  const live = scarcity(property.pg).perBed;
  return Object.values(live).reduce<number>((sum, count) => sum + (count ?? 0), 0);
}

function catalogTotalBeds(property: CatalogProperty): number | null {
  if (property.source === "ops") return Number(property.totalBeds ?? 0) || null;
  if (!property.pg) return null;
  return [property.pg.prices.single, property.pg.prices.double, property.pg.prices.triple].filter(
    (price) => price > 0,
  ).length;
}

function normalizeInventoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function propertyMatchesTcmZone(
  property: CatalogProperty,
  tcm: { zone?: string; zones?: string[] },
): boolean {
  const zoneText = normalizeInventoryText(tmZone(tcm));
  if (!zoneText) return false;
  const propertyText = normalizeInventoryText(
    [property.area, property.name, property.pg?.locality, property.ops?.area]
      .filter(Boolean)
      .join(" "),
  );
  return (
    propertyText.includes(zoneText) || zoneText.includes(normalizeInventoryText(property.area))
  );
}

export function ImpactFocusInventoryPanel({
  tcmFilter,
  tcmOptions,
  onPropertyTap,
}: {
  tcmFilter: string;
  tcmOptions: Array<{
    id: string;
    fullName?: string;
    name?: string;
    zone?: string;
    zones?: string[];
  }>;
  onPropertyTap?: (area: string) => void;
}) {
  const properties = useApp((s) => s.properties);
  const focusProps = useTcmContacts((s) => s.focusProps);
  const [manageOpen, setManageOpen] = useState(false);

  const activeTcm = tcmFilter !== "all" ? tcmOptions.find((t) => t.id === tcmFilter) : undefined;

  const rows = useMemo(() => {
    const list = activeTcm ? [activeTcm] : tcmOptions;
    const catalog = allCatalogProperties(properties);
    return list.map((t) => {
      const ids = focusProps[t.id] ?? [];
      const props = ids
        .map((id: string) => resolvePropertyById(id, properties))
        .filter(Boolean) as CatalogProperty[];
      const inventoryScope = props.length
        ? props
        : catalog.filter((property) => propertyMatchesTcmZone(property, t));
      const scopedInventory = inventoryScope.length ? inventoryScope : catalog;
      const vacant = scopedInventory.reduce((a, p) => a + catalogVacantBeds(p), 0);
      const label = props.length ? "beds free" : "hub beds";
      return { tcm: t, props, vacant, label };
    });
  }, [activeTcm, tcmOptions, focusProps, properties]);

  const primaryRow = rows[0];

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Pin className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-sm font-semibold text-foreground">Today&apos;s focus.</span>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setManageOpen(true)}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Manage
        </button>
      </div>

      {primaryRow ? (
        <>
          <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
              {tmInitials(primaryRow.tcm)}
            </div>
            <span className="font-medium text-foreground">
              {tmName(primaryRow.tcm).split(" ")[0]}
            </span>
            <span>·</span>
            <span>
              {primaryRow.vacant} {primaryRow.label}
            </span>
            <span>·</span>
            <span>
              {primaryRow.props.length} propert{primaryRow.props.length === 1 ? "y" : "ies"}
            </span>
          </div>

          {primaryRow.props.length === 0 ? (
            <p className="mb-2 text-[11px] italic text-muted-foreground">
              No focus set — tap Manage to pin properties.
            </p>
          ) : (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {primaryRow.props.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPropertyTap?.(p.area)}
                  className="flex min-w-[8.5rem] shrink-0 items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left hover:border-accent/50 hover:bg-accent/5"
                >
                  <span className="truncate text-[11px] font-semibold text-foreground">
                    {p.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] font-mono px-1.5",
                      catalogVacantBeds(p) > 0
                        ? "bg-success/10 text-success border-success/40"
                        : "bg-danger/10 text-danger border-danger/40",
                    )}
                  >
                    {catalogVacantBeds(p)}/{catalogTotalBeds(p) ?? "—"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mb-2 text-[11px] italic text-muted-foreground">
          No TCMs available. Add a member first, then pin focus properties.
        </p>
      )}

      {rows.length > 1 ? (
        <div className="mb-2 max-h-24 space-y-1 overflow-y-auto border-t border-border/60 pt-2">
          {rows.slice(1).map(({ tcm, props, vacant, label }) => (
            <div key={tcm.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">{tmName(tcm).split(" ")[0]}</span>
              <span>
                {vacant} {label}
              </span>
              <span>· {props.length} props</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-right text-[10px] text-muted-foreground">Tap a property to filter board</p>

      <ManageFocusDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        defaultTcmId={activeTcm?.id ?? tcmOptions[0]?.id ?? ""}
        tcmOptions={tcmOptions}
      />
    </div>
  );
}

function ManageFocusDialog({
  open,
  onOpenChange,
  defaultTcmId,
  tcmOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTcmId: string;
  tcmOptions: Array<{
    id: string;
    fullName?: string;
    name?: string;
    zone?: string;
    zones?: string[];
  }>;
}) {
  const properties = useApp((s) => s.properties);
  const focusProps = useTcmContacts((s) => s.focusProps);
  const toggleFocusProp = useTcmContacts((s) => s.toggleFocusProp);
  const clearFocus = useTcmContacts((s) => s.clearFocus);
  const [tcmId, setTcmId] = useState(defaultTcmId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setTcmId(defaultTcmId);
      setQuery("");
    }
  }, [open, defaultTcmId]);

  const focused = focusProps[tcmId] ?? [];

  const list = useMemo(() => {
    const q = query.trim();
    const base = q
      ? searchPropertyCatalog(q, properties, { limit: 80 })
      : allCatalogProperties(properties);
    return [...base].sort((a, b) => {
      const af = focused.includes(a.id) ? 0 : 1;
      const bf = focused.includes(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return (b.vacantBeds ?? 1) - (a.vacantBeds ?? 1);
    });
  }, [properties, query, focused]);

  const selectedTcm = tcmOptions.find((t) => t.id === tcmId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border shrink-0">
          <Pin className="h-5 w-5 text-foreground" />
          <DialogTitle className="text-base font-semibold text-foreground">
            Manage focus inventory
          </DialogTitle>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 pt-5 pb-4 shrink-0">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              TCM
            </Label>
            <Select value={tcmId} onValueChange={setTcmId}>
              <SelectTrigger className="h-11 text-sm rounded-xl border-border bg-background">
                <SelectValue>
                  {selectedTcm ? memberOptionLabel(selectedTcm) : "Select TCM"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tcmOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    <span className="font-medium">{tmName(t)}</span>
                    <span className="text-muted-foreground"> · {memberAreaLabel(t)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              Search
            </Label>
            <Input
              className="h-11 text-sm rounded-xl border-border bg-background"
              placeholder="Property name or area"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 pb-3 shrink-0">
          <span className="text-sm text-foreground">
            {focused.length} {focused.length === 1 ? "property" : "properties"} pinned
          </span>
          {focused.length > 0 ? (
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                clearFocus(tcmId);
                toast("Focus cleared");
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1.5">
          {list.map((p) => {
            const on = focused.includes(p.id);
            const vacant = catalogVacantBeds(p);
            const total = catalogTotalBeds(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const wasOn = focused.includes(p.id);
                  toggleFocusProp(tcmId, p.id);
                  toast.success(wasOn ? `Removed ${p.name}` : `Pinned ${p.name}`);
                }}
                className={cn(
                  "w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-4 transition-colors",
                  on
                    ? "bg-orange-50 border-orange-400 dark:bg-orange-950/30 dark:border-orange-500"
                    : "bg-background border-border hover:bg-muted/40",
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    on
                      ? "bg-orange-500 border-orange-500"
                      : "border-muted-foreground/40 bg-background",
                  )}
                >
                  {on ? (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm font-semibold truncate",
                      on ? "text-orange-700 dark:text-orange-300" : "text-foreground",
                    )}
                  >
                    {p.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {p.area} · {formatINR(p.pricePerBed)}/bed
                  </div>
                </div>

                <div
                  className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums px-2.5 py-0.5 rounded-full border",
                    vacant > 0
                      ? "text-success border-success/40 bg-success/10"
                      : "text-danger border-danger/40 bg-danger/10",
                  )}
                >
                  {vacant}/{total ?? "—"}
                </div>
              </button>
            );
          })}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No properties match.</p>
          ) : null}
        </div>

        <div className="px-4 pb-5 pt-3 shrink-0 border-t border-border">
          <Button
            type="button"
            className="w-full h-12 rounded-xl text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
