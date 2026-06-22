/**
 * Automation rule R26–R29 hooks for the local event bus.
 *
 * These are pure functions that respect Settings.automation toggles. They
 * are the runtime side of the Settings → behavior contract:
 *
 *   R26  Lead created          → generate Top-6 + dual-primary matches
 *   R27  Room becomes vacant   → recompute matches for affected leads
 *   R28  Owner compliance drop → demote that property in ranking weight
 *   R29  Property booked often → boost that property in ranking weight
 *
 * Storage is in-memory (Zustand) so the UI can render derived match lists
 * without re-running the engine on every render.
 */
import { create } from "zustand";
import type { Lead } from "@/lib/types";
import type { PG } from "@/supply-hub/data/types";
import { runMatcherV2, type MatchPair } from "@/lib/matcher-v2";
import type { AutomationRule, AutomationRuleId, MatchingV2Settings } from "@/myt/lib/settings-context";

interface AutomationStore {
  /** leadId → cached MatchPair */
  matches: Record<string, MatchPair>;
  /** propertyId → boost (+/-) applied via R28/R29 */
  rankingAdjustments: Record<string, number>;
  /** propertyId → notes, e.g. "demoted: compliance 42/100" */
  notes: Record<string, string>;

  generateForLead: (lead: Lead, settings: MatchingV2Settings) => MatchPair;
  recomputeForArea: (area: string, leads: Lead[], settings: MatchingV2Settings) => number;
  applyComplianceDrop: (pgId: string, score: number) => void;
  applyBookingBoost: (pgId: string, recentBookings: number) => void;
  reset: () => void;
}

export const useAutomation = create<AutomationStore>((set, get) => ({
  matches: {},
  rankingAdjustments: {},
  notes: {},

  generateForLead: (lead, settings) => {
    const result = runMatcherV2(lead, settings);
    set((s) => ({ matches: { ...s.matches, [lead.id]: result } }));
    return result;
  },

  recomputeForArea: (area, leads, settings) => {
    let touched = 0;
    const next: Record<string, MatchPair> = { ...get().matches };
    for (const lead of leads) {
      if ((lead.preferredArea || "").toLowerCase() === area.toLowerCase()) {
        next[lead.id] = runMatcherV2(lead, settings);
        touched += 1;
      }
    }
    set({ matches: next });
    return touched;
  },

  applyComplianceDrop: (pgId, score) => {
    set((s) => ({
      rankingAdjustments: { ...s.rankingAdjustments, [pgId]: -Math.round((100 - score) / 10) },
      notes: { ...s.notes, [pgId]: `Demoted via R28 (compliance ${score}/100)` },
    }));
  },

  applyBookingBoost: (pgId, recentBookings) => {
    if (recentBookings <= 0) return;
    set((s) => ({
      rankingAdjustments: { ...s.rankingAdjustments, [pgId]: Math.min(15, recentBookings * 3) },
      notes: { ...s.notes, [pgId]: `Boosted via R29 (${recentBookings} recent bookings)` },
    }));
  },

  reset: () => set({ matches: {}, rankingAdjustments: {}, notes: {} }),
}));

export function isRuleEnabled(rules: AutomationRule[], id: AutomationRuleId): boolean {
  return !!rules.find((r) => r.id === id && r.enabled);
}

/**
 * Impact simulation for the Settings panel.
 *
 * Re-runs the matcher with `nextSettings` against a sample of leads and
 * compares Top-6 / Primary picks vs the current settings' output.
 */
export interface ImpactRow {
  leadId: string;
  leadName: string;
  primaryAChanged: boolean;
  primaryBChanged: boolean;
  topSetChange: number; // count of properties added/removed in Top-6
}

export function simulateImpact(
  leads: Lead[],
  current: MatchingV2Settings,
  next: MatchingV2Settings,
  sample = 8,
): { rows: ImpactRow[]; affectedPct: number } {
  const sampleLeads = leads.slice(0, sample);
  const rows: ImpactRow[] = [];
  let affected = 0;

  for (const lead of sampleLeads) {
    const before = runMatcherV2(lead, current);
    const after = runMatcherV2(lead, next);

    const beforeIds = new Set(before.all.map((m) => m.pg.id));
    const afterIds = new Set(after.all.map((m) => m.pg.id));
    const diff = [...afterIds].filter((id) => !beforeIds.has(id)).length
              + [...beforeIds].filter((id) => !afterIds.has(id)).length;

    const aChanged = before.primary[0]?.pg.id !== after.primary[0]?.pg.id;
    const bChanged = before.primary[1]?.pg.id !== after.primary[1]?.pg.id;

    if (aChanged || bChanged || diff > 0) affected += 1;

    rows.push({
      leadId: lead.id,
      leadName: lead.name,
      primaryAChanged: aChanged,
      primaryBChanged: bChanged,
      topSetChange: diff,
    });
  }

  return { rows, affectedPct: sampleLeads.length ? Math.round((affected / sampleLeads.length) * 100) : 0 };
}

/**
 * Quality benchmark for the simulator: returns what % of leads have at least
 * one viable match and what % get a true dual-primary pair.
 */
export interface QualityReport {
  total: number;
  withAtLeastOne: number;
  withDualPrimary: number;
  avgScore: number;
}

export function benchmarkMatchingQuality(leads: Lead[], settings: MatchingV2Settings): QualityReport {
  let withAtLeastOne = 0;
  let withDualPrimary = 0;
  let totalScore = 0;
  let counted = 0;
  for (const lead of leads) {
    const r = runMatcherV2(lead, settings);
    if (r.primary[0]) {
      withAtLeastOne += 1;
      totalScore += r.primary[0].score;
      counted += 1;
    }
    if (r.primary[0] && r.primary[1]) withDualPrimary += 1;
  }
  return {
    total: leads.length,
    withAtLeastOne,
    withDualPrimary,
    avgScore: counted ? Math.round(totalScore / counted) : 0,
  };
}

// Re-export PG for convenience
export type { PG };
