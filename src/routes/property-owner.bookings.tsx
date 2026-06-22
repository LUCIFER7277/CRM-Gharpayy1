import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { PropertySidebar } from "@/components/owner-bookings/PropertySidebar";
import { useOwnerScope } from "@/property-owner/lib/owner-scope";
import { useOwnerBookingsFromApi } from "@/lib/owner-bookings/api";
import { useGetRealOwnerProperties } from "@/property-owner/lib/api";
import {
  Search, IndianRupee, CheckCircle2,
  Building2, User, BedDouble, CalendarDays, Key
} from "lucide-react";

export const Route = createFileRoute("/property-owner/bookings")({
  head: () => ({ meta: [{ title: "My Bookings — Gharpayy" }] }),
  component: () => <OwnerBookingsConsole />,
});

const TAB_FILTERS: { id: string; label: string; match: (b: OwnerBooking) => boolean }[] = [
  { id: "active", label: "Active", match: (b) => ["acknowledged", "room_ready", "move_in_approved"].includes(b.status) },
  { id: "room_prep", label: "Room Prep", match: (b) => b.status === "acknowledged" },
  { id: "ready", label: "Ready for Move-in", match: (b) => b.status === "room_ready" || b.status === "move_in_approved" },
  { id: "completed", label: "Completed", match: (b) => b.status === "completed" },
  { id: "issues", label: "Issues", match: (b) => b.status === "cancelled" || b.ownerDecision === "reject" },
  { id: "all", label: "All Ops", match: () => true },
];

function sharingLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return iso; }
}

