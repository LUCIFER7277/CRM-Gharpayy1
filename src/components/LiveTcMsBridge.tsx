// Hydrates the zustand `useApp().tcms` array from MongoDB and keeps
// Impact Queue / assignment dropdowns populated with real TCM users.
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api, type ManagedUser } from "@/lib/api/client";
import type { TCM } from "@/lib/types";
import { useAuthUser } from "@/lib/auth-store";

function toTcm(u: ManagedUser): TCM {
  const parts = (u.fullName || u.email || "TC").split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "TC";
  return {
    id: u.id,
    name: u.fullName,
    initials,
    zone: u.zones?.[0] ?? "",
    conversionRate: 0,
    avgResponseMins: 0,
  };
}

export function LiveTcMsBridge() {
  const setTcms = useApp((s) => s.setTcms);
  const setCurrentTcmId = useApp((s) => s.setCurrentTcmId);
  const authUser = useAuthUser((s) => s.user);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = await api.tcms.list();
        if (cancelled) return;
        setTcms((list || []).map(toTcm));
      } catch (err) {
        console.warn("[LiveTcMsBridge] failed to hydrate tcms:", (err as Error).message);
      }
    };

    void load();

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setTcms]);

  // When logged in as a TCM, lock the active TCM scope to the authenticated user.
  useEffect(() => {
    if (authUser?.role === "tcm" && authUser.id) {
      setCurrentTcmId(authUser.id);
    }
  }, [authUser?.id, authUser?.role, setCurrentTcmId]);

  return null;
}
