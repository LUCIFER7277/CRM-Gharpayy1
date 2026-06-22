import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Gauge,
  Loader2,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/lib/auth-store";
import { useLeadsDailyProgress } from "@/hooks/use-stats";
import { getTodayIstDate } from "@/lib/ist-date";

function ProgressLine({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const done = value >= max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${done ? "text-emerald-600" : "text-foreground"}`}>
          {value}/{max}{done ? " ✓" : ""}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent: "violet" | "emerald";
}) {
  const done = value >= max;
  const isViolet = accent === "violet";

  return (
    <div className={`rounded-xl border p-3 ${done ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-bold text-foreground">
          {value}<span className="text-sm text-muted-foreground">/{max}</span>
        </p>
        {done && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Done</Badge>}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : isViolet ? "bg-violet-500" : "bg-primary"}`}
          style={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/** Daily progress body - member self-view or manager/admin team view. */
export function DailyProgressView() {
  const authUser = useAuthUser((s) => s.user);
  const role = authUser?.role ?? "";
  const allowedRoles = ["super_admin", "manager", "admin", "member", "tcm"];
  const hasAccess = allowedRoles.includes(role);

  const [selectedDate, setSelectedDate] = useState(getTodayIstDate());
  const { data, isLoading, isError } = useLeadsDailyProgress(selectedDate);

  const goals = data?.goals || { leadsAdded: 40, toursScheduled: 10, quotesSent: 10 };
  const members = data?.members || [];
  const isMemberView = role === "member" || role === "tcm";

  const memberRow = useMemo(() => {
    if (!isMemberView) return null;
    return members.find((member) => member.id === authUser?.id) || members[0] || null;
  }, [isMemberView, members, authUser?.id]);

  const fullyDoneCount = useMemo(
    () => members.filter((member) => member.allDone).length,
    [members],
  );

  if (!hasAccess) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Daily progress is not available for your role.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 mb-2">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Performance</span>
          </div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Gauge size={16} className="text-primary" />
            Daily Progress
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leads added, tours scheduled + completed, and quotes sent for the selected date (IST).
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-background/90 px-2.5 py-1.5">
          <CalendarDays size={14} className="text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-7 text-xs w-[150px] border-none bg-transparent shadow-none focus-visible:ring-0"
            aria-label="Select progress date"
          />
        </div>
      </div>

      {isLoading && (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-xl border bg-card">
          <Loader2 size={14} className="animate-spin" />
          Loading progress...
        </div>
      )}

      {isError && (
        <div className="py-8 text-center text-sm text-destructive rounded-xl border bg-card">
          Could not load progress for this date.
        </div>
      )}

      {!isLoading && !isError && isMemberView && memberRow && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/70">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{memberRow.name}</p>
                  <Badge className={`text-[10px] uppercase border px-2 py-0.5 ${memberRow.role === "tcm" ? "bg-role-tcm/10 text-role-tcm border-role-tcm/20" : "bg-secondary/10 text-muted-foreground border-border/50"}`}>
                    {memberRow.role === "tcm" ? "TCM" : "Member"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Selected Date: {selectedDate}</p>
              </div>
              {memberRow.allDone && (
                <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 size={11} className="mr-1" /> Complete
                </Badge>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <MetricTile label="Leads Added" value={memberRow.leadsAdded} max={goals.leadsAdded} accent="violet" />
              <MetricTile label="Tours Scheduled + Completed" value={memberRow.toursScheduled} max={goals.toursScheduled} accent="emerald" />
              <MetricTile label="Quotes Sent" value={memberRow.quotesSent ?? 0} max={goals.quotesSent ?? 10} accent="emerald" />
            </div>
            <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-secondary/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                Daily target: <span className="font-medium text-foreground">{goals.leadsAdded}</span> leads, <span className="font-medium text-foreground">{goals.toursScheduled}</span> tours, and <span className="font-medium text-foreground">{goals.quotesSent ?? 10}</span> quotes.
              </p>
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${memberRow.allDone ? "bg-emerald-500/10 border-emerald-500/25" : "bg-secondary/20"}`}>
            <p className={`text-xs ${memberRow.allDone ? "text-emerald-700 dark:text-emerald-300 font-medium" : "text-muted-foreground"}`}>
              {memberRow.allDone
                ? "Great work! You completed all three goals for this day."
                : "Keep going. You are making progress."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && !isMemberView && (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</p>
              <p className="text-lg font-bold mt-1 flex items-center gap-1">
                <Users size={14} /> {members.length}
              </p>
            </div>
            <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fully Complete</p>
              <p className="text-lg font-bold mt-1 flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <Trophy size={14} /> {fullyDoneCount}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</p>
              <p className="text-xs mt-1 font-medium text-foreground">
                {goals.leadsAdded} leads · {goals.toursScheduled} tours · {goals.quotesSent ?? 10} quotes
              </p>
            </div>
          </div>

          {members.length === 0 && (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              No member progress data found for this date.
            </div>
          )}

          {members.length > 0 && (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`rounded-xl border p-3 transition-colors ${member.allDone ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card hover:bg-secondary/30"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${member.allDone ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}
                      >
                        {String(member.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{member.name}</p>
                          <Badge className={`text-[10px] uppercase border px-2 py-0.5 ${member.role === "tcm" ? "bg-role-tcm/10 text-role-tcm border-role-tcm/20" : "bg-secondary/10 text-muted-foreground border-border/50"}`}>
                            {member.role === "tcm" ? "TCM" : "Member"}
                          </Badge>
                        </div>
                        {member.zones.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate">{member.zones.join(", ")}</p>
                        )}
                      </div>
                    </div>
                    {member.allDone && (
                      <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Done</Badge>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-secondary/20 p-2.5">
                      <ProgressLine label="Leads Added" value={member.leadsAdded} max={goals.leadsAdded} />
                    </div>
                    <div className="rounded-lg bg-secondary/20 p-2.5">
                      <ProgressLine label="Tours Scheduled + Completed" value={member.toursScheduled} max={goals.toursScheduled} />
                    </div>
                    <div className="rounded-lg bg-secondary/20 p-2.5">
                      <ProgressLine label="Quotes Sent" value={member.quotesSent ?? 0} max={goals.quotesSent ?? 10} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1">
        <TrendingUp size={12} /> Values are based on selected date activity (IST midnight reset).
      </p>
    </div>
  );
}
