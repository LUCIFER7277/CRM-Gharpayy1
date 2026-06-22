/**
 * Notifications store - bridges the cross-role connector bus into
 * an inbox with read/unread state, role-aware filtering and toast hints.
 *
 * Pure browser-side (Zustand + localStorage). Notifications are produced
 * automatically by subscribing to `src/lib/connectors.ts` once on boot.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { subscribe, type ConnectorEvent, type ConnectorEventKind } from "./connectors";
import type { Role } from "./types";

export type NotifSeverity = "info" | "success" | "warn" | "urgent";
export type NotifChannel = "in-app" | "todo" | "calendar" | "email";

export interface AppNotification {
  id: string;
  ts: number;
  read: boolean;
  /** which roles should see this - empty = everyone */
  audience: Role[];
  /** target user id within that audience - when set, only that user sees it */
  recipientId?: string;
  severity: NotifSeverity;
  title: string;
  body: string;
  href?: string;
  /** original event kind for grouping/filtering */
  kind: ConnectorEventKind | "system" | "broadcast";
  leadId?: string;
  tourId?: string;
  /** broadcast extras */
  channels?: NotifChannel[];
  dueAt?: number;
  senderId?: string;
  senderName?: string;
  /** marker so /inbox can show "would-email" badge */
  emailQueued?: boolean;
  /** todo state - set when channels include "todo" */
  todoDone?: boolean;
}

export interface BroadcastInput {
  senderId: string;
  senderName: string;
  recipients: { role: Role; id: string; name: string }[];
  channels: NotifChannel[];
  severity: NotifSeverity;
  title: string;
  body: string;
  dueAt?: number;
  href?: string;
}

interface NotifState {
  items: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "ts" | "read"> & { id?: string; ts?: number }) => void;
  pushBroadcast: (b: BroadcastInput) => string[];
  markRead: (id: string) => void;
  toggleTodoDone: (id: string) => void;
  markAllRead: (forRole?: Role, recipientId?: string) => void;
  removeMany: (ids: string[]) => void;
  clear: () => void;
}

const MAX = 80;

export const useNotifications = create<NotifState>()(
  persist(
    (set) => ({
      items: [],
      push: (n) => set((s) => {
        const id = n.id ?? `n:${n.kind}:${Math.random().toString(36).slice(2, 10)}`;
        if (s.items.some((x) => x.id === id)) return s;
        const next: AppNotification = {
          id,
          ts: n.ts ?? Date.now(),
          read: false,
          audience: n.audience,
          recipientId: n.recipientId,
          severity: n.severity,
          title: n.title,
          body: n.body,
          href: n.href,
          kind: n.kind,
          leadId: n.leadId,
          tourId: n.tourId,
          channels: n.channels,
          dueAt: n.dueAt,
          senderId: n.senderId,
          senderName: n.senderName,
          emailQueued: n.emailQueued,
          todoDone: n.todoDone,
        };
        return { items: [next, ...s.items].slice(0, MAX) };
      }),
      pushBroadcast: (b) => {
        const ids: string[] = [];
        const baseTs = Date.now();
        const tag = Math.random().toString(36).slice(2, 8);
        b.recipients.forEach((r, i) => {
          const id = `bc:${tag}:${r.id}`;
          ids.push(id);
          const item: AppNotification = {
            id,
            ts: baseTs + i,
            read: false,
            audience: [r.role],
            recipientId: r.id,
            severity: b.severity,
            title: b.title,
            body: b.body,
            href: b.href ?? "/inbox",
            kind: "broadcast",
            channels: b.channels,
            dueAt: b.dueAt,
            senderId: b.senderId,
            senderName: b.senderName,
            emailQueued: b.channels.includes("email"),
            todoDone: b.channels.includes("todo") ? false : undefined,
          };
          set((s) => {
            if (s.items.some((x) => x.id === id)) return s;
            return { items: [item, ...s.items].slice(0, MAX) };
          });
        });
        return ids;
      },
      markRead: (id) => set((s) => ({
        items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      })),
      toggleTodoDone: (id) => set((s) => ({
        items: s.items.map((n) => (n.id === id ? { ...n, todoDone: !n.todoDone, read: true } : n)),
      })),
      markAllRead: (forRole, recipientId) => set((s) => ({
        items: s.items.map((n) => {
          if (n.recipientId && n.recipientId !== recipientId) return n;
          if (!forRole || n.audience.length === 0 || n.audience.includes(forRole)) {
            return { ...n, read: true };
          }
          return n;
        }),
      })),
      removeMany: (ids) => set((s) => {
        if (ids.length === 0) return s;
        const blocked = new Set(ids);
        return { items: s.items.filter((n) => !blocked.has(n.id)) };
      }),
      clear: () => set({ items: [] }),
    }),
    { name: "gharpayy.notifications.v1" },
  ),
);

