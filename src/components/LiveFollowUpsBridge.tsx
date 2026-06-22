import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import type { FollowUp } from "@/lib/types";

function toFollowUp(raw: Record<string, unknown>): FollowUp {
  return {
    id: (raw._id ?? raw.id) as string,
    leadId: raw.leadId as string,
    tourId: raw.tourId as string | undefined,
    tcmId: raw.tcmId as string,
    dueAt: raw.dueAt as string,
    priority: (raw.priority ?? "medium") as FollowUp["priority"],
    reason: (raw.reason ?? "") as string,
    done: (raw.done ?? false) as boolean,
  };
}

export function LiveFollowUpsBridge() {
  const setFollowUps = useApp((s) => s.setFollowUps);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.followUps.list({ limit: 200 });
        if (cancelled) return;
        setFollowUps((r.items ?? []).map(toFollowUp));
      } catch (e) {
        console.warn("[LiveFollowUpsBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setFollowUps]);

  return null;
}
