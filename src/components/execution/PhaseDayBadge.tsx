import { cn } from "@/lib/utils";
import type { NextAction } from "@/lib/crm10x/execution-engine";

const COLORS: Record<NextAction["anchor"], string> = {
  L: "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30",
  T: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  CI: "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30",
};

export function PhaseDayBadge({ action, className }: { action: NextAction; className?: string }) {
  const sign = action.dayOffset >= 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
        COLORS[action.anchor],
        className,
      )}
      title={action.reason}
    >
      <span className="opacity-70">P{action.phase}</span>
      <span>·</span>
      <span>{action.anchor}{sign}{action.dayOffset}</span>
    </span>
  );
}
