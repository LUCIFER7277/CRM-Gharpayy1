// Frontend API client. Reads VITE_API_URL from env. Sends Bearer token from localStorage.
// Server is hosted on YOUR VPS - set VITE_API_URL to e.g. https://api.gharpayy.com
//
// Falls back to a localStorage adapter when VITE_API_URL is unset or the
// server is unreachable - so todos / activities work end-to-end even before
// the VPS is provisioned. As soon as VITE_API_URL is set and reachable,
// real network mode kicks in automatically.
import { localAdapter, isLocalMode } from "./local-adapter";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "gharpayy.access_token";
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const inFlightGetRequests = new Map<string, Promise<unknown>>();

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError("NO_API_URL", "VITE_API_URL not configured", 0);
  const headers = new Headers(init.headers ?? {});
  if (init.body != null && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const t = tokenStore.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const method = (init.method ?? "GET").toUpperCase();
  const dedupeKey =
    method === "GET" && init.body == null ? `${API_URL}${path}::${t ?? "anon"}` : null;
  if (dedupeKey) {
    const existing = inFlightGetRequests.get(dedupeKey);
    if (existing) return existing as Promise<T>;
  }

  const runRequest = async (): Promise<T> => {
    if (import.meta.env.DEV) {
      console.debug("[api.request]", method, `${API_URL}${path}`, {
        headers: Array.from(headers.entries()),
        credentials: "include",
        body: init.body,
      });
    }
    let lastError: Error = new Error("Request failed after retries");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${API_URL}${path}`, {
          ...init,
          headers,
          credentials: "include",
          mode: "cors",
        });
        const text = await res.text();
        const body = text ? safeJson(text) : null;
        if (import.meta.env.DEV) {
          console.debug("[api.response]", method, `${API_URL}${path}`, res.status, body);
        }
        if (!res.ok) {
          if (res.status === 429) {
            const retryAfterValue = Number(body?.retryAfter ?? res.headers.get("Retry-After") ?? 2);
            const retryAfter =
              Number.isFinite(retryAfterValue) && retryAfterValue > 0 ? retryAfterValue : 2;
            if (attempt < 3) {
              console.warn(
                `[API] Rate limited, retrying in ${retryAfter} seconds (attempt ${attempt}/3)`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
              continue;
            }
          }
          throw new ApiError(
            body?.code ?? "INTERNAL",
            body?.message ?? res.statusText,
            res.status,
            body?.details,
          );
        }
        return body as T;
      } catch (e) {
        lastError = e as Error;
        if (attempt === 3) break;
        if ((e as ApiError)?.status !== 429) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError;
  };

  if (!dedupeKey) return runRequest();

  const inFlight = runRequest().finally(() => {
    inFlightGetRequests.delete(dedupeKey);
  });
  inFlightGetRequests.set(dedupeKey, inFlight);
  return inFlight as Promise<T>;
}
function safeJson(t: string): any {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

async function safe<T>(networkFn: () => Promise<T>, localFn: () => T): Promise<T> {
  if (isLocalMode()) return localFn();
  return await networkFn();
}

// ---------- Types shared with Settings UI ----------
export type ManagedRole = "manager" | "admin" | "member" | "owner" | "tcm";
export type AnyRole = "super_admin" | ManagedRole;
export type UserStatus = "active" | "inactive" | "invited" | "deleted";

export interface ManagedUser {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  phone: string;
  username: string;
  role: AnyRole;
  isTcm?: boolean;
  status: UserStatus;
  zones: string[];
  managerId?: string | null;
  adminId?: string | null;
  adminIds?: string[];
  memberIds?: string[];
  createdAt: string;
}

export interface Zone {
  id: string;
  name: string;
  city: string;
  areas: string[];
  color: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface ZoneInput {
  name: string;
  city?: string;
  areas?: string[];
  color?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  role: AnyRole;
  status: UserStatus;
  zones: string[];
  scopes: string[];
  isTcm?: boolean;
  name?: string;
}

export const api = {
  apiUrl: API_URL || "(local mode)",
  isLocalMode,

  health: () => request<{ ok: true; ts: string }>("/api/health"),

  signup: (b: { email: string; password: string; name: string; role?: ManagedRole }) =>
    request<{ ok: true; userId: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(b),
    }),

  login: async (identifier: string, password: string) => {
    const r = await request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: identifier, username: identifier, password }),
    });
    tokenStore.set(r.token);
    return r;
  },

  logout: async () => {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    tokenStore.clear();
  },

  auth: {
    me: () => request<{ user: AuthUser }>("/api/auth/me"),
    update: (b: { password?: string; phone?: string; fullName?: string; isTcm?: boolean }) =>
      request<{ ok: true }>("/api/auth/update", { method: "PATCH", body: JSON.stringify(b) }),
  },

  command: <R = unknown>(
    cmd: { _id: string; type: string; payload: Record<string, unknown> } & Record<string, unknown>,
  ) =>
    safe<R>(
      () =>
        request<R>("/api/commands", {
          method: "POST",
          headers: { "Idempotency-Key": cmd._id },
          body: JSON.stringify(cmd),
        }),
      () => localAdapter.command(cmd) as unknown as R,
    ),

  leads: {
    list: (q: Record<string, string | number> = {}) =>
      safe<{ items: unknown[]; nextCursor: string | null }>(
        () => {
          const qs = new URLSearchParams(
            Object.entries(q).map(([k, v]) => [k, String(v)]),
          ).toString();
          return request<{ items: unknown[]; nextCursor: string | null }>(
            `/api/leads${qs ? `?${qs}` : ""}`,
          );
        },
        () =>
          localAdapter.listLeads({
            limit: typeof q.limit === "number" ? q.limit : Number(q.limit ?? 100),
          }),
      ),
    get: (id: string) => request<unknown>(`/api/leads/${id}`),
    checkDuplicate: (phone: string) => request<{ exists: boolean; leadId?: string; owner?: string; currentStage?: string; name?: string }>(`/api/leads/check-duplicate?phone=${phone}`),
    parseLead: async (text: string) => {
      if (isLocalMode()) {
        const t = tokenStore.get();
        const baseUrl = (import.meta.env.VITE_API_URL as string) || "";
        const res = await fetch(`${baseUrl}/api/leads/parse`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {})
          },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error("Local backend unavailable or failed");
        return res.json();
      }
      return request<any>("/api/leads/parse", { method: "POST", body: JSON.stringify({ text }) });
    },
  },

  todos: {
    list: <T = import("@/contracts").Todo>(q: Record<string, string> = {}) =>
      safe<{ items: T[] }>(
        () => {
          const qs = new URLSearchParams(q).toString();
          return request<{ items: T[] }>(`/api/todos${qs ? `?${qs}` : ""}`);
        },
        () => localAdapter.listTodos(q) as unknown as { items: T[] },
      ),
  },

  activities: {
    list: <T = import("@/contracts").Activity>(q: {
      entityType: string;
      entityId: string;
      kind?: string;
      limit?: number;
    }) =>
      safe<{ items: T[] }>(
        () => {
          const qs = new URLSearchParams(
            Object.entries(q).map(([k, v]) => [k, String(v)]),
          ).toString();
          return request<{ items: T[] }>(`/api/activities?${qs}`);
        },
        () => localAdapter.listActivities(q) as unknown as { items: T[] },
      ),
  },

  tours: {
    list: () =>
      safe<{ items: import("@/contracts").Tour[]; nextCursor: string | null }>(
        () =>
          request<{ items: import("@/contracts").Tour[]; nextCursor: string | null }>(`/api/tours`),
        () => localAdapter.listTours(),
      ),
    update: (tourId: string, updates: Record<string, unknown>) =>
      request<{ ok: boolean }>(`/api/tours/${tourId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
  },

  // ---------- User management (super_admin) ----------
  users: {
    list: (status?: UserStatus) =>
      request<ManagedUser[]>(`/api/users${status ? `?status=${status}` : ""}`),
    listLite: () =>
      safe<{
        items: { _id: string; name: string; email: string; role: string; isTcm?: boolean }[];
      }>(
        () =>
          request<{
            items: { _id: string; name: string; email: string; role: string; isTcm?: boolean }[];
          }>("/api/users/list"),
        () => localAdapter.listUsers(),
      ),
    impersonate: (id: string) =>
      request<{ ok: true }>("/api/auth/impersonate", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),
    returnToSelf: () => request<{ ok: true }>("/api/auth/return"),
    get: (id: string) => request<ManagedUser>(`/api/users/${id}`),
    create: (b: {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
      role: ManagedRole;
      zones?: string[];
    }) => request<ManagedUser>("/api/users", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Record<string, unknown>) =>
      request<ManagedUser>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    resetPassword: (id: string, password: string) =>
      request<{ ok: true }>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
    setStatus: (id: string, action: "activate" | "deactivate" | "delete") =>
      request<{ ok: true }>(`/api/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
  },

  managers: {
    list: () => request<(ManagedUser & { admins: ManagedUser[] })[]>("/api/managers"),
  },
  admins: {
    list: () => request<ManagedUser[]>("/api/admins"),
  },
  members: {
    list: () => request<ManagedUser[]>("/api/members"),
  },
  tcms: {
    list: () => request<ManagedUser[]>("/api/tcms"),
  },
  owners: {
    list: () => request<ManagedUser[]>("/api/owners"),
  },
  zones: {
    list: () => request<Zone[]>("/api/zones"),
    create: (input: ZoneInput) =>
      request<Zone>("/api/zones", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: ZoneInput) =>
      request<Zone>(`/api/zones/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ ok: true }>(`/api/zones/${id}`, { method: "DELETE" }),
  },
  properties: {
    list: () => request<import("@/lib/types").Property[]>("/api/properties"),
    create: (input: any) =>
      request<import("@/lib/types").Property>("/api/properties", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: any) =>
      request<import("@/lib/types").Property>(`/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<{ ok: true }>(`/api/properties/${id}`, { method: "DELETE" }),
  },

  followUps: {
    list: (q: { leadId?: string; done?: boolean; limit?: number } = {}) =>
      request<{ items: Record<string, unknown>[] }>(
        `/api/follow-ups?${new URLSearchParams(
          Object.entries(q).map(([k, v]) => [k, String(v)]),
        ).toString()}`,
      ),
    create: (input: {
      leadId: string;
      tourId?: string;
      tcmId: string;
      dueAt: string;
      priority: "high" | "medium" | "low" | "urgent";
      reason?: string;
    }) =>
      request<Record<string, unknown>>("/api/follow-ups", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, patch: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/api/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  handoffs: {
    list: (q: { leadId?: string; limit?: number } = {}) =>
      request<{ items: Record<string, unknown>[] }>(
        `/api/handoffs?${new URLSearchParams(
          Object.entries(q).map(([k, v]) => [k, String(v)]),
        ).toString()}`,
      ),
    create: (input: {
      leadId: string;
      from: string;
      fromId: string;
      to: string;
      text: string;
      priority: "normal" | "urgent";
    }) =>
      request<Record<string, unknown>>("/api/handoffs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    markRead: (leadId: string) =>
      request<{ modifiedCount: number }>("/api/handoffs/mark-read", {
        method: "POST",
        body: JSON.stringify({ leadId }),
      }),
  },
  sequences: {
    list: (q: { leadId?: string; active?: boolean; limit?: number } = {}) =>
      request<{ items: Record<string, unknown>[] }>(
        `/api/sequences?${new URLSearchParams(
          Object.entries(q).map(([k, v]) => [k, String(v)]),
        ).toString()}`,
      ),
    create: (input: { leadId: string; kind: string }) =>
      request<Record<string, unknown>>("/api/sequences", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, patch: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/api/sequences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  stats: {
    dailyProgress: (date?: string) => {
      const qs = date ? `?date=${encodeURIComponent(date)}` : "";
      return request<import("@/lib/stats-types").LeadsDailyProgressResponse>(
        `/api/stats/daily-progress${qs}`,
      );
    },
    leaderboard: (
      period: import("@/lib/stats-types").LeaderboardPeriod = "this_month",
      zone?: string,
      customRange?: { from: string; to: string },
    ) => {
      const params = new URLSearchParams({ period });
      if (zone && zone !== "all") params.set("zone", zone);
      if (period === "custom" && customRange?.from && customRange?.to) {
        params.set("from", customRange.from);
        params.set("to", customRange.to);
      }
      return request<import("@/lib/stats-types").CreatorLeaderboardResponse>(
        `/api/stats/leaderboard?${params.toString()}`,
      );
    },
  },

  activity: {
    login: (limit = 100) =>
      request<{
        items: {
          _id: string;
          type: string;
          occurredAt: string;
          payload: Record<string, unknown>;
        }[];
      }>(`/api/activity/login?limit=${limit}`),
    all: (limit = 200) =>
      request<{
        items: {
          _id: string;
          type: string;
          occurredAt: string;
          payload: Record<string, unknown>;
        }[];
      }>(`/api/activity/all?limit=${limit}`),
    lead: (leadId: string, limit = 200) =>
      request<{
        items: {
          _id: string;
          type: string;
          occurredAt: string;
          payload: Record<string, unknown>;
        }[];
      }>(`/api/activity/lead?leadId=${encodeURIComponent(leadId)}&limit=${limit}`),
  },

  bookings: {
    list: (q: Record<string, string | number> = {}) =>
      safe<{ items: import("@/contracts").BookingEntity[]; nextCursor: string | null }>(
        () => {
          const qs = new URLSearchParams(
            Object.entries(q).map(([k, v]) => [k, String(v)]),
          ).toString();
          return request<{ items: import("@/contracts").BookingEntity[]; nextCursor: string | null }>(
            `/api/bookings${qs ? `?${qs}` : ""}`,
          );
        },
        () => ({ items: [], nextCursor: null }),
      ),
    get: (id: string) =>
      request<import("@/contracts").BookingEntity>(`/api/bookings/${id}`),
  },

  tenants: {
    list: (q: Record<string, string | number> = {}) =>
      safe<{ items: import("@/contracts").TenantEntity[]; nextCursor: string | null }>(
        () => {
          const qs = new URLSearchParams(
            Object.entries(q).map(([k, v]) => [k, String(v)]),
          ).toString();
          return request<{ items: import("@/contracts").TenantEntity[]; nextCursor: string | null }>(
            `/api/tenants${qs ? `?${qs}` : ""}`,
          );
        },
        () => ({ items: [], nextCursor: null }),
      ),
    get: (id: string) =>
      request<import("@/contracts").TenantEntity>(`/api/tenants/${id}`),
  },

  assignmentNotifications: {
    /** Fetch pending assignment notifications addressed to the current user */
    listPending: () =>
      safe<{ items: AssignmentNotificationItem[] }>(
        () => request<{ items: AssignmentNotificationItem[] }>("/api/assignment-notifications"),
        () => ({ items: [] }),
      ),
    /** Fetch notifications that were passed on (so the original assigner is informed) */
    listPassed: () =>
      safe<{ items: AssignmentNotificationItem[] }>(
        () =>
          request<{ items: AssignmentNotificationItem[] }>("/api/assignment-notifications/passed"),
        () => ({ items: [] }),
      ),
  },
};

/** Shape of an assignment notification returned from the server */
export interface AssignmentNotificationItem {
  _id: string;
  tenantId: string;
  type: "lead" | "tour";
  entityId: string;
  leadId: string;
  leadName: string;
  assignedById: string;
  assignedByName: string;
  assignedToId: string;
  status: "pending" | "accepted" | "passed";
  passedToId?: string;
  passedChain: string[];
  createdAt: string;
  updatedAt: string;
}
