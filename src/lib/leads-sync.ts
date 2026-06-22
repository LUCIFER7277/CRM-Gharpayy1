import { create } from "zustand";

export type LeadsSyncStatus = "idle" | "loading" | "ready" | "error";

type LeadsSyncState = {
  status: LeadsSyncStatus;
  error: string | null;
  lastOkAt: number | null;
  setLoading: () => void;
  setReady: () => void;
  setError: (message: string) => void;
};

export const useLeadsSync = create<LeadsSyncState>((set) => ({
  status: "idle",
  error: null,
  lastOkAt: null,
  setLoading: () => set({ status: "loading", error: null }),
  setReady: () => set({ status: "ready", error: null, lastOkAt: Date.now() }),
  setError: (message) => set({ status: "error", error: message }),
}));
