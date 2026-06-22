// Fuzzy matching: Levenshtein + scoring + candidate search.
import type { UnifiedLead, MatchCandidate, MatchResult, MatchType } from "./types";
import { normalizeName } from "./normalize";

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity 0-1 based on Levenshtein over max length. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const max = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / max;
}

interface ScoreInput {
  phoneE164?: string;
  emailNorm?: string;
  name?: string;
  area?: string;
}

export function scoreMatch(input: ScoreInput, lead: UnifiedLead): MatchCandidate {
  const reasons: string[] = [];
  let score = 0;

  // Phone is the strongest signal
  if (input.phoneE164 && lead.phoneE164 && input.phoneE164 === lead.phoneE164) {
    score += 70;
    reasons.push("phone exact");
  }
  // Email exact
  if (input.emailNorm && lead.emailNorm && input.emailNorm === lead.emailNorm) {
    score += 60;
    reasons.push("email exact");
  }
  // Name similarity
  if (input.name && lead.name) {
    const sim = nameSimilarity(input.name, lead.name);
    if (sim >= 0.95) { score += 25; reasons.push(`name ${sim.toFixed(2)}`); }
    else if (sim >= 0.8) { score += 18; reasons.push(`name ${sim.toFixed(2)}`); }
    else if (sim >= 0.65) { score += 10; reasons.push(`name ${sim.toFixed(2)}`); }
  }
  // Area weak signal
  if (input.area && lead.area && input.area.toLowerCase() === lead.area.toLowerCase()) {
    score += 5;
    reasons.push("area match");
  }

  return { lead, score: Math.min(100, score), reasons };
}

export function classifyScore(top: number): MatchType {
  if (top >= 95) return "exact";
  if (top >= 70) return "strong";
  if (top >= 40) return "possible";
  return "new";
}

export function findMatches(input: ScoreInput, leads: UnifiedLead[]): MatchResult {
  const cands = leads
    .map((l) => scoreMatch(input, l))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const top = cands[0]?.score ?? 0;
  return { type: classifyScore(top), topScore: top, candidates: cands };
}
