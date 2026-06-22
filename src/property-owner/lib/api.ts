/**
 * Property Owner API hooks
 *
 * All requests are authenticated via the common Gharpayy JWT stored in
 * tokenStore (localStorage key `gharpayy.access_token`). This is the same
 * token set by the common /api/auth/login endpoint when a user with
 * role "owner" signs in.
 *
 * No separate owner token or useOwnerStore — use useAuthUser from common auth.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "@/lib/api/client";

const getBackendUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  return "";
};

/** Build an Authorization header from the common JWT. */
function authHeaders(): HeadersInit {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Owner properties
// ---------------------------------------------------------------------------

export function useGetRealOwnerProperties() {
  return useQuery({
    queryKey: ["owner", "properties"],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/properties`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to fetch properties");
      return data.data.map((pg: any) => ({
        id: pg._id || pg.id,
        name: pg.name,
        address: pg.address || pg.locality || pg.area,
        monthlyRent: pg.basePrice || pg.pricePerBed || 0,
        totalRooms: pg.totalBeds || pg.totalRooms || 0,
        availableRooms: pg.vacantBeds || pg.availableRooms || 0,
        availability: (pg.availableRooms > 0 || pg.vacantBeds > 0) ? "AVAILABLE" : "FULL",
        isVerified: pg.isVerified ?? true,
        avgRating: pg.avgRating ?? undefined,
      }));
    },
  });
}

export function useAddRealOwnerProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to add property");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "properties"] });
      queryClient.invalidateQueries({ queryKey: ["owner", "stats"] });
    },
  });
}

export function useUpdatePropertyAvailability() {
  return useMutation({
    mutationFn: async (_args: { propertyId: number | string; data: any }) => {
      // Not yet implemented on Gharpayy-Ops server — will work once backend is ported
      return { success: true };
    },
  });
}

export function useCreateProperty() {
  return useMutation({
    mutationFn: async (_data: any) => {
      return { success: true };
    },
  });
}

// ---------------------------------------------------------------------------
// Owner stats (occupancy)
// ---------------------------------------------------------------------------

export function useGetOwnerStats() {
  return useQuery({
    queryKey: ["owner", "stats"],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/stats`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to fetch owner stats");
      return data.data as {
        overall: {
          totalProperties: number;
          totalBeds: number;
          occupiedBeds: number;
          vacantBeds: number;
          blockedBeds: number;
          occupancyPct: number;
        };
        properties: Array<{
          propertyId: string;
          propertyName: string;
          totalBeds: number;
          occupiedBeds: number;
          vacantBeds: number;
          blockedBeds: number;
          occupancyPct: number;
        }>;
      };
    },
  });
}

/**
 * @deprecated Use useGetOwnerStats() instead.
 * Kept for backward compat with inventory.tsx until it is fully updated.
 */
export function useGetManagerStats(_adminId?: number, _activeOwnerId?: string | null) {
  return useGetOwnerStats();
}

// ---------------------------------------------------------------------------
// Owner rooms
// ---------------------------------------------------------------------------

export function useGetRealOwnerRooms() {
  return useQuery({
    queryKey: ["owner", "rooms"],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to fetch rooms");
      return data.data as { rooms: any[]; roomStatuses: any[]; roomMedia: any[] };
    },
  });
}

export function useAddRealOwnerRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to add room");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "rooms"] });
    },
  });
}

export function useDeleteRealOwnerRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms/${roomId}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete room");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "rooms"] });
    },
  });
}

export function useUpdateRealOwnerRoomStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, data }: { roomId: string; data: any }) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms/${roomId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update room status");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "rooms"] });
    },
  });
}

export function useVerifyRealOwnerRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms/${roomId}/verify`, {
        method: "POST",
        headers: { ...authHeaders() },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to verify room");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "rooms"] });
    },
  });
}

export function useUpdateRoomDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, data }: { roomId: string; data: any }) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/rooms/${roomId}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update room details");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "rooms"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Owner visits
// ---------------------------------------------------------------------------

export function useGetOwnerVisits() {
  return useQuery({
    queryKey: ["owner", "visits"],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/visits`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to fetch visits");
      return data.data;
    },
  });
}

export function useAddOwnerVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to add visit");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "visits"] });
    },
  });
}

export function useUpdateOwnerVisitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, status }: { visitId: string; status: string }) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/visits/${visitId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update visit status");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "visits"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Owner actions (effort ledger)
// ---------------------------------------------------------------------------

export function useGetOwnerActions() {
  return useQuery({
    queryKey: ["owner", "actions"],
    queryFn: async () => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/actions`, {
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to fetch actions");
      return data.data;
    },
  });
}

export function useAddOwnerAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${getBackendUrl()}/api/v1/owner/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to add action");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", "actions"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Manager/admin views (used by admin pages, not owner portal directly)
// ---------------------------------------------------------------------------

export function useGetManagerProperties(adminId?: number, activeOwnerId?: string | null) {
  return useQuery({
    queryKey: ["admin", "properties", adminId, activeOwnerId],
    queryFn: async () => {
      const url = new URL(`${getBackendUrl()}/api/admin/properties`);
      if (activeOwnerId) url.searchParams.set("ownerId", activeOwnerId);
      const res = await fetch(url.toString(), { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error("Failed to fetch admin properties");
      return await res.json();
    },
  });
}
