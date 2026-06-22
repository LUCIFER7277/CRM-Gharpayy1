import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-store";
import { AdminShell } from "@/admin/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { BookingLifecycle, OwnerBooking } from "@/lib/owner-bookings/types";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { Search, IndianRupee, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/owner-bookings")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Owner Bookings — Admin" }] }),
  component: AdminOwnerBookings,
});

const TAB_FILTERS: { id: string; label: string; match: (b: OwnerBooking) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "pending_ack", label: "Pending Ack", match: (b) => ["created", "shared_with_owner", "viewed_by_owner"].includes(b.status) },
  { id: "prepare", label: "Room Prep", match: (b) => b.status === "acknowledged" },
  { id: "ready", label: "Ready", match: (b) => b.status === "room_ready" || b.status === "move_in_approved" },
  { id: "completed", label: "Completed", match: (b) => b.status === "completed" },
  { id: "issues", label: "Issues", match: (b) => b.status === "rejected" || b.status === "cancelled" },
];

function AdminOwnerBookings() {
  const { bookings } = useOwnerBookings();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(bookings[0]?.id ?? null);

  const filtered = useMemo(() => {
    const f = TAB_FILTERS.find((t) => t.id === tab)!.match;
    const term = q.trim().toLowerCase();
    return bookings.filter((b) =>
      f(b) &&
      (term === "" ||
        b.customer.name.toLowerCase().includes(term) ||
        b.customer.phone.toLowerCase().includes(term) ||
        b.inventory.propertyName.toLowerCase().includes(term) ||
        b.inventory.roomNumber.toLowerCase().includes(term))
    );
  }, [bookings, tab, q]);

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
      { expected: 0, received: 0, pendingAck: 0, ready: 0, completed: 0 },
    );
  }, [bookings]);

  const open = bookings.find((b) => b.id === openId);

  return (
    <AdminShell title="Owner Bookings" sub="Lifecycle-managed bookings with owner approval gates">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label="Total bookings" value={bookings.length.toString()} />
          <Stat label="Pending ack" value={stats.pendingAck.toString()} icon={<Clock className="h-4 w-4 text-amber-500" />} />
          <Stat label="Ready" value={stats.ready.toString()} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
          <Stat label="Collected" value={`₹${stats.received.toLocaleString("en-IN")}`} icon={<IndianRupee className="h-4 w-4" />} />
          <Stat label="Pending dues" value={`₹${(stats.expected - stats.received).toLocaleString("en-IN")}`} tone="warn" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {TAB_FILTERS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative ml-auto">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, room…" className="pl-7 h-8 w-64" />
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-4">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <Card className="p-6 text-center text-xs text-muted-foreground">No bookings here.</Card>
            )}
            {filtered.map((b) => {
              const t = computeTotals(b);
              return (
                <Card key={b.id}
                  onClick={() => setOpenId(b.id)}
                  className={`p-3 cursor-pointer transition border ${
                    openId === b.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{b.customer.name}</span>
                    <Badge variant="outline" className="text-[10px]">{LIFECYCLE_LABEL[b.status]}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {b.inventory.propertyName} · R{b.inventory.roomNumber}/{b.inventory.bedNumber}
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1.5">
                    <span className="text-muted-foreground">
                      Move-in {new Date(b.moveIn.date).toLocaleDateString()}
                    </span>
                    <span className={t.pending > 0 ? "text-amber-600" : "text-emerald-600"}>
                      {t.pending > 0 ? `₹${t.pending.toLocaleString("en-IN")} due` : "Paid"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${(t.readyCount / t.totalReadiness) * 100}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="min-w-0">
            {open ? (
              <OwnerBookingCard booking={open} mode="sales" />
            ) : (
              <Card className="p-10 text-center text-muted-foreground">Select a booking to view details.</Card>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`text-lg font-bold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </Card>
  );
}
