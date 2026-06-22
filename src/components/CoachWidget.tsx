import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Flame } from "lucide-react";
import { useApp } from "@/lib/store";
import { useGame, whoKey } from "@/lib/gamification";
import { useMountedNow } from "@/hooks/use-now";
import { buildCoachReport } from "@/lib/coach";
import { CoachPanel } from "./CoachPanel";
import { cn } from "@/lib/utils";

/**
 * Floating "Coach" launcher - shows the user a pulsing ring when there are
 * misses, the streak count when there aren't, and opens the Coach drawer.
 *
 * Hides automatically inside the LeadControlPanel sheet to avoid stacking.
 */
export function CoachWidget() {
  const role         = useApp((s) => s.role);
  const currentTcmId = useApp((s) => s.currentTcmId);
  const tcms         = useApp((s) => s.tcms);
  const leads        = useApp((s) => s.leads);
  const tours        = useApp((s) => s.tours);
  const followUps    = useApp((s) => s.followUps);
  const activities   = useApp((s) => s.activities);
  const bookings     = useApp((s) => s.bookings);
  const handoffs     = useApp((s) => s.handoffs);
  const shownIntro = useGame((s) => s.shownIntro);
  const setShownIntro = useGame((s) => s.setShownIntro);
  const rolloverIfNeeded = useGame((s) => s.rolloverIfNeeded);
  const [now, mounted] = useMountedNow();
  const [open, setOpen] = useState(false);

  const who = whoKey(role, currentTcmId);
  // Subscribe to slot so the ring/streak update on XP awards.
  const userSlot = useGame((s) => s.byUser[who]);
  const stats = mounted
    ? useGame.getState().getStats(who)
    : { xp: 0, streak: 0, xpToday: 0, bookingsClosed: 0, cleared: {}, lastWinDate: null, todayKey: null };
  void userSlot;

  const report = mounted
    ? buildCoachReport({
        role, currentTcmId, tcms, leads, tours, followUps,
        activities, bookings, handoffs, now,
        ownerSignals: { staleRooms: 0, pendingBlocks: 0 },
      })
    : null;

  // Open the coach automatically on first visit (welcome nudge)
  useEffect(() => {
    if (!mounted) return;
    if (!shownIntro) {
      const t = setTimeout(() => {
        setOpen(true);
        setShownIntro(true);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [mounted, shownIntro, setShownIntro]);

  // Day rollover via effect (no store writes from render).
  useEffect(() => {
    if (mounted) rolloverIfNeeded(who);
  }, [mounted, who, rolloverIfNeeded]);

  // Keyboard shortcut: press "Shift+C" to toggle the coach.
  // (Bare "c" is reserved for log-call on the selected lead.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!mounted || !report) return null;

  const missed = report.missed.length;
  const pct = report.mission.pct;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open coach"
          className={cn(
            "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40",
            "h-14 w-14 rounded-full shadow-lg flex items-center justify-center",
            "bg-accent text-accent-foreground hover:scale-105 active:scale-95",
            "transition-transform border-2 border-background",
            missed > 0 && "ring-4 ring-destructive/30",
          )}
        >
          {/* Progress ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28" cy="28" r="25"
              fill="none" stroke="currentColor"
              className="text-accent-foreground/20"
              strokeWidth="3"
            />
            <circle
              cx="28" cy="28" r="25"
              fill="none" stroke="currentColor"
              className="text-background transition-all duration-500"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 25}
              strokeDashoffset={2 * Math.PI * 25 * (1 - pct / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="relative flex flex-col items-center justify-center leading-none">
            {stats.streak > 0 ? (
              <>
                <Flame className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold mt-0.5">{stats.streak}</span>
              </>
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          {missed > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-background">
              {missed}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Your Coach
            <span className="ml-auto text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
              Shift + C
            </span>
          </SheetTitle>
        </SheetHeader>
        <CoachPanel compact />
      </SheetContent>
    </Sheet>
  );
}