/** Map a connector event into a human notification. Returns null if irrelevant. */
function toNotification(e: ConnectorEvent): Omit<AppNotification, "id" | "ts" | "read"> | null {
  switch (e.kind) {
    case "lead.added":
      return {
        audience: ["flow-ops", "hr"],
        severity: "info",
        title: "New lead in pipeline",
        body: e.text,
        href: "/leads",
        kind: e.kind,
        leadId: e.leadId,
      };
    case "lead.assigned":
      return {
        audience: ["tcm", "flow-ops"],
        severity: "info",
        title: "Lead assigned",
        body: e.text,
        href: "/today",
        kind: e.kind,
        leadId: e.leadId,
      };
    case "tour.scheduled":
      return null; // schedule flows push member-targeted notifications directly
    case "tour.completed":
      return {
        audience: ["tcm", "hr"],
        severity: "warn",
        title: "Tour finished - fill post-tour",
        body: e.text,
        href: "/tours",
        kind: e.kind,
        tourId: e.tourId,
      };
    case "post_tour.filled":
      return {
        audience: ["tcm", "hr", "flow-ops"],
        severity: "success",
        title: "Post-tour closed",
        body: e.text,
        href: "/tours",
        kind: e.kind,
        tourId: e.tourId,
      };
    case "booking.closed":
      return {
        audience: [],
        severity: "success",
        title: "Booking closed",
        body: e.text,
        href: "/leaderboard",
        kind: e.kind,
        leadId: e.leadId,
      };
    case "owner.room_updated":
      return {
        audience: ["owner", "flow-ops", "hr"],
        severity: "info",
        title: "Inventory updated",
        body: e.text,
        href: "/owner",
        kind: e.kind,
      };
    case "owner.block_decided":
      return {
        audience: ["owner", "flow-ops"],
        severity: "info",
        title: "Block request decided",
        body: e.text,
        href: "/owner/blocks",
        kind: e.kind,
      };
    case "handoff.sent":
      return {
        audience: [e.actorRole === "tcm" ? "flow-ops" : "tcm"],
        severity: "urgent",
        title: "New handoff",
        body: e.text,
        href: "/handoffs",
        kind: e.kind,
        leadId: e.leadId,
      };
    case "coach.cleared":
      return null; // too noisy
    default:
      return null;
  }
}

let started = false;
/** Subscribe once, on the client, to fan-out connector events into the inbox. */
export function startNotificationsBridge() {
  if (started || typeof window === "undefined") return;
  started = true;
  subscribe((e) => {
    const n = toNotification(e);
    if (!n) return;
    useNotifications.getState().push({
      ...n,
      id: `n:${e.id}`,
      ts: e.ts,
    });
  });
}

export function notifyTourScheduled(input: {
  tourId: string;
  leadId: string;
  leadName: string;
  senderId: string;
  senderName: string;
  assigneeName: string;
  recipientIds: Array<{ id: string; name: string }>;
}) {
  const store = useNotifications.getState();
  const recipients = input.recipientIds.filter((r, index, all) => all.findIndex((x) => x.id === r.id) === index);
  recipients.forEach((recipient) => {
    const isSender = recipient.id === input.senderId;
    store.push({
      id: `n:tour.scheduled:${input.tourId}:${recipient.id}`,
      ts: Date.now(),
      audience: [],
      recipientId: recipient.id,
      severity: isSender ? "success" : "info",
      title: isSender ? "Tour assigned" : "Tour assigned to you",
      body: isSender
        ? `You assigned ${input.leadName}'s tour to ${input.assigneeName?.trim() || "the assigned member"}`
        : `${input.senderName} assigned ${input.leadName}'s tour to you`,
      href: "/inbox",
      kind: "tour.scheduled",
      leadId: input.leadId,
      tourId: input.tourId,
      senderId: input.senderId,
      senderName: input.senderName,
    });
  });
}

/** Convenience hook for the bell - returns count for the active (role, userId). */
export function useUnreadCount(role: Role, userId?: string): number {
  return useNotifications((s) =>
    s.items.filter(
      (n) =>
        !n.read &&
        (n.audience.length === 0 || n.audience.includes(role)) &&
        (n.recipientId ? n.recipientId === userId : true),
    ).length,
  );
}

/** Items addressed to this (role, userId), ordered newest first. */
export function selectInboxFor(items: AppNotification[], role: Role, userId?: string) {
  return items.filter(
    (n) =>
      (n.audience.length === 0 || n.audience.includes(role)) &&
      (n.recipientId ? n.recipientId === userId : true),
  );
}

/** Broadcast todos for the current user - surfaced on Today + Inbox. */
export function selectBroadcastTodos(items: AppNotification[], role: Role, userId?: string) {
  return selectInboxFor(items, role, userId).filter(
    (n) => n.kind === "broadcast" && n.channels?.includes("todo") && !n.todoDone,
  );
}

/** Broadcast calendar entries for the current user - surfaced on /calendar. */
export function selectBroadcastCalendar(items: AppNotification[], role: Role, userId?: string) {
  return selectInboxFor(items, role, userId).filter(
    (n) => n.kind === "broadcast" && n.channels?.includes("calendar") && n.dueAt,
  );
}
