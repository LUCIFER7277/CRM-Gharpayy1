import { useState, useEffect, useCallback } from "react";
import { useAuthUser } from "@/lib/auth-store";
import { tokenStore } from "@/lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Building2, User, Phone, CheckCircle2,
  RefreshCw, Video, Home, MessageSquare, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:            { label: "Scheduled",           color: "bg-blue-100 text-blue-700 border-blue-200" },
  confirmed:            { label: "Confirmed",            color: "bg-green-100 text-green-700 border-green-200" },
  owner_confirmed:      { label: "You Confirmed ✓",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  reschedule_requested: { label: "Reschedule Requested", color: "bg-amber-100 text-amber-700 border-amber-200" },
  completed:            { label: "Completed",            color: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled:            { label: "Cancelled",            color: "bg-red-100 text-red-600 border-red-200" },
};

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const BASE = () => (import.meta.env.VITE_API_URL as string ?? "").replace(/\/$/, "");

export default function OwnerVisitsPage() {
  const user = useAuthUser((s) => s.user);
  const isOwnerAuthenticated = !!user && user.role === "owner";

  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondForm, setRespondForm] = useState<{ message: string; proposedAt: string }>({
    message: "", proposedAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [toast, setToast] = useState<{ title: string; variant?: string } | null>(null);

  const showToast = (title: string, variant?: string) => {
    setToast({ title, variant });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchVisits = useCallback(async () => {
    const token = tokenStore.get();
    if (!isOwnerAuthenticated || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE()}/api/v1/owner/visits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setVisits(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [isOwnerAuthenticated]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleRespond = async (visitId: string, response: "confirmed" | "reschedule_requested") => {
    const token = tokenStore.get();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE()}/api/v1/owner/visits/${encodeURIComponent(visitId)}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          response,
          message: respondForm.message || undefined,
          proposedAt: respondForm.proposedAt || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setVisits(prev => prev.map(v =>
          (v.id || v._id) === visitId ? { ...v, ...json.data } : v
        ));
        setRespondingId(null);
        setRespondForm({ message: "", proposedAt: "" });
        showToast(
          response === "confirmed" ? "✅ Visit Confirmed!" : "🔄 Reschedule Requested",
        );
      } else {
        showToast("Failed to respond", "destructive");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const upcoming = visits.filter(v => new Date(v.scheduledAt) >= now && !["cancelled", "completed"].includes(v.status));
  const past = visits.filter(v => new Date(v.scheduledAt) < now || ["cancelled", "completed"].includes(v.status));
  const displayed = tab === "upcoming" ? upcoming : past;

  const canRespond = (v: any) =>
    ["scheduled", "confirmed"].includes(v.status?.toLowerCase()) &&
    new Date(v.scheduledAt) >= now;

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        {/* Toast */}
        {toast && (
          <div className={cn(
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold transition-all",
            toast.variant === "destructive" ? "bg-red-500 text-white" : "bg-slate-900 text-white"
          )}>
            {toast.title}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-display text-slate-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" /> Visits
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Property visits scheduled by admin — confirm or reschedule
            </p>
          </div>
          <button onClick={fetchVisits}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(["upcoming", "past"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg capitalize transition-all",
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}>
              {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">
              {tab === "upcoming" ? "No upcoming visits" : "No past visits"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {tab === "upcoming"
                ? "Admin will schedule visits to your property — they'll appear here"
                : "Completed and cancelled visits will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayed.map((visit, i) => {
                const statusKey = visit.status?.toLowerCase();
                const status = STATUS_CONFIG[statusKey] || { label: visit.status, color: "bg-slate-100 text-slate-600 border-slate-200" };
                const isResponding = respondingId === (visit.id || visit._id);
                const visitId = visit.id || visit._id;

                return (
                  <motion.div key={visitId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "bg-white rounded-2xl border overflow-hidden shadow-sm",
                      canRespond(visit) && visit.status === "scheduled" ? "border-orange-200" : "border-slate-100"
                    )}>

                    {visit.scheduledBy === "admin" && (
                      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <p className="text-xs font-bold text-blue-600">Scheduled by Admin · Your response needed</p>
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                            {visit.type === "virtual" ? <Video className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 leading-tight">
                              {visit.property?.name || "Your Property"}
                            </p>
                            {visit.property?.area && (
                              <p className="text-xs text-slate-500 mt-0.5">{visit.property.area}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                            visit.type === "virtual" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-green-100 text-green-700 border-green-200"
                          )}>
                            {visit.type === "virtual" ? "🖥 Virtual" : "🏠 Physical"}
                          </span>
                          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", status.color)}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Room info */}
                      {visit.room && (
                        <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-3 text-sm">
                          <Home className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700 capitalize">
                            {visit.room.type} Room · {visit.room.bedsTotal} bed{visit.room.bedsTotal > 1 ? "s" : ""}
                            {visit.room.currentPrice ? ` · ₹${visit.room.currentPrice.toLocaleString("en-IN")}/mo` : ""}
                          </span>
                        </div>
                      )}

                      {/* Prospect info */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{visit.customerName || "—"}</span>
                        </div>
                        {visit.customerPhone && (
                          <a href={`tel:${visit.customerPhone}`}
                            className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                            <Phone className="w-4 h-4" />
                            {visit.customerPhone}
                          </a>
                        )}
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium">{formatDate(visit.scheduledAt)}</span>
                      </div>

                      {/* Notes from admin */}
                      {visit.notes && (
                        <div className="flex items-start gap-2 text-sm text-slate-500 italic bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          <MessageSquare className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <span>{visit.notes}</span>
                        </div>
                      )}

                      {/* Owner's previous response */}
                      {visit.ownerMessage && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-700">
                          <span className="font-bold">Your message to admin: </span>{visit.ownerMessage}
                          {visit.proposedAt && (
                            <p className="text-xs mt-1 text-emerald-600">
                              Proposed time: {formatDate(visit.proposedAt)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {canRespond(visit) && (
                        <div className="pt-1">
                          {!isResponding ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleRespond(visitId, "confirmed")} disabled={submitting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                                <CheckCircle2 className="w-4 h-4" />
                                I'm Available
                              </button>
                              <button onClick={() => setRespondingId(visitId)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-sm font-bold transition-colors">
                                <RefreshCw className="w-4 h-4" />
                                Request Reschedule
                              </button>
                            </div>
                          ) : (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                              className="space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                              <p className="text-sm font-bold text-slate-700">Request Reschedule</p>
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                                  Message to Admin (optional)
                                </label>
                                <textarea
                                  value={respondForm.message}
                                  onChange={e => setRespondForm(f => ({ ...f, message: e.target.value }))}
                                  placeholder="e.g. I'm not available on Friday, please schedule after 5 PM..."
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                                  Suggest New Date & Time (optional)
                                </label>
                                <input type="datetime-local"
                                  value={respondForm.proposedAt}
                                  min={new Date().toISOString().slice(0, 16)}
                                  onChange={e => setRespondForm(f => ({ ...f, proposedAt: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleRespond(visitId, "reschedule_requested")} disabled={submitting}
                                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                                  {submitting ? "Sending…" : "Send Request"}
                                </button>
                                <button onClick={() => { setRespondingId(null); setRespondForm({ message: "", proposedAt: "" }); }}
                                  className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 font-medium">
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* Scheduled-by info */}
                      <p className="text-xs text-slate-400">
                        {visit.scheduledBy === "admin" ? "Set by Admin" : "Self-scheduled"} · {timeAgo(visit.createdAt)}
                      </p>
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
