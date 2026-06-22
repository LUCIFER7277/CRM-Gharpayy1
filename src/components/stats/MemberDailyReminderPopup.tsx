import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/lib/auth-store";
import { useLeadsDailyProgress } from "@/hooks/use-stats";
import { getTodayIstDate } from "@/lib/ist-date";

const shownReminderKeys = new Set<string>();

function ProgressStrip({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const done = value >= max;

  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className={`text-xs font-semibold ${done ? "text-emerald-600" : "text-foreground"}`}>
          {value}/{max}{done ? " ✓" : ""}
        </p>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Shown for every member/TCM login or refresh - today's goals popup. */
export function MemberDailyReminderPopup() {
  const authUser = useAuthUser((s) => s.user);
  const [open, setOpen] = useState(false);
  const today = getTodayIstDate();
  const isMemberLikeRole = authUser?.role === "member" || authUser?.role === "tcm";
  const reminderKey = authUser?.id && isMemberLikeRole ? `${today}:${authUser.id}` : null;

  const previousReminderKeyRef = useRef<string | null>(null);

  const { data, isLoading } = useLeadsDailyProgress(today);

  const goals = data?.goals || { leadsAdded: 40, toursScheduled: 10, quotesSent: 10 };
  const memberRow = useMemo(() => {
    const members = data?.members || [];
    return members.find((member) => member.id === authUser?.id) || members[0] || null;
  }, [data?.members, authUser?.id]);

  useEffect(() => {
    if (!reminderKey) {
      if (previousReminderKeyRef.current) {
        shownReminderKeys.delete(previousReminderKeyRef.current);
        previousReminderKeyRef.current = null;
      }
      return;
    }

    if (shownReminderKeys.has(reminderKey)) return;

    shownReminderKeys.add(reminderKey);
    previousReminderKeyRef.current = reminderKey;
    setOpen(true);
  }, [reminderKey]);

  if (!isMemberLikeRole) return null;

  const leadsAdded = memberRow?.leadsAdded ?? 0;
  const toursScheduled = memberRow?.toursScheduled ?? 0;
  const quotesSent = memberRow?.quotesSent ?? 0;
  const allDone = memberRow?.allDone ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-[1px]">
          <div className="bg-background rounded-[calc(var(--radius)-1px)] overflow-hidden">
            <DialogHeader className="px-5 pt-5 pb-4 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 border-b">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5">
                    <Sparkles size={12} className="text-violet-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      Daily Reminder
                    </span>
                  </div>
                  <DialogTitle className="text-base font-semibold">Today&apos;s Focus</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Your daily targets: {goals.leadsAdded} leads, {goals.toursScheduled} tours, and {goals.quotesSent ?? 10} quotes.
                  </DialogDescription>
                </div>
                {allDone && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                    <CheckCircle2 size={11} className="mr-1" /> Great Job
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <div className="px-5 py-4 bg-gradient-to-b from-background to-secondary/20 space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <CalendarDays size={13} />
                <span>{today}</span>
              </div>

              {isLoading && (
                <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Loading your progress...
                </div>
              )}

              {!isLoading && (
                <>
                  <ProgressStrip
                    label="Leads Added"
                    value={leadsAdded}
                    max={goals.leadsAdded}
                    colorClass="bg-gradient-to-r from-indigo-500 to-violet-500"
                  />
                  <ProgressStrip
                    label="Tours Scheduled + Completed"
                    value={toursScheduled}
                    max={goals.toursScheduled}
                    colorClass="bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                  <ProgressStrip
                    label="Quotes Sent"
                    value={quotesSent}
                    max={goals.quotesSent ?? 10}
                    colorClass="bg-gradient-to-r from-fuchsia-500 to-pink-500"
                  />

                  <div className={`rounded-xl border p-3 ${allDone ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/20"}`}>
                    <p className={`text-xs ${allDone ? "text-emerald-700 dark:text-emerald-300 font-medium" : "text-muted-foreground"}`}>
                      {allDone
                        ? "Excellent work. You completed all three milestones for today."
                        : "Stay consistent. Finish all three milestones and make today count."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
