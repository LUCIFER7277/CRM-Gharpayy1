/**
 * Coach 4.0 - Auto-Pilot priorities + Streak Multiplier.
 *
 * Builds on top of `src/lib/coach.ts` to add two zero-config features any
 * role gets:
 *   - autoPilotPlan(report): the 3 highest-leverage items, ordered by
 *     impact (XP × urgency × stale-risk), with a confidence score.
 *   - streakMultiplier(state): a multiplier (1x → 3x) that grows when the
 *     user closes items in quick succession, decays when idle.
 *
 * Pure functions; UI lives in CoachPanel/CoachWidget.
 */

import type { CoachItem, CoachReport } from "./coach";

export interface AutoPilotPick {
  item: CoachItem;
  /** 0–100 - how confident Auto-Pilot is this is the right next action */
  confidence: number;
  /** 1-line plain-English reason */
  rationale: string;
}

export interface AutoPilotPlan {
  picks: AutoPilotPick[];
  /** total XP if user completes the full plan */
  potentialXp: number;
  /** ETA in minutes */
  etaMinutes: number;
}

const KIND_ETA: Record<string, number> = {
  "post-tour-overdue": 4,
  "follow-up-overdue": 3,
  "follow-up-today": 3,
  "no-follow-up": 2,
  "first-response": 2,
  "tour-today": 5,
  "hot-untouched": 4,
  "owner-room-stale": 2,
  "owner-block-pending": 3,
  "flowops-handoff-unread": 2,
  "flowops-reassign-stuck": 4,
};

export function autoPilotPlan(report: CoachReport): AutoPilotPlan {
  const pool = [...report.missed, ...report.todo];
  // Score = base score (already ranked) + XP weight + missed bonus.
  const ranked = pool
    .map((item) => {
      const isMissed = report.missed.includes(item);
      const composite = item.score + item.xp * 0.4 + (isMissed ? 25 : 0);
      const confidence = Math.min(99, Math.round(50 + composite / 4));
      const rationale = isMissed
        ? `Recovers a slipped commitment (+${item.xp} XP).`
        : item.score >= 80
          ? `Top of queue - high impact (+${item.xp} XP).`
          : `Keeps momentum, low effort (+${item.xp} XP).`;
      return { item, confidence, rationale };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const potentialXp = ranked.reduce((sum, p) => sum + p.item.xp, 0);
  const etaMinutes = ranked.reduce((sum, p) => sum + (KIND_ETA[p.item.kind] ?? 3), 0);
  return { picks: ranked, potentialXp, etaMinutes };
}

export interface MultiplierState {
  /** ms timestamp of last cleared item */
  lastClearedAt: number | null;
  /** consecutive items cleared within the streak window */
  comboCount: number;
}

const STREAK_WINDOW_MS = 1000 * 60 * 8; // 8 minutes

/**
 * 1.0x baseline. Each consecutive clear within 8 min adds 0.25x, capped at 3x.
 * Decays back to 1x once the window expires.
 */
export function streakMultiplier(state: MultiplierState, now = Date.now()): number {
  if (!state.lastClearedAt || state.comboCount <= 1) return 1;
  const fresh = now - state.lastClearedAt < STREAK_WINDOW_MS;
  if (!fresh) return 1;
  return Math.min(3, 1 + (state.comboCount - 1) * 0.25);
}

export function tickMultiplier(state: MultiplierState, now = Date.now()): MultiplierState {
  if (!state.lastClearedAt) return { lastClearedAt: now, comboCount: 1 };
  const fresh = now - state.lastClearedAt < STREAK_WINDOW_MS;
  return {
    lastClearedAt: now,
    comboCount: fresh ? state.comboCount + 1 : 1,
  };
}

export function multiplierLabel(mult: number): string {
  if (mult >= 3) return "🔥 3.0× MAX";
  if (mult >= 2) return `⚡ ${mult.toFixed(2)}× HOT`;
  if (mult > 1) return `↑ ${mult.toFixed(2)}× combo`;
  return "1.00×";
}
