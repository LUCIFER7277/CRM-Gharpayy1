import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { PropertySidebar } from "@/components/owner-bookings/PropertySidebar";
import { useOwnerScope } from "@/property-owner/lib/owner-scope";
import { useOwnerBookingsFromApi } from "@/lib/owner-bookings/api";
import { useGetRealOwnerProperties } from "@/property-owner/lib/api";
import { Clock, ClipboardCheck, CheckCircle2, User, BedDouble, CalendarDays, Ban } from "lucide-react";

export const Route = createFileRoute("/property-owner/approvals")({
  head: () => ({ meta: [{ title: "Pending Approvals — Gharpayy" }] }),
  component: () => <OwnerApprovalsConsole />,
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return iso; }
}

function sharingLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TAB_FILTERS = [
  { id: "pending", label: "Pending", match: (b: OwnerBooking) => ["shared_with_owner", "viewed_by_owner"].includes(b.status) && !b.ownerDecision },
  { id: "approved", label: "Approved", match: (b: OwnerBooking) => b.ownerDecision === "approve" || b.ownerDecision === "approve_with_conditions" },
  { id: "rejected", label: "Rejected", match: (b: OwnerBooking) => b.ownerDecision === "reject" },
  { id: "all", label: "All Requests", match: (b: OwnerBooking) => ["shared_with_owner", "viewed_by_owner"].includes(b.status) || !!b.ownerDecision },
];

function OwnerApprovalsConsole() {
  const { ownerBookings: localBookings } = useOwnerScope();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState("pending");

  const { data: apiBookings } = useOwnerBookingsFromApi();
  const { data: ownerProperties } = useGetRealOwnerProperties();

  const ownerPropertyIds = useMemo(
    () => new Set((ownerProperties ?? []).map((p: any) => String(p.id))),
    [ownerProperties],
  );

  const allRelevantBookings: OwnerBooking[] = useMemo(() => {
    const base = apiBookings?.length ? apiBookings : (ownerPropertyIds.size > 0 ? localBookings.filter((b) => ownerPropertyIds.has(b.inventory.propertyId)) : localBookings);
    return base.filter((b: OwnerBooking) => 
      // Only include bookings that have actually been shared with the owner
      (b.status !== "created") && (
        ["shared_with_owner", "viewed_by_owner"].includes(b.status) || !!b.ownerDecision
      )
    ) as OwnerBooking[];
  }, [apiBookings, localBookings, ownerPropertyIds]);

  const propertyEntries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allRelevantBookings) {
      if (b.status === "shared_with_owner" || b.status === "viewed_by_owner") {
        const pid = b.inventory.propertyId || "__unknown__";
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }
    const propMap = new Map((ownerProperties ?? []).map((p: any) => [String(p.id), p]));
    return Object.entries(counts).map(([id, count]) => {
      const prop = propMap.get(id) as any;
      return {
        id,
        name: prop?.name ?? (id === "__unknown__" ? "Unknown property" : `Property (${id})`),
        area: prop?.address ?? prop?.area ?? "",
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [allRelevantBookings, ownerProperties]);

  const propertyIds = useMemo(() => propertyEntries.map((p) => p.id), [propertyEntries]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(propertyIds.length > 0 ? propertyIds[0] : null);

  const filtered = useMemo(() => {
    const matcher = TAB_FILTERS.find((t) => t.id === tab)!.match;
    return allRelevantBookings.filter((b) =>
      matcher(b) && (selectedPropertyId === null || (b.inventory.propertyId || "__unknown__") === selectedPropertyId)
    );
  }, [allRelevantBookings, selectedPropertyId, tab]);

  const stats = useMemo(() => {
    return allRelevantBookings.reduce((acc, b) => {
      if (["shared_with_owner", "viewed_by_owner"].includes(b.status) && !b.ownerDecision) acc.pending++;
      if (b.ownerDecision === "approve" || b.ownerDecision === "approve_with_conditions") acc.approved++;
      if (b.ownerDecision === "reject") acc.rejected++;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0 });
  }, [allRelevantBookings]);

  const openBooking = allRelevantBookings.find((b) => b.id === openId);
  const handlePropertySelect = (id: string | null) => { setSelectedPropertyId(id); setOpenId(null); };
  const noPropertySelected = selectedPropertyId === null || propertyIds.length === 0;

  useEffect(() => {
    if (propertyIds.length === 0) setSelectedPropertyId(null);
    else if (!selectedPropertyId || !propertyIds.includes(selectedPropertyId)) setSelectedPropertyId(propertyIds[0]);
  }, [allRelevantBookings.length, propertyIds.join(",")]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border bg-background px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Approvals Inbox</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and decide on new booking requests shared by the sales team.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-3xl">
          <Card className="px-4 py-3 flex items-center gap-3 bg-amber-500/5 border-amber-500/20">
            <div className="shrink-0"><Clock className="h-5 w-5 text-amber-500" /></div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-amber-600/80 uppercase tracking-wider truncate">Pending Review</div>
              <div className="text-2xl font-black text-amber-600 mt-0.5">{stats.pending}</div>
            </div>
          </Card>
          <Card className="px-4 py-3 flex items-center gap-3 bg-emerald-500/5 border-emerald-500/20">
            <div className="shrink-0"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-emerald-600/80 uppercase tracking-wider truncate">Recently Approved</div>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">{stats.approved}</div>
            </div>
          </Card>
          <Card className="px-4 py-3 flex items-center gap-3 bg-rose-500/5 border-rose-500/20">
            <div className="shrink-0"><Ban className="h-5 w-5 text-rose-500" /></div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-rose-600/80 uppercase tracking-wider truncate">Rejected / Changes</div>
              <div className="text-2xl font-black text-rose-600 mt-0.5">{stats.rejected}</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[200px] shrink-0 border-r border-border bg-muted/5 flex flex-col min-h-0">
          <PropertySidebar properties={propertyEntries} selectedPropertyId={selectedPropertyId} onSelect={handlePropertySelect} />
        </div>

        <div className="w-[460px] shrink-0 border-r border-border flex flex-col min-h-0 bg-background">
          {noPropertySelected ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500/50" />
                <p className="text-sm text-emerald-600/70">All caught up! No pending approvals.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-border/40">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="h-8 w-full flex justify-start overflow-x-auto">
                    {TAB_FILTERS.map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className="text-xs px-3">{t.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {filtered.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No requests found for this filter.
                  </div>
                )}
                {filtered.map((b) => {
                  const isSelected = openId === b.id;
                  const isPending = !b.ownerDecision;
                  const isRejected = b.ownerDecision === "reject";
                  return (
                    <button key={b.id} type="button" onClick={() => setOpenId(b.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${isSelected ? (isPending ? "bg-amber-500/10 ring-1 ring-amber-500/30" : isRejected ? "bg-rose-500/10 ring-1 ring-rose-500/30" : "bg-emerald-500/10 ring-1 ring-emerald-500/30") : "hover:bg-muted/30"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium truncate ${isSelected ? (isPending ? "text-amber-700" : isRejected ? "text-rose-700" : "text-emerald-700") : "text-foreground"}`}>{b.customer.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${isSelected ? "border-current opacity-70" : ""}`}>
                          {isPending ? "Action needed" : b.ownerDecision === "reject" ? "Rejected" : "Approved"}
                        </Badge>
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
                <OwnerBookingCard booking={openBooking} mode="owner" submode="approval" />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ClipboardCheck className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select a request from the list to view the full details and provide your decision.
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
