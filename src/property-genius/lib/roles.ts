// Role-switcher (no login). 4 personas. Persists in localStorage.
import { useEffect, useState } from "react";
import { PGS } from "@/property-genius/data/pgs";

export type Role = "team" | "manager" | "admin" | "owner";

export interface RoleState {
  role: Role;
  /** When role === "owner", the unique owner code currently active (e.g. GP-OWN-A1B2). */
  ownerCode?: string;
}

const K = "gh_role_v1";

const def: RoleState = { role: "admin" };

export function loadRole(): RoleState {
  try { const r = localStorage.getItem(K); return r ? { ...def, ...JSON.parse(r) } : def; }
  catch { return def; }
}
export function saveRole(s: RoleState) {
  localStorage.setItem(K, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("role:change"));
}

export function useRole() {
  const [s, setS] = useState<RoleState>(() => loadRole());
  useEffect(() => {
    const r = () => setS(loadRole());
    window.addEventListener("role:change", r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener("role:change", r);
      window.removeEventListener("storage", r);
    };
  }, []);
  return s;
}

/* ------------------ Owner codes ------------------ */
// Stable owner code derived from owner phone + groupName.
// Same code groups multiple PGs under one owner.
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().slice(0, 4);
}

export function ownerCodeForPG(pgId: string): string {
  const pg = PGS.find((p) => p.id === pgId);
  if (!pg) return "GP-OWN-XXXX";
  // Unique per property — phone + group + pgId guarantees one code per PG.
  const seed = `${pg.owner?.phone || ""}|${pg.groupName || ""}|${pg.id}`.replace(/\s+/g, "");
  return `GP-OWN-${hash(seed)}`;
}

/** All PGs that belong to a given owner code. */
export function pgsForOwner(code: string) {
  return PGS.filter((p) => ownerCodeForPG(p.id) === code);
}

/** All distinct owners with display info. */
/** All distinct owners — unique per PG. */
export function listOwners() {
  const m = new Map<string, { code: string; name: string; phone: string; pgCount: number; pgId: string }>();
  for (const p of PGS) {
    const code = ownerCodeForPG(p.id);
    const ex = m.get(code);
    if (ex) ex.pgCount++;
    else m.set(code, { code, name: p.owner?.name || p.groupName || "Owner", phone: p.owner?.phone || "", pgCount: 1, pgId: p.id });
  }
  return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
}