function OwnerBookingsConsole() {
  const { ownerBookings: localBookings } = useOwnerScope();
  const { data: apiBookings } = useOwnerBookingsFromApi();
  const { data: ownerProperties } = useGetRealOwnerProperties();

  const ownerPropertyIds = useMemo(
    () => new Set((ownerProperties ?? []).map((p: any) => String(p.id))),
    [ownerProperties],
  );

  const bookings: OwnerBooking[] = useMemo(() => {
    const base = apiBookings?.length ? apiBookings : (ownerPropertyIds.size > 0 ? localBookings.filter((b) => ownerPropertyIds.has(b.inventory.propertyId)) : localBookings);
    
    // Crucial scoping rule: Ops page ONLY shows bookings that bypass approvals, or are explicitly decided on
    return base.filter((b: OwnerBooking) => 
      b.status !== "created" && b.status !== "shared_with_owner" && b.status !== "viewed_by_owner"
    ) as OwnerBooking[];
  }, [apiBookings, localBookings, ownerPropertyIds]);

  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const propertyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      const pid = b.inventory.propertyId || "__unknown__";
      counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  }, [bookings]);

  const propertyEntries = useMemo(() => {
    const propMap = new Map((ownerProperties ?? []).map((p: any) => [String(p.id), p]));
    return Object.entries(propertyCounts).map(([id, count]) => {
      const prop = propMap.get(id) as any;
      return {
        id,
        name: prop?.name ?? (id === "__unknown__" ? "Unknown property" : `Property (${id})`),
        area: prop?.address ?? prop?.area ?? "",
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [propertyCounts, ownerProperties]);

  const propertyIds = useMemo(() => propertyEntries.map((p) => p.id), [propertyEntries]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    propertyIds.length > 0 ? propertyIds[0] : null,
  );

  const filtered = useMemo(() => {
    const f = TAB_FILTERS.find((t) => t.id === tab)!.match;
    const term = q.trim().toLowerCase();
    return bookings.filter((b) =>
      f(b) &&
      (selectedPropertyId === null || (b.inventory.propertyId || "__unknown__") === selectedPropertyId) &&
      (term === "" ||
        b.customer.name.toLowerCase().includes(term) ||
        b.customer.phone.toLowerCase().includes(term) ||
        b.inventory.propertyName.toLowerCase().includes(term) ||
        b.inventory.roomNumber.toLowerCase().includes(term))
    );
  }, [bookings, tab, q, selectedPropertyId]);

  const stats = useMemo(() => {
    return bookings.reduce(
      (acc, b) => {
        const t = computeTotals(b);
        acc.expected += t.expected;
        acc.received += t.received;
        if (b.status === "acknowledged" || b.status === "room_ready" || b.status === "move_in_approved") acc.active++;
        if (b.status === "room_ready" || b.status === "move_in_approved") acc.ready++;
        return acc;
      },
      { expected: 0, received: 0, active: 0, ready: 0, total: bookings.length },
    );
  }, [bookings]);

  const openBooking = bookings.find((b) => b.id === openId);

  const handlePropertySelect = (id: string | null) => {
    setSelectedPropertyId(id);
    setOpenId(null);
    setQ("");
    setTab("active");
  };

  const selectedCount = selectedPropertyId ? (propertyCounts[selectedPropertyId] ?? 0) : bookings.length;
  const noPropertySelected = selectedPropertyId === null || propertyIds.length === 0;

  useEffect(() => {
    if (propertyIds.length === 0) {
      setSelectedPropertyId(null);
    } else if (!selectedPropertyId || !propertyIds.includes(selectedPropertyId)) {
      setSelectedPropertyId(propertyIds[0]);
    }
  }, [bookings.length, propertyIds.join(",")]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Booking Operations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage active bookings, track room readiness, and oversee move-ins.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 max-w-4xl">
          <KPICard
            label="Active Bookings"
            value={stats.active.toString()}
            icon={<Building2 className="h-5 w-5 text-blue-500" />}
            cardClass="bg-blue-500/5 border-blue-500/20"
            labelClass="text-blue-600/80"
            valueClass="text-blue-600"
          />
          <KPICard
            label="Upcoming Move-ins"
            value={stats.ready.toString()}
            icon={<Key className="h-5 w-5 text-emerald-500" />}
            cardClass="bg-emerald-500/5 border-emerald-500/20"
            labelClass="text-emerald-600/80"
            valueClass="text-emerald-600"
          />
          <KPICard
            label="Total Collected"
            value={`₹${(stats.received / 1000).toFixed(1)}K`}
            icon={<IndianRupee className="h-5 w-5 text-slate-500" />}
            cardClass="bg-slate-500/5 border-slate-500/20"
            labelClass="text-slate-600/80"
            valueClass="text-slate-600"
          />
          <KPICard
            label="Pending Dues"
            value={`₹${((stats.expected - stats.received) / 1000).toFixed(1)}K`}
            icon={<IndianRupee className="h-5 w-5 text-amber-500" />}
            cardClass="bg-amber-500/5 border-amber-500/20"
            labelClass="text-amber-600/80"
            valueClass="text-amber-600"
          />
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div className="flex-1 flex min-h-0">
        <div className="w-[200px] shrink-0 border-r border-border bg-muted/5 flex flex-col min-h-0">
          <PropertySidebar properties={propertyEntries} selectedPropertyId={selectedPropertyId} onSelect={handlePropertySelect} />
        </div>

        <div className="w-[460px] shrink-0 border-r border-border flex flex-col min-h-0 bg-background">
          {noPropertySelected ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select a property from the left panel.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-border/40">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="h-8 w-full flex justify-start overflow-x-auto">
                    {TAB_FILTERS.map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className="text-xs px-2.5 whitespace-nowrap">{t.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, room…" className="pl-8 h-8 text-xs" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                    {q || tab !== "all" ? "No bookings match the current filters." : "No operations required here."}
                  </div>
                )}
                {filtered.map((b) => {
                  const t = computeTotals(b);
                  const isSelected = openId === b.id;
                  return (
                    <button key={b.id} type="button" onClick={() => setOpenId(b.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>{b.customer.name}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${isSelected ? "border-primary/30" : ""}`}>{LIFECYCLE_LABEL[b.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <BedDouble className="h-3 w-3 shrink-0" />
                        <span>{sharingLabel(b.inventory.sharing)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>R{b.inventory.roomNumber || "—"}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <CalendarDays className="h-3 w-3" />
                        <span>{formatDate(b.moveIn.date)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-xs font-medium ${t.pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {t.pending > 0 ? `₹${t.pending.toLocaleString("en-IN")} pending` : "Fully paid"}
                        </span>
                        <span className="text-xs text-muted-foreground">₹{b.rent.toLocaleString("en-IN")}/mo</span>
                      </div>
                      {t.totalReadiness > 0 && (
                        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all rounded-full" style={{ width: `${(t.readyCount / t.totalReadiness) * 100}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-background">
          <div className="flex-1 overflow-y-auto">
            {openBooking ? (
              <div className="p-5 max-w-3xl mx-auto">
                <OwnerBookingCard booking={openBooking} mode="owner" submode="operations" />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <User className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">Select an operational booking to view readiness, payments, and timeline details.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, valueClass, cardClass, labelClass }: any) {
  return (
    <Card className={`px-4 py-3 flex items-center gap-3 ${cardClass || ""}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className={`text-xs font-medium uppercase tracking-wider truncate ${labelClass || "text-muted-foreground"}`}>{label}</div>
        <div className={`text-2xl font-black mt-0.5 ${valueClass ?? "text-foreground"}`}>{value}</div>
      </div>
    </Card>
  );
}
