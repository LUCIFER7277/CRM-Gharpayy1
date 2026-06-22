import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { useMountedNow } from "@/hooks/use-now";
import {
  buildDoNextQueue,
  computeTcmPerformance,
  liveConfidence,
  intentFor,
  type NextAction,
} from "@/lib/engine";
import { useMemo } from "react";
import { QuickActionRow } from "@/components/QuickActionRow";
import { StageBadge } from "@/components/atoms";
import { format, formatDistanceToNow } from "date-fns";
import { Sun, Flame, AlertTriangle, Phone, Trophy, Zap, ArrowUpRight } from "lucide-react";
import { KpiCard } from "@/components/atoms";
import { isLeadActive, resolveBestLeadName } from "@/lib/lead-helpers";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today - Gharpayy" },
      {
        name: "description",
        content: "Your morning command center. The exact next action, ranked by impact.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { role, currentTcmId, leads, tours, followUps, tcms, completeFollowUp } = useApp();
  const authUser = useAuthUser((s) => s.user);
  const [now, mounted] = useMountedNow(15_000);
  const canSeeAll =
    authUser?.role === "super_admin" || authUser?.role === "manager" || authUser?.role === "admin";
  const selfId = authUser?.id || (role === "tcm" ? currentTcmId : "");
  const scopedLeads = useMemo(() => {
    if (canSeeAll || !selfId) return leads;
    return leads.filter((lead) => {
      const assignedTo = (lead.assignedTcmId || lead.assigneeId || "").trim();
      return assignedTo === selfId;
    });
  }, [canSeeAll, selfId, leads]);

  const scopedTours = useMemo(() => {
    if (canSeeAll || !selfId) return tours;
    return tours.filter((tour) => tour.tcmId === selfId || tour.assignedTo === selfId);
  }, [canSeeAll, selfId, tours]);

  const scopedFollowUps = useMemo(() => {
    if (canSeeAll || !selfId) return followUps;
    return followUps.filter((followUp) => followUp.tcmId === selfId);
  }, [canSeeAll, selfId, followUps]);

  const queue = useMemo(
    () => buildDoNextQueue(scopedLeads, scopedTours, scopedFollowUps, now || Date.now()),
    [scopedLeads, scopedTours, scopedFollowUps, now],
  );

  const me = !canSeeAll && selfId ? tcms.find((t) => t.id === selfId) : null;
  const perf = me ? computeTcmPerformance(me.id, scopedLeads, scopedTours, scopedFollowUps, now || Date.now()) : null;

  const visibleQueue = useMemo(() => uniqueByLead(queue), [queue]);
  const top = visibleQueue.slice(0, 12);
  const grouped = groupByKind(queue);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Sun className="h-3.5 w-3.5" />
              <span className="min-h-[1em]">
                {mounted ? format(new Date(now), "EEEE, MMMM d · h:mm a") : "\u00a0"}
              </span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {mounted ? greeting(now) : "Hello"}
              {me ? `, ${me.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="text-sm text-muted-foreground">
              {top.length === 0
                ? "Inbox zero. Nothing pending right now."
                : `${queue.length} action${queue.length > 1 ? "s" : ""} ranked. Start at the top.`}
            </p>
          </div>
          <Link to="/leads" className="text-xs text-accent inline-flex items-center gap-1">
            All leads <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>

        {/* Personal KPIs for TCM */}
        {perf && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="My leads" value={perf.leadCount} sub={`${perf.toursDone} tours done`} />
            <KpiCard
              label="My conversion"
              value={`${perf.conversion}%`}
              sub={`${perf.bookings} booked`}
              tone="success"
            />
            <KpiCard
              label="Pending post-tour"
              value={perf.pendingPostTour}
              sub="Fill now"
              tone={perf.pendingPostTour ? "destructive" : "default"}
            />
            <KpiCard
              label="Discipline score"
              value={`${perf.discipline}`}
              sub="0–100"
              tone={
                perf.discipline >= 75
                  ? "success"
                  : perf.discipline >= 50
                    ? "warning"
                    : "destructive"
              }
            />
          </div>
        )}

        {/* The Queue */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-semibold">Do this next</h2>
              <span className="text-[11px] text-muted-foreground font-mono">
                live · refreshes every 15s
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <Legend color="bg-destructive" label={`${grouped.urgent} urgent`} />
              <Legend color="bg-warning" label={`${grouped.today} today`} />
              <Legend color="bg-accent" label={`${grouped.hot} hot`} />
            </div>
          </header>
          {top.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Trophy className="h-8 w-8 text-success mx-auto mb-2" />
              <div className="font-display font-semibold">Inbox zero.</div>
              <div className="text-xs text-muted-foreground mt-1">
                Take a breath. New leads will land here automatically.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {top.map((a) => {
                const lead = scopedLeads.find((l) => l.id === a.leadId);
                if (!lead) return null;
                const tone = toneFor(a);
                const onDone =
                  a.kind === "follow-up-overdue" || a.kind === "follow-up-today"
                    ? () => {
                        const f = followUps.find((x) => x.leadId === a.leadId && !x.done);
                        if (f) completeFollowUp(f.id);
                      }
                    : undefined;
                const dueLabel =
                  mounted && a.dueAt
                    ? formatDistanceToNow(new Date(a.dueAt), { addSuffix: true })
                    : undefined;
                return (
                  <QuickActionRow
                    key={`${a.leadId}-${a.kind}`}
                    lead={lead}
                    reason={a.reason}
                    accent={tone}
                    dueLabel={dueLabel}
                    onDone={onDone}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Hot leads card */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Mini
            title="Critical now"
            icon={AlertTriangle}
            accent="destructive"
            count={grouped.urgent}
            items={queue
              .filter((a) => a.kind === "post-tour-overdue" || a.kind === "first-response")
              .filter(uniqueLeadActionFilter())
              .slice(0, 5)}
            leads={scopedLeads}
          />
          <Mini
            title="Hot pipeline"
            icon={Flame}
            accent="accent"
            count={grouped.hot}
            items={queue
              .filter((a) => {
                const lead = scopedLeads.find((l) => l.id === a.leadId);
                if (!lead || !isLeadActive(lead)) return false;
                const nowTs = now || Date.now();
                const conf = liveConfidence(lead, scopedTours, nowTs);
                return intentFor(conf) === "hot";
              })
              .filter(uniqueLeadActionFilter())
              .slice(0, 5)}
            leads={scopedLeads}
          />
        </section>
      </div>
    </AppShell>
  );
}

function Mini({
  title,
  icon: Icon,
  accent,
  count,
  items,
  leads,
}: {
  title: string;
  icon: typeof Flame;
  accent: "destructive" | "accent";
  count: number;
  items: NextAction[];
  leads: Lead[];
}) {
  const { selectLead } = useApp();
  const cls = accent === "destructive" ? "text-destructive" : "text-accent";
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${cls}`} />
          <h2 className="font-display text-sm font-semibold">{title}</h2>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{count}</span>
      </header>
      <div className="p-2">
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            {title === "Critical now"
              ? "No urgent items. SLA is healthy."
              : "No hot leads right now."}
          </div>
        )}
        {items.map((a) => {
          const lead = leads.find((l) => l.id === a.leadId);
          if (!lead) return null;
          return (
            <button
              key={`${a.leadId}-${a.kind}`}
              onClick={() => selectLead(lead.id)}
              className="w-full text-left rounded-md px-2 py-2 hover:bg-accent/5 transition-colors flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">
                    {resolveBestLeadName(lead)}
                  </span>
                  <StageBadge stage={lead.stage} />
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{a.reason}</div>
              </div>
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} /> {label}
    </span>
  );
}

function greeting(ts: number) {
  const h = new Date(ts).getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function toneFor(a: NextAction): "destructive" | "warning" | "accent" | "default" {
  if (
    a.kind === "post-tour-overdue" ||
    a.kind === "first-response" ||
    a.kind === "follow-up-overdue"
  )
    return "destructive";
  if (a.kind === "no-follow-up") return "warning";
  if (a.kind === "tour-today" || a.kind === "follow-up-today") return "accent";
  return "default";
}

function groupByKind(queue: NextAction[]) {
  return {
    urgent: queue.filter(
      (a) =>
        a.kind === "post-tour-overdue" ||
        a.kind === "first-response" ||
        a.kind === "follow-up-overdue",
    ).length,
    today: queue.filter((a) => a.kind === "follow-up-today" || a.kind === "tour-today").length,
    hot: queue.filter((a) => a.score >= 850).length,
  };
}

function uniqueByLead(actions: NextAction[]): NextAction[] {
  return actions.filter(uniqueLeadActionFilter());
}

function uniqueLeadActionFilter(): (action: NextAction) => boolean {
  const seen = new Set<string>();
  return (action) => {
    if (seen.has(action.leadId)) return false;
    seen.add(action.leadId);
    return true;
  };
}
