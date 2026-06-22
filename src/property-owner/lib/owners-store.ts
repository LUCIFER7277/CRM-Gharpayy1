// @ts-nocheck
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { OWNERS_SEED, type Owner } from "@/property-owner/data/owners-seed";
import { PGS } from "@/property-genius/data/pgs";
import type { PG } from "@/types/entities";

interface OwnersState {
  owners: Owner[];
  // Per-property field overrides (id -> partial PG)
  propertyOverrides: Record<string, Partial<PG>>;
  activeOwnerId: string | null;
  setActiveOwner: (id: string | null) => void;
  updateOwner: (id: string, patch: Partial<Owner>) => void;
  rotatePassword: (id: string) => void;
  updateProperty: (pgId: string, patch: Partial<PG>) => void;
  resetAll: () => void;
}

const rand = () =>
  Math.random().toString(36).slice(2, 6) + Math.floor(100 + Math.random() * 900);

export const useOwnersStore = create<OwnersState>()(
  persist(
    (set) => ({
      owners: OWNERS_SEED,
      propertyOverrides: {},
      activeOwnerId: null,
      setActiveOwner: (id) => set({ activeOwnerId: id }),
      updateOwner: (id, patch) =>
        set((s) => ({
          owners: s.owners.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      rotatePassword: (id) =>
        set((s) => ({
          owners: s.owners.map((o) =>
            o.id === id ? { ...o, password: rand() } : o
          ),
        })),
      updateProperty: (pgId, patch) =>
        set((s) => ({
          propertyOverrides: {
            ...s.propertyOverrides,
            [pgId]: { ...(s.propertyOverrides[pgId] || {}), ...patch },
          },
        })),
      resetAll: () =>
        set({ owners: OWNERS_SEED, propertyOverrides: {}, activeOwnerId: null }),
    }),
    {
      name: "gharpayy_owners_v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export function getMergedProperty(pgId: string): PG | undefined {
  const base = PGS.find((p) => p.id === pgId);
  if (!base) return undefined;
  const ov = useOwnersStore.getState().propertyOverrides[pgId];
  return ov ? ({ ...base, ...ov } as PG) : base;
}

export function getOwnerProperties(ownerId: string): PG[] {
  const owner = useOwnersStore.getState().owners.find((o) => o.id === ownerId);
  if (!owner) return [];
  return owner.propertyIds
    .map((id) => getMergedProperty(id))
    .filter(Boolean) as PG[];
}
