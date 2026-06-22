/**
 * useLeadIntel - one hook to compute lead score, SLA, best-time, dossier
 * and next-best-action for a single live lead. Recomputes whenever the
 * lead, its activities or its todos change (all already realtime via the
 * event bus). Tick every 60s so SLA timers stay live without re-fetching.
 */
import { useMemo } from "react";
import { useNow } from "@/hooks/use-now";
import { useActivities } from "@/hooks/useActivities";
import { useTodos } from "@/hooks/useTodos";
import type { Lead } from "@/contracts";
import {
  scoreLead, slaFor, bestTimeToContact, summariseLead,
  type LeadScore, type SlaState, type BestTimeWindow, type DossierSummary,
} from "@/lib/intel-core";

export interface LeadIntel {
  score: LeadScore;
  sla: SlaState;
  bestTime: BestTimeWindow;
  dossier: DossierSummary;
  loading: boolean;
}

export function useLeadIntel(lead: Lead | null | undefined): LeadIntel | null {
  // Force a re-render every 60s so SLA countdown stays accurate.
  useNow(60_000);
  const { activities, loading: aLoad } = useActivities({
    entityType: "lead",
    entityId: lead?._id ?? "",
  });
  const { todos, loading: tLoad } = useTodos({
    entityType: "lead",
    entityId: lead?._id ?? null,
  });

  return useMemo(() => {
    if (!lead) return null;
    const score = scoreLead(lead, activities, todos);
    const sla = slaFor(lead, activities[0]?.occurredAt);
    const bestTime = bestTimeToContact(activities);
    const dossier = summariseLead(lead, activities, todos);
    return { score, sla, bestTime, dossier, loading: aLoad || tLoad };
  }, [lead, activities, todos, aLoad, tLoad]);
}
