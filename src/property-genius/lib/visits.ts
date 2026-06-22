// Visit scheduling — every PG gets its own bookable visit slots.
// Stored in localStorage so team + owner dashboards share state.
import { useEffect, useState } from "react";
import { logActivity, pushNotification, pgName, uid } from "@/property-genius/lib/bookos-shim";

export type VisitStatus = "Scheduled" | "Confirmed" | "Visited" | "No-Show" | "Cancelled" | "Converted";
export type RoomStatus = "Occupied" | "Vacating" | "Vacant" | "Ready" | "Cleaning" | "Dirty" | "Blocked";

export interface Visit {
  id: string;
  pgId: string;
  ownerCode: string;
  leadName: string;
  phone: string;
  slot: string;          // ISO datetime
  occupancy?: "Single" | "Double" | "Triple";
  budget?: number;
  source?: string;
  status: VisitStatus;
  notes?: string;
  createdAt: number;
}

export interface RoomState {
  pgId: string;
  totalBeds: number;
  vacantBeds: number;
  rooms: Array<{ id: string; name: string; status: RoomStatus; note?: string }>;
  updatedAt: number;
}

interface VState {
  visits: Visit[];
  rooms: Record<string, RoomState>; // by pgId
}

const K = "gh_visits_v1";
const empty: VState = { visits: [], rooms: {} };

export function load(): VState {
  try { const r = localStorage.getItem(K); return r ? { ...empty, ...JSON.parse(r) } : empty; }
  catch { return empty; }
}
function save(s: VState) {
  localStorage.setItem(K, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("visits:change"));
}

export function scheduleVisit(v: Omit<Visit, "id" | "createdAt" | "status"> & { status?: VisitStatus }): Visit {
  const s = load();
  const visit: Visit = { ...v, id: uid("vs"), createdAt: Date.now(), status: v.status ?? "Scheduled" };
  s.visits.unshift(visit);
  save(s);
  logActivity("scheduled visit", "visit", `${v.leadName} · ${pgName(v.pgId)}`);
  pushNotification({
    type: "reminder", channel: "inapp",
    title: "Visit scheduled",
    body: `${v.leadName} · ${pgName(v.pgId)} · ${new Date(v.slot).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
  });
  return visit;
}

export function updateVisit(id: string, patch: Partial<Visit>) {
  const s = load();
  s.visits = s.visits.map((v) => v.id === id ? { ...v, ...patch } : v);
  save(s);
  if (patch.status) logActivity(`visit ${patch.status.toLowerCase()}`, "visit", id);
}

export function visitsForPG(pgId: string) {
  return load().visits.filter((v) => v.pgId === pgId);
}
export function visitsForOwner(ownerCode: string) {
  return load().visits.filter((v) => v.ownerCode === ownerCode);
}

/* ---------- Rooms ---------- */
export function ensureRoomState(pgId: string, defaultBeds = 12): RoomState {
  const s = load();
  if (s.rooms[pgId]) return s.rooms[pgId];
  const rooms = Array.from({ length: defaultBeds }, (_, i) => ({
    id: `r${i + 1}`, name: `Room ${i + 1}`, status: (i < defaultBeds - 3 ? "Occupied" : "Vacant") as RoomStatus,
  }));
  const rs: RoomState = { pgId, totalBeds: defaultBeds, vacantBeds: 3, rooms, updatedAt: Date.now() };
  s.rooms[pgId] = rs;
  save(s);
  return rs;
}

export function updateRoom(pgId: string, roomId: string, patch: Partial<RoomState["rooms"][number]>) {
  const s = load();
  const rs = s.rooms[pgId];
  if (!rs) return;
  rs.rooms = rs.rooms.map((r) => r.id === roomId ? { ...r, ...patch } : r);
  rs.vacantBeds = rs.rooms.filter((r) => r.status === "Vacant" || r.status === "Ready").length;
  rs.updatedAt = Date.now();
  save(s);
  if (patch.status) logActivity(`room marked ${patch.status}`, "room", `${pgName(pgId)} · ${roomId}`);
}

export function setVacantBeds(pgId: string, count: number) {
  const s = load();
  const rs = s.rooms[pgId] ?? ensureRoomState(pgId);
  rs.vacantBeds = Math.max(0, count);
  rs.updatedAt = Date.now();
  s.rooms[pgId] = rs;
  save(s);
  logActivity("updated vacancy", "room", `${pgName(pgId)} · ${count} beds`);
}

export function addRoom(pgId: string, name: string) {
  const s = load();
  const rs = s.rooms[pgId] ?? ensureRoomState(pgId);
  rs.rooms.push({ id: uid("r"), name, status: "Vacant" });
  rs.totalBeds = rs.rooms.length;
  rs.vacantBeds = rs.rooms.filter((r) => r.status === "Vacant" || r.status === "Ready").length;
  rs.updatedAt = Date.now();
  s.rooms[pgId] = rs;
  save(s);
}

export function useVisits() {
  const [s, setS] = useState<VState>(() => load());
  useEffect(() => {
    const r = () => setS(load());
    window.addEventListener("visits:change", r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener("visits:change", r);
      window.removeEventListener("storage", r);
    };
  }, []);
  return s;
}
