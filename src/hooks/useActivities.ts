// Realtime activity timeline hook for any (entityType, entityId).
// Subscribes to evt.activity.* + lead/todo events that affect timeline freshness.
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import { dispatch } from "@/lib/api/command-bus";
import type { Activity, ActivityEntityType, ActivityKind, DomainEvent } from "@/contracts";

export interface UseActivitiesOpts {
  entityType: ActivityEntityType;
  entityId: string;
  kind?: ActivityKind;
}

export function useActivities({ entityType, entityId, kind }: UseActivitiesOpts) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.activities.list({ entityType, entityId, kind, limit: 200 });
      setActivities(r.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [entityType, entityId, kind]);

  useEffect(() => {
    if (!entityId) return;
    getSocket();
    void refresh();
    const off = onEvent((e: DomainEvent) => {
      if (e.type === "evt.activity.logged" && e.payload.activity.entityType === entityType && e.payload.activity.entityId === entityId) {
        setActivities((cur) => (cur.some((a) => a._id === e.payload.activity._id) ? cur : [e.payload.activity, ...cur]));
      } else if (e.type === "evt.activity.deleted" && e.payload.entityType === entityType && e.payload.entityId === entityId) {
        setActivities((cur) => cur.filter((a) => a._id !== e.payload.activityId));
      } else if (
        (e.type === "evt.lead.updated" || e.type === "evt.lead.assigned" || e.type === "evt.lead.stage_changed")
        && entityType === "lead"
        && (("leadId" in e.payload ? e.payload.leadId : null) === entityId)
      ) {
        // server auto-logs an activity for these - refetch to pick it up
        void refresh();
      }
    });
    return off;
  }, [entityType, entityId, refresh]);

  const log = useCallback(async (input: {
    kind: ActivityKind;
    subject: string;
    body?: string;
    direction?: "inbound" | "outbound" | "internal";
    outcome?: Activity["outcome"];
    durationSec?: number;
    occurredAt?: string;
    scheduledFor?: string | null;
  }) => {
    return dispatch({
      type: "cmd.activity.log",
      payload: {
        entityType, entityId,
        kind: input.kind,
        subject: input.subject,
        body: input.body,
        direction: input.direction,
        outcome: input.outcome ?? null,
        durationSec: input.durationSec,
        occurredAt: input.occurredAt,
        scheduledFor: input.scheduledFor ?? null,
      },
    });
  }, [entityType, entityId]);

  const remove = useCallback((activityId: string) => dispatch({ type: "cmd.activity.delete", payload: { activityId } }), []);

  return { activities, loading, error, refresh, log, remove };
}
