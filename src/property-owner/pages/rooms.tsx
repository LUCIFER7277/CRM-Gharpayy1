import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, Trash2, Share2, Lock, BedDouble, CalendarDays,
  ShieldCheck, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2,
  Eye, Phone, MessageSquare, Video, MapPin, Sparkles, Activity,
  Flame, Clock, IndianRupee, Users, Zap, X, ChevronDown
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthUser } from "@/lib/auth-store";
import { 
  useGetRealOwnerProperties,
  useGetRealOwnerRooms,
  useAddRealOwnerRoom,
  useDeleteRealOwnerRoom,
  useUpdateRealOwnerRoomStatus,
  useVerifyRealOwnerRoom,
  useGetOwnerVisits,
  useUpdateOwnerVisitStatus,
  useGetOwnerActions,
  useAddOwnerAction
} from "@/property-owner/lib/api";

/* ─────────────── Types & constants ─────────────── */

type RoomStatus = "vacant" | "vacating" | "occupied" | "blocked";
type ActionType = "pitch" | "virtual_tour" | "visit_scheduled" | "visit_done" | "prebooked" | "confirm" | "rent_changed";
type VisitStatus = "scheduled" | "done" | "no_show" | "cancelled";

type Room = {
  id: string;
  roomNumber: string;
  beds: number;
  status: RoomStatus;
  vacantDate?: string;
  actualRent: number;          // last achieved rent
  expectedRent: number;        // owner ask
  floorRent?: number;          // owner private floor
  lastConfirmedAt?: string;
  vacantSinceDays?: number;    // computed-ish for risk
  softLockUntil?: string;      // when a visit/prebook locks the room
  demandScore?: number;        // 0-100 (mock)
};

type Visit = {
  id: string;
  roomId: string;
  customerName: string;
  customerPhone?: string;
  scheduledAt: string;
  type: "physical" | "virtual";
  status: VisitStatus;
  notes?: string;
};

type Action = {
  id: string;
  roomId: string;
  type: ActionType;
  at: string;
  by: string;
  note?: string;
};

