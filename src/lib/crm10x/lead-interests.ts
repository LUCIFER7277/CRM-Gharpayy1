import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

// Local fallback until backend implements GET/POST /leads/:id/interests.
// Keep it persisted so Impact shortlists survive browser refreshes.
const FALLBACK_KEY = "gharpayy.lead-interests.v1";

function readFallbackStore(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) as Record<string, string[]> : {};
  } catch {
    return {};
  }
}

function writeFallbackStore(next: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // ignore local fallback write failures
  }
}

let mockStore: Record<string, string[]> = readFallbackStore();

export function useLeadInterests(leadId: "all"): UseQueryResult<Record<string, string[]>>;
export function useLeadInterests(leadId: string): UseQueryResult<string[]>;
export function useLeadInterests(leadId: string): UseQueryResult<string[] | Record<string, string[]>> {
  return useQuery({
    queryKey: ["leadInterests", leadId],
    queryFn: async () => {
      if (leadId === "all") {
        return mockStore;
      }
      return mockStore[leadId] || [];
    },
  });
}

export function useToggleInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, propertyId }: { leadId: string; propertyId: string }) => {
      const cur = mockStore[leadId] || [];
      mockStore[leadId] = cur.includes(propertyId)
        ? cur.filter((x) => x !== propertyId)
        : [...cur, propertyId];
      writeFallbackStore(mockStore);
    },
    onMutate: async ({ leadId, propertyId }) => {
      await queryClient.cancelQueries({ queryKey: ["leadInterests", leadId] });
      const prev = queryClient.getQueryData<string[]>(["leadInterests", leadId]) || [];
      const next = prev.includes(propertyId) ? prev.filter(x => x !== propertyId) : [...prev, propertyId];
      queryClient.setQueryData(["leadInterests", leadId], next);
      return { prev };
    },
    onError: (_err, { leadId }, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["leadInterests", leadId], context.prev);
      }
    },
    onSettled: (_data, _err, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["leadInterests", leadId] });
    },
  });
}

export function useClearInterests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      mockStore[leadId] = [];
      writeFallbackStore(mockStore);
    },
    onMutate: async ({ leadId }) => {
      await queryClient.cancelQueries({ queryKey: ["leadInterests", leadId] });
      queryClient.setQueryData(["leadInterests", leadId], []);
    },
    onSettled: (_data, _err, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["leadInterests", leadId] });
    },
  });
}
