// Auth user store. Hydrates from /api/auth/me on app boot using the saved
// Bearer token. Components subscribe to know whether the visitor is logged
// in and what their real DB role is.
import { create } from "zustand";
import { api, tokenStore, type AuthUser } from "./api/client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthUser = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  hydrate: async () => {
    if (typeof window === "undefined") return;
    if (get().loading) return;
    const token = tokenStore.get();
    if (!token) {
      set({ user: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const r = await api.auth.me();
      set({ user: r.user, loading: false });
    } catch (e) {
      // Token expired or invalid → clear
      tokenStore.clear();
      set({ user: null, loading: false, error: (e as Error).message });
    }
  },
  setUser: (u) => set({ user: u }),
  signOut: async () => {
    await api.logout();
    set({ user: null });
  },
}));
