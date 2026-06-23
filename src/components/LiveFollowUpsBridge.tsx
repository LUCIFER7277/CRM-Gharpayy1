import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { FollowUp } from "@/lib/types";
import type { DomainEvent } from "@/contracts";

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

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      if (!e.type.startsWith("evt.followup.")) return;
      void load();
    });

    return () => { cancelled = true; off(); };
  }, [setFollowUps]);

  return null;
}
