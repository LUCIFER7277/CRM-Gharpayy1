import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import { dispatch } from "@/lib/api/command-bus";
import type { Lead, DomainEvent } from "@/contracts";

export function useLiveLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.leads.list({ limit: 100 });
      setLeads(r.items as Lead[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSocket(); // ensure connected
    void refresh();
    const off = onEvent((e: DomainEvent) => {
      if (e.type === "evt.lead.created") {
        setLeads((cur) =>
          cur.some((l) => l._id === e.payload.lead._id) ? cur : [e.payload.lead, ...cur],
        );
      } else if (e.type === "evt.lead.updated") {
        setLeads((cur) =>
          cur.map((l) => (l._id === e.payload.leadId ? ({ ...l, ...e.payload.patch } as Lead) : l)),
        );
      } else if (e.type === "evt.lead.assigned") {
        setLeads((cur) =>
          cur.map((l) =>
            l._id === e.payload.leadId ? { ...l, assignedTcmId: e.payload.tcmId } : l,
          ),
        );
      } else if (e.type === "evt.lead.stage_changed") {
        setLeads((cur) =>
          cur.map((l) =>
            l._id === e.payload.leadId ? { ...l, stage: e.payload.to as Lead["stage"] } : l,
          ),
        );
      } else if (e.type === "evt.lead.deleted") {
        setLeads((cur) => cur.filter((l) => l._id !== e.payload.leadId));
      }
    });
    return off;
  }, [refresh]);

  const createLead = useCallback(
    async (input: {
      name: string;
      phone: string;
      budget: number;
      preferredArea: string;
      moveInDate: string;
      source?: string;
    }) => {
      return dispatch({
        type: "cmd.lead.create",
        payload: {
          name: input.name,
          phone: input.phone,
          source: input.source ?? "manual",
          budget: input.budget,
          budgetText: "",
          moveInDate: input.moveInDate,
          preferredArea: input.preferredArea,
          zoneId: null,
        },
      });
    },
    [],
  );

  return { leads, loading, error, refresh, createLead };
}
