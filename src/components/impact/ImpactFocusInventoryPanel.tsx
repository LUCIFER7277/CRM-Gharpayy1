import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();

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

  const rowsWithPins = rows.filter((r) => r.props.length > 0);
  const rowsWithoutPins = rows.filter((r) => r.props.length === 0);

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Pin className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight">Today&apos;s Focus</span>
        </div>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-secondary"
          onClick={() => setManageOpen(true)}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Manage
        </button>
      </div>

      {rowsWithPins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
            <Pin className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">No focus properties set.</p>
          <p className="text-[10px] text-muted-foreground/70">Tap Manage to pin properties to your board.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
          {rowsWithPins.map((row) => (
            <div key={row.tcm.id} className="relative rounded-xl border border-border/40 bg-card p-3 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                    {tmInitials(row.tcm)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-foreground leading-none">
                      {tmName(row.tcm)}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {row.label === 'beds free' ? 'Pinned Inventory' : row.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <span className="text-foreground font-semibold">{row.vacant}</span> beds
                  </div>
                  <div className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                    <span className="font-semibold">{row.props.length}</span> props
                  </div>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border">
                {row.props.map((p) => {
                  const vacant = catalogVacantBeds(p);
                  const total = catalogTotalBeds(p);
                  const isFull = vacant === 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate({ to: "/supply-hub/$id", params: { id: String(p.id) } })}
                      className="group flex w-[140px] shrink-0 flex-col gap-1.5 rounded-lg border border-border/50 bg-background/50 p-2.5 text-left transition-all hover:border-primary/30 hover:bg-white hover:shadow-md dark:hover:bg-primary/5 cursor-pointer"
                    >
                      <span className="truncate text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">
                        {p.name}
                      </span>
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] text-muted-foreground font-medium truncate pr-2">
                           {p.area}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[9px] font-mono px-1.5 py-0 h-4 border",
                            !isFull
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
                          )}
                        >
                          {vacant}/{total ?? "—"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {rowsWithoutPins.length > 0 && tcmFilter === "all" ? (
        <div className="mt-4 mb-2">
          <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Unpinned Team Members
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted">
            {rowsWithoutPins.map(({ tcm }) => (
              <div key={tcm.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-secondary-foreground">
                    {tmInitials(tcm)}
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{tmName(tcm)}</span>
                </div>
                <div className="flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {memberAreaLabel(tcm)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-right text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60">
        Tap a property for details
      </p>

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

  const getTcmLabel = (m: any) => {
    const pinned = focusProps?.[m?.id];
    if (pinned && pinned.length > 0) {
      const pNames = pinned.map((id) => properties?.find((p) => String(p.id) === String(id))?.name).filter(Boolean);
      if (pNames.length > 0) {
        return `${memberDisplayName(m)} · Pinned: ${pNames.slice(0, 2).join(", ")}${pNames.length > 2 ? '...' : ''}`;
      }
    }
    return memberOptionLabel(m);
  };

  const getTcmAreaLabel = (m: any) => {
    const pinned = focusProps?.[m?.id];
    if (pinned && pinned.length > 0) {
      const pNames = pinned.map((id) => properties?.find((p) => String(p.id) === String(id))?.name).filter(Boolean);
      if (pNames.length > 0) {
        return `Pinned: ${pNames.slice(0, 2).join(", ")}${pNames.length > 2 ? '...' : ''}`;
      }
    }
    return memberAreaLabel(m);
  };

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
                  {selectedTcm ? getTcmLabel(selectedTcm) : "Select TCM"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tcmOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    <span className="font-medium">{tmName(t)}</span>
                    <span className="text-muted-foreground"> · {getTcmAreaLabel(t)}</span>
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
