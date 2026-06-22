// Supply Ops persistence layer — localStorage-only, single device.
// Every owner-side mutation lives here: red flag, live inventory,
// scheduled visits, owner price-pitch log, onboarding checklist, free notes.
//
// Public API: `useSupply(pgId)` reactive hook + pure helpers (`getRecord`,
// `flaggedIds`, `effectiveScarcity`, `dueVisits`, `dueOwnerFollowups`).
//
// Storage shape (key `gh_supply_v1`): `{ [pgId]: SupplyRecord }`.
// Migrations: bump key + write `migrate()` if schema changes.

import { useEffect, useSyncExternalStore, useCallback } from "react";
import type { PG } from "@/property-genius/data/types";
import { scarcity as derivedScarcity, type ScarcityState } from "@/property-genius/lib/intel";

const KEY = "gh_supply_v1";

/* ---------- Types ---------- */

export interface InventoryOverride {
  // Live S/D/T occupancy. null = "use derived".
  single: { total: number; occupied: number } | null;
  double: { total: number; occupied: number } | null;
  triple: { total: number; occupied: number } | null;
  updatedAt: number;
}

export type VisitStatus = "pending" | "done" | "no-show" | "cancelled";

export interface VisitEntry {
  id: string;
  leadName: string;
  leadPhone?: string;
  whenISO: string;       // datetime-local
  status: VisitStatus;
  notes?: string;
  createdAt: number;
}

export interface OwnerPitch {
  id: string;
  proposedRent: number;
  forSharing: "single" | "double" | "triple";
  reaction: "accepted" | "negotiating" | "declined" | "ghosted";
  nextStep?: string;
  followUpISO?: string;  // date — when to chase again
  notes?: string;
  createdAt: number;
}

export const CHECKLIST_ITEMS = [
  { k: "kyc",        l: "Owner KYC verified" },
  { k: "agreement",  l: "Signed agreement on file" },
  { k: "deposit",    l: "Security deposit clarified" },
  { k: "photos",     l: "Photo set uploaded (8+)" },
  { k: "geopin",     l: "Geo-pin verified on map" },
  { k: "manager",    l: "Manager number active" },
  { k: "rules",      l: "House rules documented" },
  { k: "food",       l: "Food menu confirmed" },
] as const;

export type ChecklistKey = typeof CHECKLIST_ITEMS[number]["k"];

export interface NoteEntry {
  id: string;
  text: string;
  createdAt: number;
  author?: string;
}

export interface SupplyRecord {
  pgId: string;
  redFlag: boolean;
  redReason?: string;
  inventory: InventoryOverride | null;
  visits: VisitEntry[];
  pitches: OwnerPitch[];
  checklist: Record<ChecklistKey, boolean>;
  notes: NoteEntry[];
  updatedAt: number;
}

/* ---------- Store ---------- */

type Store = Record<string, SupplyRecord>;

function emptyRecord(pgId: string): SupplyRecord {
  return {
    pgId, redFlag: false, redReason: undefined, inventory: null,
    visits: [], pitches: [],
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map(({ k }) => [k, false])) as Record<ChecklistKey, boolean>,
    notes: [], updatedAt: 0,
  };
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch { return {}; }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* quota */ }
  invalidate();
  notify();
}

const listeners = new Set<() => void>();
function notify() { for (const fn of listeners) fn(); }
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { invalidate(); notify(); }
  });
}

/* ---------- Cached snapshots (stable refs for useSyncExternalStore) ---------- */

let storeCache: Store | null = null;
const recordCache = new Map<string, SupplyRecord>();
function invalidate() { storeCache = null; recordCache.clear(); }

function readCached(): Store {
  if (!storeCache) storeCache = read();
  return storeCache;
}

/* ---------- Pure getters ---------- */

export function getRecord(pgId: string): SupplyRecord {
  const cached = recordCache.get(pgId);
  if (cached) return cached;
  const r = readCached()[pgId];
  const base = emptyRecord(pgId);
  const rec: SupplyRecord = r
    ? { ...base, ...r, checklist: { ...base.checklist, ...(r.checklist ?? {}) } }
    : base;
  recordCache.set(pgId, rec);
  return rec;
}

export function getStore(): Store { return read(); }

export function flaggedIds(): Set<string> {
  return new Set(Object.values(read()).filter((r) => r.redFlag).map((r) => r.pgId));
}

/* ---------- Mutators ---------- */

function patch(pgId: string, mut: (r: SupplyRecord) => SupplyRecord) {
  const store = read();
  const next = mut({ ...emptyRecord(pgId), ...(store[pgId] ?? {}) });
  next.updatedAt = Date.now();
  store[pgId] = next;
  write(store);
}

export function setRedFlag(pgId: string, on: boolean, reason?: string) {
  patch(pgId, (r) => ({ ...r, redFlag: on, redReason: on ? reason ?? r.redReason ?? "" : undefined }));
}

export function setInventory(pgId: string, inv: InventoryOverride | null) {
  patch(pgId, (r) => ({ ...r, inventory: inv ? { ...inv, updatedAt: Date.now() } : null }));
}

export function addVisit(pgId: string, v: Omit<VisitEntry, "id" | "createdAt">) {
  patch(pgId, (r) => ({ ...r, visits: [{ ...v, id: rid(), createdAt: Date.now() }, ...r.visits] }));
}
export function updateVisit(pgId: string, id: string, mut: Partial<VisitEntry>) {
  patch(pgId, (r) => ({ ...r, visits: r.visits.map((v) => v.id === id ? { ...v, ...mut } : v) }));
}
export function removeVisit(pgId: string, id: string) {
  patch(pgId, (r) => ({ ...r, visits: r.visits.filter((v) => v.id !== id) }));
}

