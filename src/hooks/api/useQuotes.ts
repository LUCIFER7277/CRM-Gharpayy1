import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Quotation, QuotationStatus } from "@/types/entities";
import { queryKeys as leadKeys } from "./useLeads";

export const queryKeys = {
  all: ["quotes"] as const,
  filtered: (filters: Record<string, any>) => ["quotes", filters] as const,
};

export function useQuotes(filters: { tcmId?: string; leadId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.filtered(filters),
    queryFn: () => apiClient.get<Quotation[]>("/quotes", { params: filters }),
  });
}

export function useSendQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newQuote: Omit<Quotation, "id" | "status" | "sentAt">) =>
      apiClient.post<Quotation>("/quotes", newQuote),
    onSuccess: (createdQuote) => {
      queryClient.setQueryData(queryKeys.all, (old: Quotation[] = []) => [createdQuote, ...old]);
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, status, note }: { quoteId: string; status: QuotationStatus; note?: string }) =>
      apiClient.put<Quotation>(`/quotes/${quoteId}/status`, { status, paymentNote: note }),
    onMutate: async ({ quoteId, status, note }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.all });
      const previousQuotes = queryClient.getQueryData<Quotation[]>(queryKeys.all);
      
      queryClient.setQueryData(queryKeys.all, (old: Quotation[] = []) =>
        old.map((q) => (q.id === quoteId ? { ...q, status, paymentNote: note ?? q.paymentNote, paidAt: status === "paid" ? new Date().toISOString() : q.paidAt } : q))
      );
      
      return { previousQuotes };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(queryKeys.all, context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
