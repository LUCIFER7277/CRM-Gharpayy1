import { create } from "zustand";
import { persist } from "zustand/middleware";
import { computeNewStreak } from "./coach";

export type WhoKey = string; // e.g. "tcm:tcm-1" or "flow-ops" or "owner"

interface PerUserStats {
  xp: number;
  streak: number;
  lastWinDate: string | null;   // YYYY-MM-DD (local)
  xpToday: number;
  todayKey: string | null;      // YYYY-MM-DD (local)
  bookingsClosed: number;
  /** ids of cleared coach items / bookings (so we don't double-count) */
  cleared: Record<string, true>;
}

interface GameState {
  byUser: Record<WhoKey, PerUserStats>;
  /** First-time celebration flags */
  shownIntro: boolean;

  awardXp: (who: WhoKey, amount: number, dedupeKey?: string) => number;
  /** Idempotent: registers a booking only once per bookingId. */
  registerBooking: (who: WhoKey, bookingId: string) => void;
  /** Roll the daily bucket if the local date changed. Call from useEffect, not render. */
  rolloverIfNeeded: (who: WhoKey) => void;
  resetUser: (who: WhoKey) => void;
  setShownIntro: (v: boolean) => void;
  /** Pure selector - never mutates state. Use this from render. */
  getStats: (who: WhoKey) => PerUserStats;
}

/** Local-date day key (YYYY-MM-DD). Honors the user's timezone. */
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const empty = (): PerUserStats => ({
  xp: 0, streak: 0, lastWinDate: null,
  xpToday: 0, todayKey: today(),
  bookingsClosed: 0, cleared: {},
});

/** Pure: returns stats with today's bucket reset if the day rolled over. */
function viewStats(cur: PerUserStats | undefined): PerUserStats {
  const c = cur ?? empty();
  if (c.todayKey !== today()) {
    return { ...c, xpToday: 0, todayKey: today() };
  }
  return c;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      byUser: {},
      shownIntro: false,

      // Pure read - never mutates state during render.
      getStats: (who) => viewStats(get().byUser[who]),

      // Side-effecting day rollover. Call from useEffect.
      rolloverIfNeeded: (who) => {
        const cur = get().byUser[who];
        if (!cur) return;
        if (cur.todayKey !== today()) {
          set((s) => ({
            byUser: { ...s.byUser, [who]: { ...cur, xpToday: 0, todayKey: today() } },
          }));
        }
      },

      awardXp: (who, amount, dedupeKey) => {
        const cur = viewStats(get().byUser[who]);
        if (dedupeKey && cur.cleared[dedupeKey]) return 0;
        const t = today();
        const { streak, lastWinDate } = computeNewStreak(
          cur.streak, cur.lastWinDate, t, true,
        );
        const next: PerUserStats = {
          ...cur,
          xp: cur.xp + amount,
          xpToday: cur.xpToday + amount,
          streak,
          lastWinDate,
          todayKey: t,
          cleared: dedupeKey ? { ...cur.cleared, [dedupeKey]: true } : cur.cleared,
        };
        set((s) => ({ byUser: { ...s.byUser, [who]: next } }));
        return amount;
      },

      // Idempotent - uses persisted `cleared` map, so navigating away
      // and back never double-counts a booking.
      registerBooking: (who, bookingId) => {
        const cur = viewStats(get().byUser[who]);
        const key = `booking:${bookingId}:counted`;
        if (cur.cleared[key]) return;
        const next: PerUserStats = {
          ...cur,
          bookingsClosed: cur.bookingsClosed + 1,
          cleared: { ...cur.cleared, [key]: true },
        };
        set((s) => ({ byUser: { ...s.byUser, [who]: next } }));
      },

      resetUser: (who) =>
        set((s) => ({ byUser: { ...s.byUser, [who]: empty() } })),

      setShownIntro: (v) => set({ shownIntro: v }),
    }),
    {
      name: "gharpayy-coach-v1",
      partialize: (s) => ({ byUser: s.byUser, shownIntro: s.shownIntro }),
    },
  ),
);

/** Resolve the "who" key from role + tcm */
export function whoKey(role: string, tcmId?: string): WhoKey {
  if (role === "tcm" && tcmId) return `tcm:${tcmId}`;
  return role;
}
