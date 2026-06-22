import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";
import { CreateBookingDialog } from "@/components/owner-bookings/CreateBookingDialog";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { PropertySidebar } from "@/components/owner-bookings/PropertySidebar";
import { resolvePropertyById } from "@/lib/crm10x/property-catalog";
import { useApp } from "@/lib/store";
import {
  Search, IndianRupee, Clock, CheckCircle2,
  Building2, User, BedDouble, CalendarDays,
} from "lucide-react";

export const Route = createFileRoute("/owner-bookings")({
  head: () => ({ meta: [{ title: "Owner Booking Console — Gharpayy" }] }),
  component: () => <AppShell><OwnerBookingsConsole /></AppShell>,
});

const TAB_FILTERS: { id: string; label: string; match: (b: OwnerBooking) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "pending_ack", label: "Pending Ack", match: (b) => ["created", "shared_with_owner", "viewed_by_owner"].includes(b.status) },
  { id: "prepare", label: "Room Prep", match: (b) => b.status === "acknowledged" },
  { id: "ready", label: "Ready", match: (b) => b.status === "room_ready" || b.status === "move_in_approved" },
  { id: "completed", label: "Completed", match: (b) => b.status === "completed" },
  { id: "issues", label: "Issues", match: (b) => b.status === "rejected" || b.status === "cancelled" },
];

function sharingLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return iso; }
}

function OwnerBookingsConsole() {
  const { bookings } = useOwnerBookings();
  const [tab, setTab] = useState("all");
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

  const opsProperties = useApp((s) => s.properties);

  const propertyEntries = useMemo(() => {
    const ids = Object.keys(propertyCounts);
    return ids.map((id) => {
      const resolved = resolvePropertyById(id, opsProperties);
      const count = propertyCounts[id] ?? 0;
      return {
        id,
        name: resolved?.name ?? (id === "__unknown__" ? "Unknown property" : `Unknown (${id})`),
        area: resolved?.area ?? "",
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [propertyCounts, opsProperties]);

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
        if (["created", "shared_with_owner", "viewed_by_owner"].includes(b.status)) acc.pendingAck++;
        if (b.status === "room_ready" || b.status === "move_in_approved") acc.ready++;
        if (b.status === "completed") acc.completed++;
        return acc;
      },
      { expected: 0, received: 0, pendingAck: 0, ready: 0, completed: 0, total: bookings.length },
    );
  }, [bookings]);

  const openBooking = bookings.find((b) => b.id === openId);

  const handlePropertySelect = (id: string | null) => {
    setSelectedPropertyId(id);
    setOpenId(null);
    setQ("");
    setTab("all");
  };

  const selectedCount = selectedPropertyId
    ? (propertyCounts[selectedPropertyId] ?? 0)
    : bookings.length;

  const noPropertySelected = selectedPropertyId === null || propertyIds.length === 0;

  // keep selectedPropertyId in sync when propertyIds changes (reset, new booking, etc.)
  useEffect(() => {
    if (propertyIds.length === 0) {
      setSelectedPropertyId(null);
    } else if (!selectedPropertyId || !propertyIds.includes(selectedPropertyId)) {
      setSelectedPropertyId(propertyIds[0]);
    }
  }, [bookings.length, propertyIds.join(",")]);

  return (
    <div className="flex flex-col overflow-hidden h-[calc(100vh-168px)] md:h-[calc(100vh-104px)]">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Owner Bookings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track bookings from property selection to lead check-in, with owner coordination and readiness tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CreateBookingDialog />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <KPICard
            label="Total Bookings"
            value={stats.total.toString()}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KPICard
            label="Pending Ack"
            value={stats.pendingAck.toString()}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            valueClass="text-amber-600"
          />
          <KPICard
            label="Ready"
            value={stats.ready.toString()}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            valueClass="text-emerald-600"
          />
          <KPICard
            label="Collected"
            value={`₹${(stats.received / 1000).toFixed(1)}K`}
            icon={<IndianRupee className="h-4 w-4" />}
          />
          <KPICard
            label="Pending Dues"
            value={`₹${((stats.expected - stats.received) / 1000).toFixed(1)}K`}
            icon={<IndianRupee className="h-4 w-4 text-amber-500" />}
            valueClass="text-amber-600"
          />
        </div>
      </div>

      {/* 3-Column Workspace */}
      <div className="flex-1 flex min-h-0">
        {/* Column 1: Property Navigation */}
        <div className="w-[200px] shrink-0 border-r border-border bg-muted/5 flex flex-col min-h-0">
          <PropertySidebar
            properties={propertyEntries}
            selectedPropertyId={selectedPropertyId}
            onSelect={handlePropertySelect}
          />
        </div>

        {/* Column 2: Lead List */}
        <div className="w-[460px] shrink-0 border-r border-border flex flex-col min-h-0 bg-background">
          {noPropertySelected ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select a property from the left panel to view its leads.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Leads
                    <span className="text-muted-foreground/60 font-normal text-xs">({selectedCount})</span>
                  </div>
                </div>

                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="h-8 w-full overflow-x-auto flex justify-start">
                    {TAB_FILTERS.map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className="text-xs px-2.5 whitespace-nowrap">{t.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Search leads by name, phone, room…" className="pl-8 h-8 text-xs" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                    <User className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                    {q || tab !== "all"
                      ? "No leads match the current filters."
                      : "No leads for this property yet."}
                  </div>
                )}
                {filtered.map((b) => {
                  const t = computeTotals(b);
                  const isSelected = openId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setOpenId(b.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {b.customer.name}
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums shrink-0">
                            {b.customer.phone}
                          </span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                          isSelected ? "border-primary/30" : ""
                        }`}>{LIFECYCLE_LABEL[b.status]}</Badge>
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
                        <span className={`text-xs font-medium ${
                          t.pending > 0 ? "text-amber-600" : "text-emerald-600"
                        }`}>
                          {t.pending > 0 ? `₹${t.pending.toLocaleString("en-IN")} pending` : "Fully paid"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ₹{b.rent.toLocaleString("en-IN")}/mo
                        </span>
                      </div>
                      {t.totalReadiness > 0 && (
                        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all rounded-full"
                            style={{ width: `${(t.readyCount / t.totalReadiness) * 100}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Column 3: Booking Detail Workspace */}
        <div className="flex-1 flex flex-col min-h-0 bg-background">
          <div className="flex-1 overflow-y-auto">
            {openBooking ? (
              <div className="p-5 max-w-3xl mx-auto">
                <OwnerBookingCard booking={openBooking} mode="sales" />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <User className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {noPropertySelected
                      ? "Select a property from the left panel, then choose a lead to view booking details."
                      : "Select a lead from the list to view their full booking details, quotation history, and actions."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, valueClass }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className={`text-lg font-bold ${valueClass ?? "text-foreground"}`}>{value}</div>
      </div>
    </Card>
  );
}
