/**
 * Coach 4.0 - Auto-Pilot card.
 * Renders the 3-step plan + streak multiplier badge.
 * Drop-in surface used by CoachPanel and the Today page.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Zap, Clock, Target } from "lucide-react";
import { autoPilotPlan, streakMultiplier, tickMultiplier, multiplierLabel, type MultiplierState } from "@/lib/coach-pilot";
import type { CoachReport, CoachItem } from "@/lib/coach";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gharpayy.coach.multiplier.v1";

function loadMult(): MultiplierState {
  if (typeof window === "undefined") return { lastClearedAt: null, comboCount: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastClearedAt: null, comboCount: 0 };
    return JSON.parse(raw) as MultiplierState;
  } catch { return { lastClearedAt: null, comboCount: 0 }; }
}
function saveMult(m: MultiplierState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function useCoachMultiplier() {
  const [state, setState] = useState<MultiplierState>(() => loadMult());
  useEffect(() => { saveMult(state); }, [state]);
  const bump = () => setState((s) => tickMultiplier(s));
  const mult = streakMultiplier(state);
  return { mult, bump, state };
}

export function CoachAutoPilot({
  report,
  onClear,
  compact = false,
}: {
  report: CoachReport;
  onClear?: (item: CoachItem) => void;
  compact?: boolean;
}) {
  const plan = useMemo(() => autoPilotPlan(report), [report]);
  const { mult, bump } = useCoachMultiplier();

  if (plan.picks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-success" />
        Auto-Pilot is idle - your queue is clear. Take a breath.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-gradient-to-br from-accent/5 to-card p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Auto-Pilot · next {plan.picks.length}
        </div>
        <span
          className={cn(
            "text-[10px] font-mono rounded-full px-1.5 py-0.5",
            mult >= 2 ? "bg-destructive/15 text-destructive" : mult > 1 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
          )}
          title="XP combo multiplier - keep clearing within 8 minutes to grow it."
        >
          {multiplierLabel(mult)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> +{Math.round(plan.potentialXp * mult)} XP potential</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ~{plan.etaMinutes} min</span>
      </div>

      <ol className="space-y-1.5">
        {plan.picks.map((p, idx) => (
          <li key={p.item.id} className="flex items-start gap-2 rounded-md border border-border bg-background/60 p-2">
            <span className="h-5 w-5 rounded-full bg-accent/15 text-accent text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">{p.item.title}</div>
              {!compact && <div className="text-[10px] text-muted-foreground line-clamp-2">{p.rationale}</div>}
              <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">conf {p.confidence}% · +{p.item.xp} XP</div>
            </div>
            {onClear && (
              <button
                type="button"
                onClick={() => { onClear(p.item); bump(); }}
                className="shrink-0 text-[10px] inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 text-accent px-2 py-1 hover:bg-accent/20 transition-colors"
                aria-label="Mark done"
              >
                <Target className="h-3 w-3" /> Done
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
