import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Tour, TourStatus } from "@/types/entities";
import { queryKeys as leadKeys } from "./useLeads";

export const queryKeys = {
  all: ["tours"] as const,
  filtered: (filters: Record<string, any>) => ["tours", filters] as const,
};

export function useTours(filters: { tcmId?: string; propertyId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.filtered(filters),
    queryFn: () => apiClient.get<Tour[]>("/tours", { params: filters }),
  });
}

export function useScheduleTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newTour: Omit<Tour, "id" | "createdAt" | "updatedAt" | "postTour" | "status" | "decision">) =>
      apiClient.post<Tour>("/tours", newTour),
    onSuccess: (createdTour) => {
      queryClient.setQueryData(queryKeys.all, (old: Tour[] = []) => [createdTour, ...old]);
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: leadKeys.all }); // Lead stage might change
    },
  });
}

export function useUpdateTourStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tourId, status }: { tourId: string; status: TourStatus }) =>
      apiClient.put<Tour>(`/tours/${tourId}/status`, { status }),
    onMutate: async ({ tourId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.all });
      const previousTours = queryClient.getQueryData<Tour[]>(queryKeys.all);
      
      queryClient.setQueryData(queryKeys.all, (old: Tour[] = []) =>
        old.map((t) => (t.id === tourId ? { ...t, status, updatedAt: new Date().toISOString() } : t))
      );
      
      return { previousTours };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousTours) {
        queryClient.setQueryData(queryKeys.all, context.previousTours);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
      queryClient.invalidateQueries({ queryKey: leadKeys.all }); // Lead stage changes
    },
  });
}