export function addPitch(pgId: string, p: Omit<OwnerPitch, "id" | "createdAt">) {
  patch(pgId, (r) => ({ ...r, pitches: [{ ...p, id: rid(), createdAt: Date.now() }, ...r.pitches] }));
}
export function removePitch(pgId: string, id: string) {
  patch(pgId, (r) => ({ ...r, pitches: r.pitches.filter((p) => p.id !== id) }));
}

export function toggleChecklist(pgId: string, k: ChecklistKey) {
  patch(pgId, (r) => ({ ...r, checklist: { ...r.checklist, [k]: !r.checklist[k] } }));
}

export function addNote(pgId: string, text: string, author?: string) {
  if (!text.trim()) return;
  patch(pgId, (r) => ({ ...r, notes: [{ id: rid(), text: text.trim(), author, createdAt: Date.now() }, ...r.notes] }));
}
export function removeNote(pgId: string, id: string) {
  patch(pgId, (r) => ({ ...r, notes: r.notes.filter((n) => n.id !== id) }));
}

function rid() { return Math.random().toString(36).slice(2, 10); }

/* ---------- Hook ---------- */

export function useSupply(pgId: string | null | undefined) {
  const snap = useSyncExternalStore(
    subscribe,
    () => (pgId ? getRecord(pgId) : null),
    () => (pgId ? getRecord(pgId) : null),
  );
  return snap;
}

export function useAllSupply() {
  return useSyncExternalStore(subscribe, readCached, () => ({} as Store));
}

/* ---------- Derived: effective scarcity (manual override > derived) ---------- */

export function effectiveScarcity(pg: PG): ScarcityState & { source: "live" | "derived" } {
  const rec = getRecord(pg.id);
  const inv = rec.inventory;
  if (!inv || (!inv.single && !inv.double && !inv.triple)) {
    return { ...derivedScarcity(pg), source: "derived" };
  }
  const remaining = (slot: { total: number; occupied: number } | null) =>
    slot ? Math.max(0, slot.total - slot.occupied) : null;
  const perBed = {
    single: remaining(inv.single),
    double: remaining(inv.double),
    triple: remaining(inv.triple),
  };
  const counts = [perBed.single, perBed.double, perBed.triple].filter((n): n is number => n !== null);
  const total = counts.reduce((a, b) => a + b, 0);
  const lowest = counts.length ? Math.min(...counts) : 99;
  let level: ScarcityState["level"] = "AVAILABLE";
  if (total === 0) level = "FULL";
  else if (lowest === 1) level = "1 LEFT";
  else if (lowest === 2) level = "2 LEFT";
  else if (total <= 4) level = "FEW LEFT";
  const hot = level === "1 LEFT" || level === "2 LEFT";
  const reason =
    level === "1 LEFT"  ? "Only 1 bed left (live count) — call now"
  : level === "2 LEFT"  ? "Only 2 beds left (live count)"
  : level === "FULL"    ? "All beds occupied (live) — waitlist only"
  : level === "FEW LEFT"? "Filling fast — fewer than 5 beds open (live)"
  : "Multiple beds available (live)";
  return { level, perBed, hot, reason, source: "live" };
}

/* ---------- Cross-PG roll-ups for Supply Ops dashboard ---------- */

export interface DueVisit extends VisitEntry { pgId: string; }
export interface DueFollowup extends OwnerPitch { pgId: string; }

export function dueVisits(within: "today" | "week" | "all" = "week"): DueVisit[] {
  const now = Date.now();
  const horizon = within === "today" ? 86400000 : within === "week" ? 7 * 86400000 : Infinity;
  const out: DueVisit[] = [];
  for (const r of Object.values(read())) {
    for (const v of r.visits) {
      if (v.status !== "pending") continue;
      const t = new Date(v.whenISO).getTime();
      if (isNaN(t)) continue;
      if (t - now <= horizon) out.push({ ...v, pgId: r.pgId });
    }
  }
  return out.sort((a, b) => new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime());
}

export function dueOwnerFollowups(): DueFollowup[] {
  const now = Date.now();
  const out: DueFollowup[] = [];
  for (const r of Object.values(read())) {
    for (const p of r.pitches) {
      if (!p.followUpISO) continue;
      if (p.reaction === "accepted" || p.reaction === "declined") continue;
      const t = new Date(p.followUpISO).getTime();
      if (!isNaN(t) && t - now <= 14 * 86400000) out.push({ ...p, pgId: r.pgId });
    }
  }
  return out.sort((a, b) => new Date(a.followUpISO!).getTime() - new Date(b.followUpISO!).getTime());
}

export function checklistCompletion(pgId: string): number {
  const r = getRecord(pgId);
  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter(({ k }) => r.checklist[k]).length;
  return Math.round((done / total) * 100);
}

/* Used in the Supply Ops dashboard — properties whose readiness is < 60%. */
export function readinessGaps(allPgIds: string[]): { pgId: string; pct: number }[] {
  return allPgIds
    .map((id) => ({ pgId: id, pct: checklistCompletion(id) }))
    .filter((x) => x.pct < 100)
    .sort((a, b) => a.pct - b.pct);
}

/* React 18 useEffect compat — silence unused import warning if tree-shaken */
void useEffect; void useCallback;
