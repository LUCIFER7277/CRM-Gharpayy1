import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { joinAdmin, type AdminLeadRow } from "./selectors";

export function useAdminRows(): AdminLeadRow[] {
  const { leads, tours, tcms, bookings, followUps } = useApp();
  const crm = useCRM10x();
  const visits = useVisitWar((s) => s.records);
  return useMemo(() => {
    return joinAdmin({
      leads,
      tours,
      tcms,
      bookings,
      followUps,
      profiles: crm.profiles,
      objections: crm.objections,
      calls: crm.calls,
      visits,
      assignments: crm.assignments,
      coachingNotes: crm.coachingNotes,
      messageOutcomes: crm.messageOutcomes,
    });
  }, [
    leads,
    tours,
    tcms,
    bookings,
    followUps,
    crm.profiles,
    crm.objections,
    crm.calls,
    visits,
    crm.assignments,
    crm.coachingNotes,
    crm.messageOutcomes,
  ]);
}
