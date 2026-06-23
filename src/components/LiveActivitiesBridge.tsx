import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { ActivityLog } from "@/lib/types";
import type { DomainEvent } from "@/contracts";

function toActivityLog(raw: Record<string, unknown>): ActivityLog {
  const entityType = raw.entityType as string | undefined;
  const entityId = raw.entityId as string | undefined;
  return {
    id: (raw._id ?? raw.id) as string,
    ts: (raw.occurredAt ?? raw.createdAt ?? "") as string,
    kind: mapKind(raw.kind as string),
    actor: (raw.actor ?? "system") as string,
    leadId: entityType === "lead" ? entityId : undefined,
    tourId: entityType === "tour" ? entityId : undefined,
    propertyId: entityType === "unit" ? entityId : undefined,
    text: (raw.subject ?? "") as string,
  };
}

function mapKind(k: string): ActivityLog["kind"] {
  const map: Record<string, ActivityLog["kind"]> = {
    created: "lead_created",
    stage_changed: "status_changed",
    assigned: "escalation",
    tour_scheduled: "tour_scheduled",
    site_visit: "site_visit",
    call: "call_logged",
    note: "note_added",
    follow_up: "follow_up_set",
  };
  return map[k] ?? ("status_changed" as ActivityLog["kind"]);
}

export function LiveActivitiesBridge() {
  const setActivities = useApp((s) => s.setActivities);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.activities.list({ entityType: "lead", entityId: "_all_", limit: 500 });
        if (cancelled) return;
        setActivities((r.items ?? []).map(toActivityLog));
      } catch (e) {
        console.warn("[LiveActivitiesBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      if (!e.type.startsWith("evt.activity.")) return;
      void load();
    });

    return () => { cancelled = true; off(); };
  }, [setActivities]);

  return null;
}