const STATUS_META: Record<RoomStatus, { label: string; cls: string; dot: string }> = {
  vacant:   { label: "Vacant now",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  vacating: { label: "Vacating",     cls: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  occupied: { label: "Occupied",     cls: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400" },
  blocked:  { label: "Blocked",      cls: "bg-rose-100 text-rose-600 border-rose-200",          dot: "bg-rose-500" },
};

const ACTION_META: Record<ActionType, { label: string; icon: any; cls: string }> = {
  pitch:           { label: "Pitched to lead",  icon: MessageSquare, cls: "text-sky-600 bg-sky-50" },
  virtual_tour:    { label: "Virtual tour",     icon: Video,         cls: "text-violet-600 bg-violet-50" },
  visit_scheduled: { label: "Visit scheduled",  icon: CalendarDays,  cls: "text-amber-600 bg-amber-50" },
  visit_done:      { label: "Visit completed",  icon: CheckCircle2,  cls: "text-emerald-600 bg-emerald-50" },
  prebooked:       { label: "Pre-booked",       icon: ShieldCheck,   cls: "text-primary bg-primary/10" },
  confirm:         { label: "Owner confirmed",  icon: CheckCircle2,  cls: "text-slate-600 bg-slate-50" },
  rent_changed:    { label: "Rent updated",     icon: IndianRupee,   cls: "text-orange-600 bg-orange-50" },
};

/* ─────────────── Storage helpers ─────────────── */

const K = {
  rooms:  (pid: string) => `gp_rooms_${pid}`,
  visits: (pid: string) => `gp_visits_${pid}`,
  acts:   (pid: string) => `gp_actions_${pid}`,
};

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

function hoursSince(iso?: string) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}
function isStale(room: Room) { return hoursSince(room.lastConfirmedAt) > 24; }
function isSoftLocked(room: Room) {
  return room.softLockUntil ? new Date(room.softLockUntil).getTime() > Date.now() : false;
}
function fmtINR(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
function timeAgo(iso: string) {
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ─────────────── Page ─────────────── */

export default function OwnerRoomsPage() {
  const { id } = useParams({ from: "/property-owner/properties/$id/rooms" });
  const pid = String(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  // No seed store needed — owner identity comes from common auth
  const user = useAuthUser((s) => s.user);

  const { data: realProperties, isLoading: isRealPropsLoading } = useGetRealOwnerProperties();
  const { data: realRoomsData, isLoading: isRoomsLoading } = useGetRealOwnerRooms();
  const { data: realVisits } = useGetOwnerVisits();
  const { data: realActions } = useGetOwnerActions();

  const addRoomMut = useAddRealOwnerRoom();
  const deleteRoomMut = useDeleteRealOwnerRoom();
  const updateStatusMut = useUpdateRealOwnerRoomStatus();
  const verifyMut = useVerifyRealOwnerRoom();
  const updateVisitStatusMut = useUpdateOwnerVisitStatus();
  const addActionMut = useAddOwnerAction();

  const property = useMemo(() => {
    if (!realProperties) return null;
    return realProperties.find((p: any) => String(p.id) === pid) || null;
  }, [realProperties, pid]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [tab, setTab] = useState<"inventory" | "visits" | "ledger" | "pricing">("inventory");
  const [draft, setDraft] = useState<Partial<Room>>({ status: "vacant", beds: 1, actualRent: 0, expectedRent: 0, roomNumber: "" });
  const [showAdd, setShowAdd] = useState(false);

  /* hydrate */
  useEffect(() => {
    if (!pid) return;

    let propRoomIds = new Set<string>();

    if (realRoomsData) {
      const { rooms: br, roomStatuses: bs } = realRoomsData;
      const propRooms = br.filter((x: any) => String(x.propertyId) === pid);
      if (propRooms.length > 0) {
        const mapped: Room[] = propRooms.map((x: any) => {
          const s = bs.find((stat: any) => stat.roomId === (x.customId || x._id)) || {};
          return {
            id: x.customId || x._id,
            roomNumber: x.type,
            beds: x.bedsTotal || 1,
            status: s.kind || "vacant",
            actualRent: s.actualRent || x.currentPrice || 0,
            expectedRent: s.expectedRent || x.currentPrice || 0,
            floorRent: s.floorPrice,
            lastConfirmedAt: s.updatedAt || new Date().toISOString(),
            demandScore: s.demandScore,
          } as Room;
        });
        setRooms(mapped);
        propRoomIds = new Set(mapped.map(r => r.id));
      } else {
        setRooms([]);
      }
    } else {
      setRooms([]);
    }

    if (realVisits) {
      setVisits(realVisits.filter((v: any) => propRoomIds.has(v.roomId)));
    } else {
      setVisits(load<Visit[]>(K.visits(pid), []));
    }

    if (realActions) {
      setActions(realActions.filter((a: any) => propRoomIds.has(a.roomId)));
    } else {
      setActions(load<Action[]>(K.acts(pid), []));
    }
  }, [pid, realRoomsData, realVisits, realActions]);

  /* persist */
  useEffect(() => { if (pid) save(K.visits(pid), visits); }, [pid, visits]);
  useEffect(() => { if (pid) save(K.acts(pid), actions); }, [pid, actions]);

  /* ── derived KPIs ── */
  const kpis = useMemo(() => {
    const sellable = rooms.filter((r) => (r.status === "vacant" || r.status === "vacating") && !isStale(r)).length;
    const locked = rooms.filter(isStale).length;
    const occupiedBeds = rooms.filter((r) => r.status === "occupied").reduce((s, r) => s + r.beds, 0);
    const totalBeds = rooms.reduce((s, r) => s + r.beds, 0) || 1;
    const occupancy = Math.round((occupiedBeds / totalBeds) * 100);
    const revenueAtRisk = rooms
      .filter((r) => r.status === "vacant" || r.status === "vacating")
      .reduce((s, r) => s + (r.expectedRent || 0), 0);
    const visitsThisWeek = visits.filter((v) => hoursSince(v.scheduledAt) > -24 * 7 && hoursSince(v.scheduledAt) < 24 * 7).length;
    const compliance = Math.round(((rooms.length - locked) / Math.max(rooms.length, 1)) * 100);
    return { sellable, locked, occupancy, revenueAtRisk, visitsThisWeek, compliance };
  }, [rooms, visits]);

  /* ── mutations ── */
  const logAction = async (roomId: string, type: ActionType, note?: string) => {
    try {
      await addActionMut.mutateAsync({ roomId, type, note, by: "Owner" });
    } catch (_err) {
      // If backend not yet available, fall back to local log
      setActions((a) => [{ id: crypto.randomUUID(), roomId, type, at: new Date().toISOString(), by: "Owner", note }, ...a].slice(0, 200));
    }
  };

  const addRoom = async () => {
    if (!draft.roomNumber) { toast({ title: "Room number required", variant: "destructive" }); return; }

    try {
      await addRoomMut.mutateAsync({
        propertyId: pid,
        type: draft.roomNumber,
        bedsTotal: Number(draft.beds || 1),
        price: Number(draft.expectedRent || draft.actualRent || 0),
        floorPrice: draft.floorRent ? Number(draft.floorRent) : undefined,
        actualRent: draft.actualRent ? Number(draft.actualRent) : undefined,
        expectedRent: draft.expectedRent ? Number(draft.expectedRent) : undefined,
        lowestAcceptableRent: draft.floorRent ? Number(draft.floorRent) : undefined,
      });
      toast({ title: "Room added" });
      setDraft({ status: "vacant", beds: 1, actualRent: 0, expectedRent: 0, roomNumber: "" });
      setShowAdd(false);
    } catch (err: any) {
      // Backend not yet available — add locally so UI is still usable
      const newRoom: Room = {
        id: crypto.randomUUID(),
        roomNumber: String(draft.roomNumber),
        beds: Number(draft.beds || 1),
        status: (draft.status as RoomStatus) || "vacant",
        vacantDate: draft.vacantDate,
        actualRent: Number(draft.actualRent || 0),
        expectedRent: Number(draft.expectedRent || draft.actualRent || 0),
        floorRent: draft.floorRent ? Number(draft.floorRent) : undefined,
        lastConfirmedAt: new Date().toISOString(),
        demandScore: 40 + Math.floor(Math.random() * 50),
      };
      setRooms((r) => [newRoom, ...r]);
      logAction(newRoom.id, "confirm", "Room added (local)");
      setDraft({ status: "vacant", beds: 1, actualRent: 0, expectedRent: 0, roomNumber: "" });
      setShowAdd(false);
      toast({ title: "Room added (offline mode)", description: "Will sync when backend is available" });
    }
  };

  const update = (rid: string, patch: Partial<Room>) => {
    setRooms((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  };

  const confirmRoom = async (rid: string) => {
    try {
      await verifyMut.mutateAsync(rid);
      toast({ title: "Room confirmed" });
    } catch (_err) {
      update(rid, { lastConfirmedAt: new Date().toISOString() });
      logAction(rid, "confirm");
    }
  };

  const confirmAll = () => {
    const now = new Date().toISOString();
    setRooms((rs) => rs.map((r) => ({ ...r, lastConfirmedAt: now })));
    rooms.forEach((r) => isStale(r) && logAction(r.id, "confirm", "Bulk confirm"));
    toast({ title: "All rooms confirmed for 24h", description: "Inventory is now open for the Gharpayy team." });
  };

  const setStatus = async (rid: string, s: RoomStatus) => {
    try {
      await updateStatusMut.mutateAsync({ roomId: rid, data: { kind: s } });
      toast({ title: "Status updated" });
    } catch (_err) {
      update(rid, { status: s, lastConfirmedAt: new Date().toISOString() });
      logAction(rid, "confirm", `Status → ${STATUS_META[s].label}`);
    }
  };

  const remove = async (rid: string) => {
    try {
      await deleteRoomMut.mutateAsync(rid);
      toast({ title: "Room deleted" });
    } catch (_err) {
      setRooms((rs) => rs.filter((r) => r.id !== rid));
      setVisits((vs) => vs.filter((v) => v.roomId !== rid));
    }
  };

  /* ── share / refer (by room) ── */
  const shareRoom = (room: Room) => {
    if (isStale(room)) { toast({ title: "Confirm room first", description: "Stale rooms can't be referred.", variant: "destructive" }); return; }
    const pname = property?.name || "the PG";
    const area = property?.area || "";
    const text = `Hi! Room *${room.roomNumber}* at *${pname}*${area ? ` (${area})` : ""} — ${room.beds} bed, ${STATUS_META[room.status].label}${room.vacantDate ? ` from ${room.vacantDate}` : ""}. Rent ${fmtINR(room.expectedRent)}/mo. Interested? I can schedule a visit.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    logAction(room.id, "pitch", "WhatsApp share");
    update(room.id, { softLockUntil: new Date(Date.now() + 6 * 36e5).toISOString() }); // 6h soft lock
  };

  const markVisit = async (id: string, status: VisitStatus) => {
    try {
      await updateVisitStatusMut.mutateAsync({ visitId: id, status });
      const v = visits.find((x) => x.id === id);
      if (v && status === "done") logAction(v.roomId, "visit_done", v.customerName);
    } catch (_err) {
      setVisits((vs) => vs.map((v) => (v.id === id ? { ...v, status } : v)));
      const v = visits.find((x) => x.id === id);
      if (v && status === "done") logAction(v.roomId, "visit_done", v.customerName);
    }
  };

  const onOpenDetails = (roomId: string) => {
    navigate({ to: `/property-owner/properties/${pid}/rooms/${roomId}` });
  };

  const onUpdateDetails = (roomId: string, data: any) => {
    // Ideally this hits an API endpoint. For now, local update:
    update(roomId, data);
  };

  /* ── render ── */

  if (isRealPropsLoading || isRoomsLoading) {
    return (
      <div className="property-owner-page">
        <div className="p-6 max-w-2xl mx-auto flex justify-center items-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="property-owner-page">
        <div className="p-6 max-w-2xl mx-auto">
          <button onClick={() => navigate({ to: "/property-owner/properties" })} className="flex items-center gap-2 text-slate-500 text-sm mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <p className="text-slate-500">Property not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <button onClick={() => navigate({ to: "/property-owner/properties" })} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium mb-2">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Properties
            </button>
            <h1 className="text-2xl md:text-3xl font-black font-display text-slate-900 flex items-center gap-2">
              <BedDouble className="w-7 h-7 text-primary" /> {property.name}
            </h1>
            <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {property.area} · Inventory OS
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Add room
          </Button>
        </div>

        {/* Daily ritual banner */}
        <DailyRitual locked={kpis.locked} total={rooms.length} compliance={kpis.compliance} onConfirmAll={confirmAll} />

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <Kpi label="Occupancy" value={`${kpis.occupancy}%`} icon={Users} tone="slate" />
          <Kpi label="Sellable now" value={kpis.sellable} icon={Zap} tone="emerald" />
          <Kpi label="Auto-locked" value={kpis.locked} icon={Lock} tone="rose" />
          <Kpi label="Revenue at risk" value={fmtINR(kpis.revenueAtRisk)} icon={TrendingDown} tone="amber" small />
          <Kpi label="Visits this wk" value={kpis.visitsThisWeek} icon={CalendarDays} tone="violet" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {(["inventory", "visits", "ledger", "pricing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-bold capitalize border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {t === "ledger" ? "Effort Ledger" : t === "inventory" ? "Rooms" : t === "visits" ? "Visits" : t === "pricing" ? "Pricing" : t}
            </button>
          ))}
        </div>

        {/* Add room sheet */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Add a room</h2>
                <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 text-sm">Cancel</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Room number *"><Input placeholder="201" value={draft.roomNumber || ""} onChange={(e) => setDraft({ ...draft, roomNumber: e.target.value })} /></Field>
                <Field label="Beds"><Input type="number" min={1} value={draft.beds || 1} onChange={(e) => setDraft({ ...draft, beds: Number(e.target.value) })} /></Field>
                <Field label="Status">
                  <select value={draft.status as string} onChange={(e) => setDraft({ ...draft, status: e.target.value as RoomStatus })}
                    className="w-full h-9 px-3 border border-input rounded-md bg-background text-sm">
                    {(Object.keys(STATUS_META) as RoomStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </Field>
                <Field label="Actual rent (₹)"><Input type="number" value={draft.actualRent || ""} onChange={(e) => setDraft({ ...draft, actualRent: Number(e.target.value) })} /></Field>
                <Field label="Expected rent (₹)"><Input type="number" value={draft.expectedRent || ""} onChange={(e) => setDraft({ ...draft, expectedRent: Number(e.target.value) })} /></Field>
                <Field label="Floor rent (private)"><Input type="number" value={draft.floorRent || ""} onChange={(e) => setDraft({ ...draft, floorRent: Number(e.target.value) })} /></Field>
                <Field label="Vacant from"><Input type="date" value={draft.vacantDate || ""} onChange={(e) => setDraft({ ...draft, vacantDate: e.target.value })} /></Field>
              </div>
              <Button onClick={addRoom}><Plus className="w-4 h-4 mr-1" /> Add room</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab content */}
        {tab === "inventory" && (
          <InventoryGridView
            rooms={rooms}
            visits={visits}
            onConfirm={confirmRoom}
            onStatus={setStatus}
            onShare={shareRoom}
            onRemove={remove}
            onUpdateDetails={onUpdateDetails}
            onOpenDetails={onOpenDetails}
          />
        )}
        {tab === "visits" && <VisitsTab visits={visits} rooms={rooms} onMark={markVisit} />}
        {tab === "ledger" && <LedgerTab actions={actions} rooms={rooms} />}
        {tab === "pricing" && <PricingTab rooms={rooms} onApply={(rid: string, rent: number) => { update(rid, { expectedRent: rent }); logAction(rid, "rent_changed", `→ ${fmtINR(rent)}`); }} />}
      </div>
    </div>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Field({ label, children }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DailyRitual({ locked, total, compliance, onConfirmAll }: any) {
  if (total === 0) return null;
  const hasLocked = locked > 0;
  return (
    <div className={`rounded-2xl p-4 border ${hasLocked ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          {hasLocked ? <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" /> : <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />}
          <div>
            <p className={`font-bold text-sm ${hasLocked ? "text-amber-900" : "text-emerald-900"}`}>
              {hasLocked ? `${locked} of ${total} rooms need today's confirmation` : "All rooms confirmed today"}
            </p>
            <p className={`text-xs mt-0.5 ${hasLocked ? "text-amber-700" : "text-emerald-700"}`}>
              Compliance score · {compliance}%. Unconfirmed rooms are auto-locked from referrals to prevent ghost selling.
            </p>
          </div>
        </div>
        {hasLocked && (
          <Button size="sm" variant="outline" onClick={onConfirmAll} className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100">
            Confirm all unchanged
          </Button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, small }: any) {
  const tones: Record<string, string> = {
    slate:   "bg-white border-slate-100 text-slate-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    rose:    "bg-rose-50 border-rose-100 text-rose-700",
    amber:   "bg-amber-50 border-amber-100 text-amber-700",
    violet:  "bg-violet-50 border-violet-100 text-violet-700",
  };
  return (
    <div className={`border rounded-xl p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide font-bold opacity-70">{label}</p>
        <Icon className="w-3.5 h-3.5 opacity-60" />
      </div>
      <p className={`font-black mt-1 ${small ? "text-base" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function RoomCard({ room, visits, onConfirm, onStatus, onShare, onRemove, onOpenDetails, onOpenModal }: any) {
  const demand = room.demandScore ?? 85;

  return (
    <motion.div layout className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onOpenDetails}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-slate-900 text-lg">Room #{room.roomNumber}</h3>
            <Badge variant="outline" className={`text-[10px] ${STATUS_META[room.status as keyof typeof STATUS_META]?.cls || ""}`}>{STATUS_META[room.status as keyof typeof STATUS_META]?.label || room.status}</Badge>
            {demand > 75 && <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200"><Flame className="w-3 h-3 mr-1" /> Hot</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="flex items-center gap-1">
              <IndianRupee className="w-3 h-3" />
              {fmtINR(room.expectedRent).replace("₹", "")}/mo
            </span>
          </p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* Demand bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
          <span>Demand index</span><span>{demand}/100</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${demand > 75 ? "bg-orange-500" : demand > 50 ? "bg-amber-400" : "bg-slate-300"}`} style={{ width: `${demand}%` }} />
        </div>
      </div>

      {/* Upcoming visits */}
      {visits && visits.length > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          <p className="text-[10px] font-bold uppercase text-amber-700 mb-1">Upcoming visits</p>
          {visits.slice(0, 2).map((v: Visit) => (
            <div key={v.id} className="text-xs text-amber-900 flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> {v.customerName} · {new Date(v.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              <Badge variant="outline" className="text-[9px] bg-white border-amber-200 ml-auto">{v.type}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpenModal(); }} variant="outline" className="h-8 text-xs bg-slate-50 border-slate-200 hover:bg-slate-100 w-full">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" /> Manage details
        </Button>
      </div>
    </motion.div>
  );
}

function VisitsTab({ visits, rooms, onMark }: any) {
  if (visits.length === 0) {
    return <Empty icon={CalendarDays} text="No visits yet. Admins will schedule them." />;
  }
  const sorted = [...visits].sort((a: Visit, b: Visit) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  return (
    <div className="space-y-2">
      {sorted.map((v: Visit) => {
        const room = rooms.find((r: Room) => r.id === v.roomId);
        return (
          <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900 text-sm">{v.customerName}</p>
                <Badge variant="outline" className="text-[10px]">{v.type}</Badge>
                <Badge variant="outline" className={`text-[10px] ${
                  v.status === "scheduled" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  v.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  v.status === "no_show" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  "bg-slate-50 text-slate-600 border-slate-200"
                }`}>{v.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Room {room?.roomNumber || "?"} · {new Date(v.scheduledAt).toLocaleString()} {v.customerPhone && `· ${v.customerPhone}`}
              </p>
            </div>
            {v.status === "scheduled" && (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onMark(v.id, "done")} className="h-8 text-xs">Mark done</Button>
                <Button size="sm" variant="outline" onClick={() => onMark(v.id, "no_show")} className="h-8 text-xs">No-show</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LedgerTab({ actions, rooms }: any) {
  if (actions.length === 0) {
    return <Empty icon={Activity} text="Effort ledger is empty. Every pitch, tour, visit and confirmation will appear here." />;
  }
  const counts = actions.reduce((acc: Record<string, number>, a: Action) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4">
      {/* Effort summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {(Object.keys(ACTION_META) as ActionType[]).slice(0, 4).map((t) => {
          const M = ACTION_META[t];
          return (
            <div key={t} className="bg-white border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg grid place-items-center ${M.cls}`}><M.icon className="w-3.5 h-3.5" /></div>
                <p className="text-[10px] font-bold uppercase text-slate-500">{M.label}</p>
              </div>
              <p className="font-black text-lg text-slate-900 mt-1">{counts[t] || 0}</p>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {actions.slice(0, 50).map((a: Action) => {
          const M = ACTION_META[a.type];
          const room = rooms.find((r: Room) => r.id === a.roomId);
          return (
            <div key={a.id} className="p-3 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${M.cls}`}><M.icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900"><span className="font-bold">{M.label}</span> {room && <span className="text-slate-500">· Room {room.roomNumber}</span>}</p>
                {a.note && <p className="text-xs text-slate-500 mt-0.5">{a.note}</p>}
              </div>
              <p className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.at)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PricingTab({ rooms, onApply }: any) {
  const open = rooms.filter((r: Room) => r.status === "vacant" || r.status === "vacating");
  if (open.length === 0) return <Empty icon={Sparkles} text="No vacant/vacating rooms. Pricing assistant activates when rooms open up." />;

  return (
    <div className="space-y-3">
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-violet-600 mt-0.5" />
        <div>
          <p className="font-bold text-violet-900 text-sm">Dynamic pricing suggestions</p>
          <p className="text-xs text-violet-700 mt-0.5">Based on demand index, vacancy days and your floor rent. One click applies.</p>
        </div>
      </div>
      {open.map((r: Room) => {
        const demand = r.demandScore ?? 85;
        
        const factor = demand > 75 ? 1.05 : demand > 50 ? 1.0 : demand > 35 ? 0.95 : 0.92;
        let suggest = Math.round((r.expectedRent || r.actualRent) * factor / 100) * 100;
        if (r.floorRent && suggest < r.floorRent) suggest = r.floorRent;
        const diff = suggest - r.expectedRent;
        const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
        
        return (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-slate-900 text-sm">Room {r.roomNumber}</p>
              <p className="text-xs text-slate-500">Current ask {fmtINR(r.expectedRent)} · demand {demand}/100{r.floorRent ? ` · floor ${fmtINR(r.floorRent)}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-xs font-bold flex items-center gap-1 ${dir === "up" ? "text-emerald-600" : dir === "down" ? "text-rose-600" : "text-slate-500"}`}>
                {dir === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : dir === "down" ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                Suggest {fmtINR(suggest)}
              </div>
              <Button size="sm" variant="outline" disabled={diff === 0} onClick={() => onApply(r.id, suggest)} className="h-8 text-xs">
                Apply
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ icon: Icon, text }: any) {
  return (
    <div className="text-center py-14 bg-white border border-dashed border-slate-200 rounded-2xl">
      <Icon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

/* ─────────────── Floor Grid & Modal Components ─────────────── */

function InventoryGridView({ rooms, visits, onConfirm, onStatus, onShare, onRemove, onUpdateDetails, onOpenDetails }: any) {
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<Room | null>(null);
  const floors = useMemo(() => {
    const f: Record<number, Room[]> = {};
    rooms.forEach((r: Room) => {
      const fl = (r as any).floorNumber || 1;
      if (!f[fl]) f[fl] = [];
      f[fl].push(r);
    });
    return f;
  }, [rooms]);

  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});
  const toggleFloor = (f: number) => setExpandedFloors(prev => ({ ...prev, [f]: prev[f] === undefined ? false : !prev[f] }));

  const sortedFloors = Object.keys(floors).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {sortedFloors.length === 0 ? (
        <div className="text-center py-14 bg-white border border-dashed border-slate-200 rounded-2xl">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No rooms to display. Add your first room.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedFloors.map(fl => (
            <div key={fl}>
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Floor {fl}</h3>
                <span className="text-[10px] text-slate-400 font-medium">({floors[fl].length} rooms)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {floors[fl].sort((a,b) => a.roomNumber.localeCompare(b.roomNumber)).map(room => (
                  <RoomCard 
                    key={room.id} 
                    room={room} 
                    visits={visits.filter((v: Visit) => v.roomId === room.id && v.status === "scheduled")}
                    onConfirm={() => onConfirm(room.id)}
                    onStatus={(s: RoomStatus) => onStatus(room.id, s)}
                    onShare={() => onShare(room)}
                    onRemove={() => onRemove(room.id)}
                    onOpenDetails={() => onOpenDetails(room.id)}
                    onOpenModal={() => setSelectedRoomForModal(room)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRoomForModal && (
        <RoomDetailModal
          room={selectedRoomForModal}
          onClose={() => setSelectedRoomForModal(null)}
          onUpdate={(data: any) => {
            onUpdateDetails?.(selectedRoomForModal.id, data);
            setSelectedRoomForModal({ ...selectedRoomForModal, ...data });


          }}
        />
      )}
    </div>
  );
}

function RoomDetailModal({ room, onClose, onUpdate }: { room: Room, onClose: () => void, onUpdate: (data: any) => void }) {
  const cStatus = (room as any).commercialStatus || "vacant";
  
  const getBadgeStyle = () => {
    if (cStatus === "occupied") return "bg-blue-600 text-white border-[3px] border-rose-500 shadow-sm";
    if (cStatus === "vacant") return "bg-emerald-500 text-white border-[3px] border-emerald-200 shadow-sm";
    return "bg-slate-800 text-white border-[3px] border-slate-300 shadow-sm";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5 mb-5">
          <p className="text-[11px] font-black uppercase text-orange-600 tracking-widest">Room</p>
          <div className="flex items-center justify-between">
            <h2 className="text-[32px] leading-none font-medium text-slate-800" style={{ fontFamily: "Georgia, serif" }}>#{room.roomNumber}</h2>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getBadgeStyle()}`}>
              {cStatus.replace("_", " ")}
            </div>
          </div>
          <p className="text-[13px] text-slate-500 mt-1">
            Sharing {room.beds} · ₹{(room.expectedRent || 0).toLocaleString()}/mo · Readiness {(room as any).readinessScore ?? 100}/100
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Commercial</label>
            <select
              value={(room as any).commercialStatus || "vacant"}
              onChange={e => onUpdate({ commercialStatus: e.target.value })}
              className="w-full bg-white border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="vacant">vacant</option>
              <option value="quoted">quoted</option>
              <option value="booked">booked</option>
              <option value="occupied">occupied</option>
              <option value="on_notice">on notice</option>
              <option value="reserved">reserved</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Operational</label>
            <select
              value={(room as any).operationalStatus || "ready"}
              onChange={e => onUpdate({ operationalStatus: e.target.value })}
              className="w-full bg-white border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="ready">ready</option>
              <option value="cleaning">needs cleaning</option>
              <option value="maintenance">maintenance/blocked</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Turnaround</label>
            <select
              value={(room as any).turnaroundStatus || "none"}
              onChange={e => onUpdate({ turnaroundStatus: e.target.value })}
              className="w-full bg-white border border-slate-200 text-slate-800 text-[15px] rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="none">none</option>
              <option value="checkout">scheduled checkout</option>
              <option value="checkin">scheduled check-in</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button 
            onClick={() => { onUpdate({ operationalStatus: "ready" }); onClose(); }}
            className="w-full py-2.5 rounded-xl bg-green-100/50 hover:bg-green-100 text-green-700 text-sm font-bold transition-colors"
          >
            Ready today
          </button>
          <button 
            onClick={() => { onUpdate({ turnaroundStatus: "checkout" }); onClose(); }}
            className="w-full py-2.5 rounded-xl bg-orange-100/50 hover:bg-orange-100 text-orange-700 text-sm font-bold transition-colors"
          >
            Checkout today
          </button>
          <button 
            onClick={() => { onUpdate({ operationalStatus: "cleaning" }); onClose(); }}
            className="w-full py-2.5 rounded-xl bg-blue-100/50 hover:bg-blue-100 text-blue-700 text-sm font-bold transition-colors"
          >
            Send to cleaning
          </button>
          <button 
            onClick={() => { onUpdate({ operationalStatus: "maintenance" }); onClose(); }}
            className="w-full py-2.5 rounded-xl bg-rose-100/50 hover:bg-rose-100 text-rose-700 text-sm font-bold transition-colors"
          >
            Block: maintenance
          </button>
        </div>
      </motion.div>
    </div>
  );
}
