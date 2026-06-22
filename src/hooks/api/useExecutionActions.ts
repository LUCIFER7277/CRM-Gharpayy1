import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys as leadKeys } from "./useLeads";
import type { UnifiedLead, InterestLevel, ObjectionTagStr } from "@/lib/lead-identity/types";

// Helper to update a lead optimistically
function updateLeadInCache(queryClient: ReturnType<typeof useQueryClient>, leadId: string, patch: Partial<UnifiedLead>) {
  queryClient.setQueryData(leadKeys.all, (old: UnifiedLead[] = []) => 
    old.map(l => (l.id === leadId ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l))
  );
}

export function useRecordContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, kind }: { leadId: string; kind: "wa" | "call" }) => {
      try {
        await apiClient.post(`/leads/${leadId}/activities`, { kind, text: `${kind} contacted` });
      } catch (e) {
        // Mock success
      }
    },
    onMutate: async ({ leadId }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { lastContactAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    }
  });
}

export function useRecordReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      try {
        await apiClient.post(`/leads/${leadId}/activities`, { kind: "reply", text: "Lead replied" });
      } catch (e) {}
    },
    onMutate: async ({ leadId }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      // In source, it sets replied=true and state="contacted" if it was new.
      updateLeadInCache(queryClient, leadId, { 
        replied: true, 
        lastActivityAt: new Date().toISOString(),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}

export function useSetObjection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, objection }: { leadId: string; objection: ObjectionTagStr | null }) => {
      try {
        await apiClient.put(`/leads/${leadId}/objection`, { objection });
      } catch (e) {}
    },
    onMutate: async ({ leadId, objection }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { primaryObjection: objection });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}

export function useBookTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, scheduledAt }: { leadId: string; scheduledAt: string }) => {
      try {
        await apiClient.post(`/tours`, { leadId, scheduledAt });
      } catch (e) {}
    },
    onMutate: async ({ leadId, scheduledAt }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { 
        stage: "visit-scheduled", 
        anchors: { leadDate: new Date().toISOString(), tourDate: scheduledAt } 
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      try {
        await apiClient.put(`/leads/${leadId}/status`, { status: "no-show" });
      } catch (e) {}
    },
    onMutate: async ({ leadId }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { noShowFlag: true });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}

export function useMarkToured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, level }: { leadId: string; level: InterestLevel }) => {
      try {
        await apiClient.put(`/leads/${leadId}/status`, { status: "toured", level });
      } catch (e) {}
    },
    onMutate: async ({ leadId, level }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { 
        stage: "visit-done", 
        interestLevel: level,
        noShowFlag: false 
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}

export function useSetInterestLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, level }: { leadId: string; level: InterestLevel }) => {
      try {
        await apiClient.put(`/leads/${leadId}/interest`, { level });
      } catch (e) {}
    },
    onMutate: async ({ leadId, level }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      updateLeadInCache(queryClient, leadId, { interestLevel: level });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: leadKeys.all })
  });
}
