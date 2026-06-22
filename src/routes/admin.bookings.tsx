import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";
import { listOwners } from "@/property-genius/lib/roles";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IndianRupee, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/bookings")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw new Error("Unauthorized");
  },
  component: AdminBookings,
});

type UnifiedBooking = {
  kind: "regular";
  id: string;
  tenantName: string;
  tenantPhone: string;
  propertyId: string;
  propertyName: string;
  tcmId: string;
  rent: number;
  deposit: number;
  status: string;
  ts: string;
} | {
  kind: "owner";
  booking: OwnerBooking;
  totals: ReturnType<typeof computeTotals>;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-500/40 text-amber-400",
  approved: "border-blue-500/40 text-blue-400",
  active: "border-emerald-500/40 text-emerald-400",
  cancelled: "border-muted-foreground/30 text-muted-foreground",
  expired: "border-destructive/40 text-destructive",
  created: "border-amber-500/40 text-amber-400",
  shared_with_owner: "border-blue-500/40 text-blue-400",
  acknowledged: "border-indigo-500/40 text-indigo-400",
  room_ready: "border-teal-500/40 text-teal-400",
  move_in_approved: "border-emerald-500/40 text-emerald-400",
  completed: "border-green-500/40 text-green-400",
  rejected: "border-red-500/40 text-red-400",
};

function AdminBookings() {
  const { bookings, tenants, tcms, properties } = useApp();
  const { bookings: ownerBookings } = useOwnerBookings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailBooking, setDetailBooking] = useState<OwnerBooking | null>(null);

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id;

  const stats = useMemo(() => {
    const totalReg = bookings.length;
    const totalOwn = ownerBookings.length;
    const activeReg = bookings.filter((b) => b.status === "active").length;
    const pendingReg = bookings.filter((b) => b.status === "pending" || b.status === "approved").length;
    const mrr = bookings.filter((b) => b.status === "active").reduce((s, b) => s + b.amount, 0);
    const depositReg = bookings.filter((b) => b.status === "active").reduce((s, b) => s + b.deposit, 0);
    const pendingOwn = ownerBookings.filter((b) =>
      ["created", "shared_with_owner", "viewed_by_owner"].includes(b.status)
    ).length;
    return {
      total: totalReg + totalOwn,
      active: activeReg,
      pending: pendingReg + pendingOwn,
      mrr,
      depositTotal: depositReg,
    };
  }, [bookings, ownerBookings]);

  const filtered = useMemo(() => {
    const result: UnifiedBooking[] = [];

    for (const b of bookings) {
      if (statusFilter !== "all" && b.status !== statusFilter) continue;
      if (search && !b.tenantName.toLowerCase().includes(search.toLowerCase()) && !b.tenantPhone.includes(search)) continue;
      result.push({
        kind: "regular",
        id: b.id,
        tenantName: b.tenantName,
        tenantPhone: b.tenantPhone,
        propertyId: b.propertyId,
        propertyName: propName(b.propertyId),
        tcmId: b.tcmId,
        rent: b.amount,
        deposit: b.deposit,
        status: b.status,
        ts: b.ts,
      });
    }

    for (const b of ownerBookings) {
      if (statusFilter !== "all" && b.status !== statusFilter) continue;
      if (search &&
        !b.customer.name.toLowerCase().includes(search.toLowerCase()) &&
        !b.customer.phone.includes(search)
      ) continue;
      result.push({
        kind: "owner",
        booking: b,
        totals: computeTotals(b),
      });
    }

    result.sort((a, b) => {
      const tsA = a.kind === "regular" ? a.ts : a.booking.createdAt;
      const tsB = b.kind === "regular" ? b.ts : b.booking.createdAt;
      return new Date(tsB).getTime() - new Date(tsA).getTime();
    });

    return result;
  }, [bookings, ownerBookings, statusFilter, search, propName]);

  return (
    <AdminShell title="Bookings" sub="Manage booking lifecycle — from pending to active tenant & owner bookings">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total bookings", value: stats.total, accent: "text-foreground" },
          { label: "Active tenants", value: stats.active, accent: "text-emerald-400" },
          { label: "Pending approval", value: stats.pending, accent: "text-amber-400" },
          { label: "MRR", value: `₹${(stats.mrr / 1000).toFixed(1)}K`, accent: "text-emerald-400" },
          { label: "Total deposit", value: `₹${(stats.depositTotal / 1000).toFixed(1)}K`, accent: "text-blue-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={`text-xl font-display font-semibold ${k.accent}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card mt-3">
        <div className="p-3 border-b border-border flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="h-8 text-xs rounded-md border border-border bg-background px-2.5 w-64 outline-none focus:border-accent"
          />
          {["all", "active", "approved", "pending", "created", "completed", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Customer</th>
                <th className="text-left px-3 py-2 font-medium">Property</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Rent</th>
                <th className="text-right px-3 py-2 font-medium">Deposit</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                if (item.kind === "regular") {
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span className="font-medium">{item.tenantName}</span>
                        <div className="text-muted-foreground">{item.tenantPhone}</div>
                      </td>
                      <td className="px-3 py-2">{item.propertyName}</td>
                      <td className="px-3 py-2 text-muted-foreground">Tenant</td>
                      <td className="px-3 py-2 text-right font-mono">₹{item.rent.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right font-mono">₹{item.deposit.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${STATUS_STYLES[item.status] || ""}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {new Date(item.ts).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  );
                }
                const b = item.booking;
                const t = item.totals;
                return (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                    onClick={() => setDetailBooking(b)}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{b.customer.name}</span>
                      <div className="text-muted-foreground">{b.customer.phone}</div>
                    </td>
                    <td className="px-3 py-2">{b.inventory.propertyName}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Owner</span>
                        {b.createdBy && (
                          <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap truncate max-w-[120px]">
                            by {b.createdBy}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">₹{b.rent.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{b.deposit.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${STATUS_STYLES[b.status] || ""}`}>
                        {LIFECYCLE_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No bookings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detailBooking} onOpenChange={(o) => { if (!o) setDetailBooking(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Owner Booking · {detailBooking?.customer.name}
            </DialogTitle>
          </DialogHeader>
          {detailBooking && <OwnerBookingCard booking={detailBooking} mode="sales" />}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
