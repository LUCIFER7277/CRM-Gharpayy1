// Zustand store for the Lead Identity, Dedup & Ownership system.
// Mock layer - replaced by Lovable Cloud in the next pass.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  UnifiedLead, AccessRequest, ActivityEntry, ParsedLeadDraft,
  MatchResult, ActivityKind, LifecycleState,
} from "./types";
import { newUlid, normalizePhoneIN, normalizeEmail, parseBudgetToNumber } from "./normalize";
import { findMatches } from "./similarity";

interface CurrentUser {
  id: string;
  name: string;
  role: "agent" | "manager";
}

interface IdentityStore {
  leads: UnifiedLead[];
  activities: ActivityEntry[];
  requests: AccessRequest[];
  currentUser: CurrentUser;
  setCurrentUser: (u: CurrentUser) => void;

  /** Run dedup against current store using a parsed draft. */
  checkDuplicates: (draft: Partial<ParsedLeadDraft>) => MatchResult;

  /** Create a new unified lead from a parsed draft. Caller has already resolved dedup. */
  createLead: (
    draft: ParsedLeadDraft,
    opts?: {
      ownerId?: string;
      ownerName?: string;
      quality?: import("./types").LeadQuality;
      stage?: string;
      assigneeId?: string | null;
      assigneeName?: string | null;
      zoneCategory?: string;
    },
  ) => UnifiedLead;

  /** Append an activity to a lead's timeline. */
  logActivity: (leadId: string, kind: ActivityKind, text: string, meta?: Record<string, unknown>) => void;

  requestAccess: (leadId: string, message?: string) => AccessRequest | null;
  decideRequest: (id: string, decision: "approved" | "rejected") => void;

  setSecondaryOwner: (leadId: string, ownerId: string, ownerName: string) => void;
  reassignPrimary: (leadId: string, ownerId: string, ownerName: string, reason: string) => void;
  setLifecycleState: (leadId: string, state: LifecycleState) => void;

  getLead: (leadId: string) => UnifiedLead | undefined;
  getActivities: (leadId: string) => ActivityEntry[];
  getRequestsForOwner: (ownerId: string) => AccessRequest[];
  getRequestsByMe: (userId: string) => AccessRequest[];
}

const nowIso = () => new Date().toISOString();

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set, get) => ({
      leads: [],
      activities: [],
      requests: [],
      currentUser: { id: "u-self", name: "You", role: "agent" },

      setCurrentUser: (u) => set({ currentUser: u }),

      checkDuplicates: (draft) => {
        const phoneE164 = normalizePhoneIN(draft.phone ?? "");
        const emailNorm = normalizeEmail(draft.email ?? "");
        return findMatches(
          { phoneE164, emailNorm, name: draft.name, area: draft.location },
          get().leads,
        );
      },

      createLead: (draft, opts) => {
        const user = get().currentUser;
        const ownerId = opts?.ownerId ?? user.id;
        const ownerName = opts?.ownerName ?? user.name;
        const ts = nowIso();
        const lead: UnifiedLead = {
          id: newUlid(),
          name: draft.name || "Unnamed Lead",
          phoneRaw: draft.phone,
          phoneE164: normalizePhoneIN(draft.phone),
          email: draft.email,
          emailNorm: normalizeEmail(draft.email),
          area: draft.location,
          areas: draft.areas,
          fullAddress: draft.fullAddress,
          zone: draft.zone,
          zoneCategory: opts?.zoneCategory,
          quality: opts?.quality ?? null,
          stage: opts?.stage,
          assigneeId: opts?.assigneeId ?? null,
          assigneeName: opts?.assigneeName ?? null,
          budget: parseBudgetToNumber(draft.budget),
          moveInDate: draft.moveIn,
          type: draft.type,
          room: draft.room,
          need: draft.need,
          inBLR: draft.inBLR,
          notes: draft.specialReqs,
          extraContent: draft.extraContent,
          summary: draft.summary,
          budgets: draft.budgets,
          links: draft.links,
          geoIntel: draft.geoIntel,
          state: "new",
          primaryOwnerId: ownerId,
          secondaryOwnerId: null,
          createdAt: ts,
          updatedAt: ts,
          lastActivityAt: ts,
          rawSource: draft.rawSource,
        };
        set((s) => ({ leads: [lead, ...s.leads] }));
        get().logActivity(lead.id, "lead-created", `Lead created by ${ownerName}`);
        return lead;
      },

      logActivity: (leadId, kind, text, meta) => {
        const user = get().currentUser;
        const entry: ActivityEntry = {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          leadId, ts: nowIso(),
          actorId: user.id, actorName: user.name,
          kind, text, meta,
        };
        set((s) => ({
          activities: [entry, ...s.activities],
          leads: s.leads.map((l) => l.id === leadId ? { ...l, lastActivityAt: entry.ts, updatedAt: entry.ts } : l),
        }));
      },

      requestAccess: (leadId, message) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return null;
        const user = get().currentUser;
        if (lead.primaryOwnerId === user.id) return null;
        // Already pending?
        const existing = get().requests.find(
          (r) => r.leadId === leadId && r.requesterId === user.id && r.state === "pending",
        );
        if (existing) return existing;
        const req: AccessRequest = {
          id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          leadId,
          requesterId: user.id,
          requesterName: user.name,
          toOwnerId: lead.primaryOwnerId,
          ts: nowIso(),
          state: "pending",
          message,
        };
        set((s) => ({ requests: [req, ...s.requests] }));
        get().logActivity(leadId, "access-requested", `${user.name} requested access`);
        return req;
      },

      decideRequest: (id, decision) => {
        const req = get().requests.find((r) => r.id === id);
        if (!req) return;
        const ts = nowIso();
        set((s) => ({
          requests: s.requests.map((r) => r.id === id ? { ...r, state: decision, decidedAt: ts } : r),
        }));
        if (decision === "approved") {
          get().setSecondaryOwner(req.leadId, req.requesterId, req.requesterName);
          get().logActivity(req.leadId, "access-granted", `Access granted to ${req.requesterName}`);
        } else {
          get().logActivity(req.leadId, "access-rejected", `Access rejected for ${req.requesterName}`);
        }
      },

      setSecondaryOwner: (leadId, ownerId, ownerName) => {
        set((s) => ({
          leads: s.leads.map((l) => l.id === leadId
            ? { ...l, secondaryOwnerId: ownerId, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(leadId, "secondary-added", `${ownerName} added as secondary owner`);
      },

      reassignPrimary: (leadId, ownerId, ownerName, reason) => {
        set((s) => ({
          leads: s.leads.map((l) => l.id === leadId
            ? { ...l, primaryOwnerId: ownerId, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(leadId, "owner-changed", `Primary owner → ${ownerName} (${reason})`);
      },

      setLifecycleState: (leadId, state) => {
        set((s) => ({
          leads: s.leads.map((l) => l.id === leadId ? { ...l, state, updatedAt: nowIso() } : l),
        }));
        get().logActivity(leadId, "state-changed", `State → ${state}`);
      },

      getLead: (leadId) => get().leads.find((l) => l.id === leadId),
      getActivities: (leadId) => get().activities.filter((a) => a.leadId === leadId),
      getRequestsForOwner: (ownerId) =>
        get().requests.filter((r) => r.toOwnerId === ownerId && r.state === "pending"),
      getRequestsByMe: (userId) => get().requests.filter((r) => r.requesterId === userId),
    }),
    { name: "lead-identity-store-v1" },
  ),
);
