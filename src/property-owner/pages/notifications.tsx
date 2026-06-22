import { useAuthUser } from "@/lib/auth-store";
import { tokenStore } from "@/lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, CheckCheck, Home, Video, TrendingUp,
  Package, AlertTriangle, Flame, DollarSign, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  visit:     { icon: Home,          color: "bg-blue-100 text-blue-600",     label: "Visits" },
  pricing:   { icon: TrendingUp,    color: "bg-amber-100 text-amber-600",   label: "Pricing" },
  stats:     { icon: AlertTriangle, color: "bg-orange-100 text-orange-600", label: "Occupancy" },
  inventory: { icon: Package,       color: "bg-purple-100 text-purple-600", label: "Inventory" },
  revenue:   { icon: DollarSign,    color: "bg-red-100 text-red-600",       label: "Revenue" },
  streak:    { icon: Flame,         color: "bg-orange-100 text-orange-500", label: "Streak" },
  default:   { icon: Bell,          color: "bg-slate-100 text-slate-500",   label: "General" },
};

const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-slate-100 text-slate-500 border-slate-200",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const BASE = () => (import.meta.env.VITE_API_URL as string ?? "").replace(/\/$/, "");

export default function OwnerNotificationsPage() {
  const user = useAuthUser((s) => s.user);
  const isOwnerAuthenticated = !!user && user.role === "owner";

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchNotifications = useCallback(async () => {
    const token = tokenStore.get();
    if (!isOwnerAuthenticated || !token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/v1/owner/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      } else {
        setNotifications([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isOwnerAuthenticated, refreshKey]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const categories = ["all", ...Array.from(new Set(notifications.map(n => n.category || "default")))];

  const filtered = filter === "all" ? notifications : notifications.filter(n => (n.category || "default") === filter);

  const handleMarkAll = async () => {
    const token = tokenStore.get();
    if (token) {
      await fetch(`${BASE()}/api/v1/owner/notifications/mark-all-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast("All notifications marked as read");
  };

  const handleMarkOne = async (id: string) => {
    const token = tokenStore.get();
    if (token) {
      await fetch(`${BASE()}/api/v1/owner/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold bg-slate-900 text-white">
            {toastMsg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-display text-slate-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" /> Notifications
              {unreadCount > 0 && (
                <span className="ml-1 text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-orange-600 font-medium mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-primary font-medium transition-colors rounded-lg hover:bg-slate-50">
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(categories as string[]).map(cat => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.default;
            return (
              <button key={cat} onClick={() => setFilter(cat)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all border",
                  filter === cat
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                )}>
                {cat === "all" ? "All" : cfg.label}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BellOff className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No notifications</p>
            <p className="text-slate-400 text-sm mt-1">
              {filter !== "all" ? `No ${filter} notifications yet` : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((n, i) => {
                const cat = n.category || "default";
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.default;
                const Icon = n.type === "VISIT_SCHEDULED" && n.tourType === "virtual" ? Video : cfg.icon;
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => !n.isRead && handleMarkOne(n.id)}
                    className={cn(
                      "flex gap-4 p-4 rounded-2xl border transition-all cursor-pointer group",
                      n.isRead
                        ? "bg-white border-slate-100 opacity-70 hover:opacity-100"
                        : "bg-white border-orange-100 shadow-sm hover:shadow-md hover:border-orange-200"
                    )}>
                    {/* Icon */}
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg", cfg.color)}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-sm leading-snug">{n.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {n.priority && n.priority !== "low" && (
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", PRIORITY_BADGE[n.priority])}>
                              {n.priority.toUpperCase()}
                            </span>
                          )}
                          {!n.isRead && (
                            <div className="w-2.5 h-2.5 bg-primary rounded-full shrink-0" />
                          )}
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm leading-snug mt-0.5">{n.message}</p>

                      {/* Extra data chips */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {n.type === "VISIT_SCHEDULED" && (
                          <span className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full",
                            n.tourType === "virtual" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
                          )}>
                            {n.tourType === "virtual" ? "🖥 Virtual Tour" : "🏠 Physical Tour"}
                          </span>
                        )}
                        {n.occupancyPct !== undefined && (
                          <span className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full",
                            n.occupancyPct < 60 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          )}>
                            {n.occupancyPct}% occupied
                          </span>
                        )}
                        {n.revenueAtRisk !== undefined && n.revenueAtRisk > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            ₹{n.revenueAtRisk.toLocaleString("en-IN")} at risk
                          </span>
                        )}
                        {n.sellableCount !== undefined && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {n.sellableCount} sellable rooms
                          </span>
                        )}
                        {n.lockedCount !== undefined && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {n.lockedCount} locked
                          </span>
                        )}
                        {n.propertyName && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {n.propertyName}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-400 text-xs mt-2">{timeAgo(n.createdAt)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
