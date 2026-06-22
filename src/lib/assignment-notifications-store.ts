/**
 * Assignment Notifications Store
 *
 * Polls the server for pending assignment notifications addressed to the
 * currently logged-in user. Exposes accept() and passOn() actions that
 * dispatch the appropriate commands and refresh the list.
 */

import { create } from "zustand";
import { api, type AssignmentNotificationItem } from "@/lib/api/client";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 14)}`;

interface AssignmentNotifState {
  /** Pending assignments for the current user */
  pending: AssignmentNotificationItem[];
  /** Assignments passed on (for the original assigner's info feed) */
  passed: AssignmentNotificationItem[];
  loading: boolean;
  error: string | null;

  /** Fetch both pending + passed lists from the server */
  refresh: () => Promise<void>;

  /** Accept a pending assignment (lead or tour) */
  accept: (notificationId: string, type: "lead" | "tour") => Promise<void>;

  /** Pass on a pending assignment to another person */
  passOn: (notificationId: string, type: "lead" | "tour", newAssigneeId: string) => Promise<void>;
}

export const useAssignmentNotifications = create<AssignmentNotifState>()((set, get) => ({
  pending: [],
  passed: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [pendingRes, passedRes] = await Promise.all([
        api.assignmentNotifications.listPending(),
        api.assignmentNotifications.listPassed(),
      ]);
      set({ pending: pendingRes.items, passed: passedRes.items });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  accept: async (notificationId, type) => {
    const cmdType = type === "lead" ? "cmd.lead.accept_assignment" : "cmd.tour.accept_assignment";
    await api.command({
      _id: uid("c"),
      type: cmdType,
      issuedAt: new Date().toISOString(),
      payload: { notificationId },
    });
    // Update status immediately (optimistic)
    set((s) => ({
      pending: s.pending.map((n) => n._id === notificationId ? { ...n, status: "accepted" as const } : n),
    }));
    // Refresh from server to sync
    await get().refresh();
  },

  passOn: async (notificationId, type, newAssigneeId) => {
    const cmdType = type === "lead" ? "cmd.lead.pass_assignment" : "cmd.tour.pass_assignment";
    await api.command({
      _id: uid("c"),
      type: cmdType,
      issuedAt: new Date().toISOString(),
      payload: { notificationId, newAssigneeId },
    });
    // Remove from pending list immediately (optimistic)
    set((s) => ({
      pending: s.pending.filter((n) => n._id !== notificationId),
    }));
    // Refresh from server to sync
    await get().refresh();
  },
}));

/** How many pending assignments does the current user have? */
export function usePendingAssignmentCount(): number {
  return useAssignmentNotifications((s) => s.pending.filter((n) => n.status === "pending").length);
}
