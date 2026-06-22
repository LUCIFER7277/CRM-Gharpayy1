import { create } from "zustand";
import type { Intent, Role } from "@/types/entities";

type ViewMode = "stack" | "board";

interface ImpactUIState {
  tcmFilter: string;
  query: string;
  intentFilter: Intent | "all";
  onlyOverdue: boolean;
  onlyTourToday: boolean;
  onlyQuotePending: boolean;
  viewMode: ViewMode;

  setTcmFilter: (id: string) => void;
  setQuery: (q: string) => void;
  setIntentFilter: (intent: Intent | "all") => void;
  toggleOnlyOverdue: () => void;
  toggleOnlyTourToday: () => void;
  toggleOnlyQuotePending: () => void;
  setViewMode: (mode: ViewMode) => void;

  // Mock properties for current user session (should eventually come from Auth/Context)
  role: Role;
  currentTcmId: string;
}

export const useImpactUIStore = create<ImpactUIState>((set) => ({
  tcmFilter: "all",
  query: "",
  intentFilter: "all",
  onlyOverdue: false,
  onlyTourToday: false,
  onlyQuotePending: false,
  viewMode: "board",

  setTcmFilter: (id) => set({ tcmFilter: id }),
  setQuery: (q) => set({ query: q }),
  setIntentFilter: (intent) => set({ intentFilter: intent }),
  toggleOnlyOverdue: () => set((s) => ({ onlyOverdue: !s.onlyOverdue })),
  toggleOnlyTourToday: () => set((s) => ({ onlyTourToday: !s.onlyTourToday })),
  toggleOnlyQuotePending: () => set((s) => ({ onlyQuotePending: !s.onlyQuotePending })),
  setViewMode: (mode) => set({ viewMode: mode }),

  // Auth Mocks for UI consistency
  role: "flow-ops",
  currentTcmId: "tcm-1",
}));
