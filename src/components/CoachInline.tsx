import { useMemo } from "react";
import { Sparkles, ChevronRight, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { useGame, whoKey } from "@/lib/gamification";
import { useMountedNow } from "@/hooks/use-now";
import { buildCoachReport } from "@/lib/coach";
import { cn } from "@/lib/utils";

interface Props {
  /** Page name for analytics + light filtering */
  page?: string;
  /** Optional override hint instead of auto-derived */
  hint?: string;
  /** Tighten / loosen padding */
  compact?: boolean;
}

/**
 * Tiny single-line "what to do next" bar. Shows the highest-priority
 * Coach item for the current user, the active streak, and a deep link
 * to the full Coach panel.
 *
 * Use at the top of any role-facing page. Hidden when there's nothing
 * to surface.
 */
export function CoachInline({ page, hint, compact = false }: Props) {
  void page;
  const role            = useApp((s) => s.role);
  const currentTcmId    = useApp((s) => s.currentTcmId);
  const tcms            = useApp((s) => s.tcms);
  const leads           = useApp((s) => s.leads);
  const tours           = useApp((s) => s.tours);
  const followUps       = useApp((s) => s.followUps);
  const activities      = useApp((s) => s.activities);
  const bookings        = useApp((s) => s.bookings);
  const handoffs        = useApp((s) => s.handoffs);
  const [now, mounted]  = useMountedNow();
  const who             = whoKey(role, currentTcmId);
  const userSlot        = useGame((s) => s.byUser[who]);
  const stats = mounted
    ? useGame.getState().getStats(who)
    : { xp: 0, streak: 0, xpToday: 0, bookingsClosed: 0, cleared: {}, lastWinDate: null, todayKey: null };
  void userSlot;

  const report = useMemo(() => {
    if (!mounted) return null;
    return buildCoachReport({
      role, currentTcmId, tcms, leads, tours, followUps, activities, bookings, handoffs, now,
      ownerSignals: { staleRooms: 0, pendingBlocks: 0 },
    });
  }, [role, currentTcmId, tcms, leads, tours, followUps, activities, bookings, handoffs, now, mounted]);

  if (!mounted || !report) return null;

  const top = report.missed[0] ?? report.todo[0];
  const message =
    hint ??
    (top
      ? top.title
      : report.mission.done >= report.mission.target
        ? "Mission cleared. Use this hour to revive a cold lead."
        : "Coach has nothing urgent - keep working the deck.");

  const severity: "missed" | "todo" | "calm" = top
    ? (report.missed[0] ? "missed" : "todo")
    : "calm";

  return (
    <Link
      to="/coach"
      className={cn(
        "group relative flex items-center gap-2 rounded-md border text-[12px] transition-colors",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        severity === "missed"
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          : severity === "todo"
            ? "border-accent/30 bg-accent/5 hover:bg-accent/10"
            : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <Sparkles
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          severity === "missed" ? "text-destructive" : severity === "todo" ? "text-accent" : "text-muted-foreground",
        )}
      />
      <span className="font-medium truncate flex-1 text-foreground">{message}</span>
      {top && (
        <span className="font-mono text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
          +{top.xp} XP
        </span>
      )}
      {stats.streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-warning font-mono text-[10px] shrink-0">
          <Flame className="h-3 w-3" /> {stats.streak}d
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
