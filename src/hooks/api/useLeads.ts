import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Lead, LeadStage, Intent } from "@/types/entities";

export const queryKeys = {
  all: ["leads"] as const,
  filtered: (filters: Record<string, any>) => ["leads", filters] as const,
  detail: (id: string) => ["leads", id] as const,
};

export function useLeads(filters: { tcmId?: string; intent?: Intent } = {}) {
  return useQuery({
    queryKey: queryKeys.filtered(filters),
    queryFn: () => apiClient.get<Lead[]>("/leads", { params: filters }),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLead: Partial<Lead>) => apiClient.post<Lead>("/leads", newLead),
    onSuccess: (createdLead) => {
      // Invalidate or optimistic update
      queryClient.setQueryData(queryKeys.all, (old: Lead[] = []) => [createdLead, ...old]);
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, stage }: { leadId: string; stage: LeadStage }) =>
      apiClient.put<Lead>(`/leads/${leadId}/stage`, { stage }),
    onMutate: async ({ leadId, stage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.all });
      const previousLeads = queryClient.getQueryData<Lead[]>(queryKeys.all);
      
      queryClient.setQueryData(queryKeys.all, (old: Lead[] = []) =>
        old.map((l) => (l.id === leadId ? { ...l, stage, updatedAt: new Date().toISOString() } : l))
      );
      
      // Also update any filtered caches if needed, though invalidation handles it globally
      return { previousLeads };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(queryKeys.all, context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

export function useUpdateLeadIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, intent }: { leadId: string; intent: Intent }) =>
      apiClient.put<Lead>(`/leads/${leadId}/intent`, { intent }),
    onMutate: async ({ leadId, intent }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.all });
      const previousLeads = queryClient.getQueryData<Lead[]>(queryKeys.all);
      
      queryClient.setQueryData(queryKeys.all, (old: Lead[] = []) =>
        old.map((l) => (l.id === leadId ? { ...l, intent } : l))
      );
      
      return { previousLeads };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(queryKeys.all, context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}
