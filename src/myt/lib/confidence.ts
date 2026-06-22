import { Intent, TourQualification, ConfirmationStrength } from './types';

export interface ConfidenceResult {
  score: number;
  intent: Intent;
  reason: string[];
}

/**
 * Pure scoring engine. Higher score = higher booking probability.
 * Uses move-in urgency, budget alignment, intent signals, and decision authority.
 */
export function scoreTour(
  q: TourQualification,
  budget: number,
  budgetFloor = 7000
): ConfidenceResult {
  let score = 30; // baseline
  const reason: { weight: number; text: string }[] = [];

  // Move-in urgency
  const daysToMoveIn = Math.max(
    0,
    Math.floor((new Date(q.moveInDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  if (daysToMoveIn <= 3) {
    score += 30;
    reason.push({ weight: 30, text: `Move-in in ${daysToMoveIn}d` });
  } else if (daysToMoveIn <= 7) {
    score += 20;
    reason.push({ weight: 20, text: `Move-in in ${daysToMoveIn}d` });
  } else if (daysToMoveIn <= 15) {
    score += 10;
    reason.push({ weight: 10, text: `Move-in in ${daysToMoveIn}d` });
  } else {
    reason.push({ weight: -5, text: `Move-in ${daysToMoveIn}d away` });
    score -= 5;
  }

  // Budget alignment
  if (budget >= budgetFloor) {
    score += 20;
    reason.push({ weight: 20, text: 'Budget aligned' });
  } else {
    score -= 20;
    reason.push({ weight: -20, text: 'Budget below floor' });
  }

  // Closing question
  if (q.willBookToday === 'yes') {
    score += 15;
    reason.push({ weight: 15, text: 'Will book today' });
  } else if (q.willBookToday === 'maybe') {
    score += 5;
  } else if (q.willBookToday === 'no') {
    score -= 10;
    reason.push({ weight: -10, text: 'Won\'t book today' });
  }

  // Intent signals
  if (q.readyIn48h) {
    score += 10;
    reason.push({ weight: 10, text: 'Ready in 48h' });
  }
  if (q.exploring) {
    score -= 15;
    reason.push({ weight: -15, text: 'Just exploring' });
  }
  if (q.comparing) {
    score -= 10;
    reason.push({ weight: -10, text: 'Comparing options' });
  }
  if (q.needsFamily) {
    score -= 5;
    reason.push({ weight: -5, text: 'Needs family approval' });
  }

  // Decision authority
  if (q.decisionMaker === 'self') {
    score += 10;
    reason.push({ weight: 10, text: 'Final decision maker' });
  } else if (q.decisionMaker === 'group') {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  const intent: Intent = score >= 75 ? 'hard' : score >= 45 ? 'medium' : 'soft';

  // Top 3 contributing factors by absolute weight
  const topReasons = reason
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3)
    .map(r => r.text);

  return { score, intent, reason: topReasons };
}

export function inferConfirmationStrength(q: TourQualification): ConfirmationStrength {
  if (q.willBookToday === 'yes' && q.readyIn48h) return 'strong';
  if (q.willBookToday === 'no' || q.exploring) return 'weak';
  return 'tentative';
}

export const intentColor: Record<Intent, string> = {
  hard: 'text-role-tcm',
  medium: 'text-role-hr',
  soft: 'text-muted-foreground',
};

export const intentBg: Record<Intent, string> = {
  hard: 'bg-role-tcm/15 text-role-tcm border-role-tcm/30',
  medium: 'bg-role-hr/15 text-role-hr border-role-hr/30',
  soft: 'bg-muted/40 text-muted-foreground border-border',
};

export const confirmationLabel: Record<ConfirmationStrength, string> = {
  strong: '✅ Strong',
  tentative: '⚠️ Tentative',
  weak: '❌ Weak',
};
