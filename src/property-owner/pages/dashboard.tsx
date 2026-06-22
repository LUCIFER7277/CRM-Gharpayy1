import { useAuthUser } from "@/lib/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api/client";
import { motion } from "framer-motion";
import {
  Building2, Plus, ArrowRight, LogOut, Clock, CheckCircle2, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import { useGetRealOwnerProperties, useGetOwnerStats } from "@/property-owner/lib/api";
import { useOwnerBookingsFromApi } from "@/lib/owner-bookings/api";
import { useOwnerScope } from "@/property-owner/lib/owner-scope";
import { useMemo } from "react";

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthUser((s) => s.user);

  // Backend data — all scoped to this owner by the server (ownerId filter)
  const { data: properties, isLoading: propsLoading } = useGetRealOwnerProperties();
  const { data: apiStats } = useGetOwnerStats();
  const { data: apiBookings } = useOwnerBookingsFromApi();
  const { ownerBookings: localBookings } = useOwnerScope();

  // Owner-scoped property IDs — used to filter local store bookings
  const ownerPropertyIds = useMemo(
    () => new Set((properties ?? []).map((p: any) => String(p.id))),
    [properties],
  );

  // Prefer backend API (server-scoped by ownerId). Fall back to local store
  // filtered by owner's real property IDs to prevent cross-owner data leaks.
  const apiBookingsArr = apiBookings as any[] | undefined;
  const bookings = useMemo(() => {
    if (apiBookingsArr?.length) return apiBookingsArr;
    if (ownerPropertyIds.size > 0) {
      return localBookings.filter((b) => ownerPropertyIds.has(b.inventory.propertyId));
    }
    return localBookings;
  }, [apiBookingsArr, localBookings, ownerPropertyIds]);

  const handleLogout = async () => {
    await api.logout();
    useAuthUser.getState().setUser(null);
    void navigate({ to: "/login", search: { redirect: "/" } });
  };

  const occupancyPct = apiStats?.overall?.occupancyPct ?? 0;
  const occupiedRooms = apiStats?.overall?.occupiedBeds ?? 0;
  const totalRooms = apiStats?.overall?.totalBeds ?? 0;
  const totalProperties = apiStats?.overall?.totalProperties ?? properties?.length ?? 0;

  const bookingStats = {
    total: bookings.length,
    pendingAck: bookings.filter((b) => ["created", "shared_with_owner", "viewed_by_owner"].includes(b.status)).length,
    ready: bookings.filter((b) => b.status === "room_ready" || b.status === "move_in_approved").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    received: bookings.reduce((s, b) => s + computeTotals(b).received, 0),
    expected: bookings.reduce((s, b) => s + computeTotals(b).expected, 0),
  };

  if (propsLoading) {
    return (
      <div className="property-owner-page">
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-display text-slate-900">Owner Dashboard</h1>
            <div className="text-slate-500 text-sm flex items-center gap-2 flex-wrap">
              <span>Welcome, {user?.fullName || user?.name || user?.email || "Owner"}</span>
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Owner</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
              <LogOut className="w-4 h-4" /> Log out
            </button>
            <button onClick={() => navigate({ to: "/property-owner/properties/new" })}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors">
              <Plus className="w-4 h-4" /> Add PG
            </button>
          </div>
        </div>

        {/* Occupancy Banner — matches rent-insight-app source style */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
          <p className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-2">Overall Occupancy</p>
          <div className="flex items-end gap-4">
            <div className="text-6xl font-black">{occupancyPct.toFixed(0)}%</div>
            <div>
              <p className="text-blue-100">{occupiedRooms} of {totalRooms} rooms filled</p>
              <p className="text-blue-200 text-sm">{totalProperties} {totalProperties === 1 ? "property" : "properties"}</p>
            </div>
          </div>
          <div className="mt-4 h-3 bg-blue-500/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyPct}%` }}
              transition={{ type: "spring", stiffness: 40 }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Monthly Revenue", value: `₹${((apiStats?.overall as any)?.monthlyRevenue || 0).toLocaleString()}`, icon: "💰", color: "bg-green-50 border-green-100" },
            { label: "Total Leads", value: (apiStats?.overall as any)?.totalLeadsReceived || 0, icon: "🎯", color: "bg-orange-50 border-orange-100" },
            { label: "Total Bookings", value: (apiStats?.overall as any)?.totalBookings || bookingStats.total || 0, icon: "🔑", color: "bg-purple-50 border-purple-100" },
            { label: "Referral Earnings", value: `₹${((apiStats?.overall as any)?.referralEarnings || 0).toLocaleString()}`, icon: "🎁", color: "bg-yellow-50 border-yellow-100" },
          ].map((item, i) => (
            <motion.div key={item.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`${item.color} border rounded-2xl p-4`}>
              <p className="text-2xl mb-1">{item.icon}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{item.value}</p>
            </motion.div>
          ))}
        </div>

        {/* My Properties — matches rent-insight-app section */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> My Properties
            </h2>
            <button onClick={() => navigate({ to: "/property-owner/properties" })}
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {!properties || properties.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No PGs listed yet</p>
              <button onClick={() => navigate({ to: "/property-owner/properties/new" })}
                className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors">
                + List your first PG
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.slice(0, 4).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <p className="text-sm text-slate-500">{p.address || "—"} · ₹{(p.monthlyRent || 0).toLocaleString()}/mo</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold shrink-0 ml-3 ${p.availability === "AVAILABLE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {p.availability === "AVAILABLE" ? `${p.availableRooms} free` : "FULL"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Recent Bookings
            </h2>
            <button onClick={() => navigate({ to: "/property-owner/bookings" })}
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No bookings yet</p>
              <p className="text-xs text-slate-400 mt-1">Bookings from the sales team will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.slice(0, 5).map((b) => {
                const t = computeTotals(b);
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">{b.customer.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {b.inventory.propertyName || "Property"} · {b.inventory.sharing?.replace(/_/g, " ")} · R{b.inventory.roomNumber || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant="outline" className="text-[10px]">{LIFECYCLE_LABEL[b.status as keyof typeof LIFECYCLE_LABEL]}</Badge>
                      <span className={`text-xs font-medium ${t.pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        ₹{b.rent.toLocaleString("en-IN")}/mo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate({ to: "/property-owner/properties/new" })}
            className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 transition-all text-left">
            <Plus className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Add Property</p>
              <p className="text-xs text-slate-500">List a new PG</p>
            </div>
          </button>
          <button onClick={() => navigate({ to: "/property-owner/approvals" })}
            className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 transition-all text-left">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Pending Approvals</p>
              <p className="text-xs text-slate-500">{bookingStats.pendingAck} need your response</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
