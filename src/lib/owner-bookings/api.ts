/**
 * Owner Bookings — Backend API client (Phase E)
 *
 * Connects the owner portal's bookings/approvals pages to the real
 * MongoDB-backed booking data via the new /api/v1/owner/* endpoints.
 *
 * Auth: common JWT via tokenStore (already set by common login).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "@/lib/api/client";

const BASE = () => (import.meta.env.VITE_API_URL as string | undefined ?? "").replace(/\/$/, "");

function authHeaders(): HeadersInit {
  const token = tokenStore.get();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function ownerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed: ${path}`);
  return json.data ?? json;
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export function useOwnerBookingsFromApi(opts?: { lifecycle?: string }) {
  return useQuery({
    queryKey: ["owner-bookings-api", opts?.lifecycle],
    queryFn: () => {
      const qs = opts?.lifecycle ? `?lifecycle=${opts.lifecycle}` : "";
      return ownerFetch<any[]>(`/api/v1/owner/bookings${qs}`);
    },
    staleTime: 30_000,
  });
}

export function useOwnerPendingBookingsFromApi() {
  return useQuery({
    queryKey: ["owner-bookings-api-pending"],
    queryFn: () => ownerFetch<any[]>("/api/v1/owner/bookings/pending"),
    staleTime: 15_000,
  });
}

export function useOwnerBookingLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, action, note }: { bookingId: string; action: string; note?: string }) =>
      ownerFetch(`/api/v1/owner/bookings/${bookingId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({ action, note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-bookings-api"] });
      qc.invalidateQueries({ queryKey: ["owner-bookings-api-pending"] });
    },
  });
}

export function useOwnerBookingDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, decision, note }: { bookingId: string; decision: string; note?: string }) =>
      ownerFetch(`/api/v1/owner/bookings/${bookingId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-bookings-api"] });
      qc.invalidateQueries({ queryKey: ["owner-bookings-api-pending"] });
    },
  });
}

export function useOwnerBookingReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, key, status }: { bookingId: string; key: string; status: string }) =>
      ownerFetch(`/api/v1/owner/bookings/${bookingId}/readiness`, {
        method: "PATCH",
        body: JSON.stringify({ key, status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-bookings-api"] });
    },
  });
}

// ── Share-with-owner (flow-ops / admin side) ─────────────────────────────────

export function useShareBookingWithOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      fetch(`${BASE()}/api/bookings/${bookingId}/share-with-owner`, {
        method: "POST",
        headers: authHeaders(),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-bookings-api"] });
    },
  });
}
