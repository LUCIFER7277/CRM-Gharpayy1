import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  phones: Record<string, string>;
  focusProps: Record<string, string[]>; // tcmId → propertyIds the TCM is pushing today
  setPhone: (tcmId: string, phone: string) => void;
  setFocus: (tcmId: string, propertyIds: string[]) => void;
  toggleFocusProp: (tcmId: string, propertyId: string) => void;
  clearFocus: (tcmId: string) => void;
}

export const useTcmContacts = create<State>()(
  persist(
    (set) => ({
      phones: {},
      focusProps: {},
      setPhone: (tcmId, phone) =>
        set((s) => ({ phones: { ...s.phones, [tcmId]: phone } })),
      setFocus: (tcmId, propertyIds) =>
        set((s) => ({ focusProps: { ...s.focusProps, [tcmId]: propertyIds } })),
      toggleFocusProp: (tcmId, propertyId) =>
        set((s) => {
          const cur = s.focusProps[tcmId] ?? [];
          const next = cur.includes(propertyId)
            ? cur.filter((x) => x !== propertyId)
            : [...cur, propertyId];
          return { focusProps: { ...s.focusProps, [tcmId]: next } };
        }),
      clearFocus: (tcmId) =>
        set((s) => ({ focusProps: { ...s.focusProps, [tcmId]: [] } })),
    }),
    { name: "gharpayy.tcm-contacts.v2" },
  ),
);
