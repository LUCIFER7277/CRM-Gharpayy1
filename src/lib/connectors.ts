/**
 * Cross-role connector - a tiny pub/sub that lets Flow Ops, TCM, HR and Owner
 * "see each other". Every meaningful action a role takes fires an event here;
 * other roles subscribe to react (Coach missions, HR scoreboard, Owner
 * inventory, etc.).
 *
 * Pure browser-side, no network. Persisted recent feed in localStorage so
 * Coach Live shows context across reloads.
 */

import type { Role } from "./types";

export type ConnectorEventKind =
  | "lead.added"            // Flow Ops added a lead
  | "lead.assigned"         // Lead routed to a TCM
  | "tour.scheduled"        // Tour booked (by Flow Ops or TCM)
  | "tour.completed"        // Tour marked done
  | "post_tour.filled"      // TCM closed the post-tour loop
  | "booking.closed"        // TCM closed a deal
  | "owner.room_updated"    // Owner refreshed a room status
  | "owner.block_decided"   // Owner accepted/declined a block
  | "handoff.sent"          // Cross-role message
  | "coach.cleared";        // Any user cleared a coach item

export interface ConnectorEvent {
  id: string;
  kind: ConnectorEventKind;
  ts: number;
  /** primary actor - TCM id, "flow-ops", "hr", owner id */
  actorRole: Role;
  actorId: string;
  /** entities involved */
  leadId?: string;
  tourId?: string;
  propertyId?: string;
  ownerId?: string;
  bookingId?: string;
  /** human-readable line for the Coach Live ticker */
  text: string;
  /** optional partnership: who else gets attribution */
  assists?: { role: Role; id: string }[];
}

type Listener = (e: ConnectorEvent) => void;

const FEED_KEY = "gharpayy.connector.feed.v1";
const MAX_FEED = 60;

const listeners = new Set<Listener>();

function loadFeed(): ConnectorEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FEED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConnectorEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveFeed(feed: ConnectorEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEED_KEY, JSON.stringify(feed.slice(0, MAX_FEED)));
  } catch {
    /* ignore quota */
  }
}

/** Idempotency guard so reloads don't double-fire seed/init events. */
const seenIds = new Set<string>();

export function emit(e: Omit<ConnectorEvent, "id" | "ts"> & { id?: string; ts?: number }): ConnectorEvent {
  const id = e.id ?? `${e.kind}:${Math.random().toString(36).slice(2, 10)}`;
  if (seenIds.has(id)) {
    // Already broadcast this exact id - no-op.
    return { ...e, id, ts: e.ts ?? Date.now() } as ConnectorEvent;
  }
  seenIds.add(id);
  const evt: ConnectorEvent = { ...e, id, ts: e.ts ?? Date.now() };
  // Persist
  const feed = loadFeed();
  feed.unshift(evt);
  saveFeed(feed);
  // Notify
  listeners.forEach((fn) => {
    try { fn(evt); } catch { /* swallow */ }
  });
  return evt;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function recentFeed(limit = 30): ConnectorEvent[] {
  return loadFeed().slice(0, limit);
}

export function clearFeed() {
  saveFeed([]);
  seenIds.clear();
}
