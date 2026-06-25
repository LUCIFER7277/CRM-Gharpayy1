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
import { Sun, Flame, AlertTriangle, Phone, Trophy, Zap, ArrowUpRight, CheckCircle2 } from "lucide-react";
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
  const top = visibleQueue.slice(0, 10);
  const grouped = groupByKind(queue);

  const criticalItems = useMemo(
    () =>
      queue
        .filter((a) => a.kind === "post-tour-overdue" || a.kind === "first-response")
        .filter(uniqueLeadActionFilter()),
    [queue]
  );

  const hotItems = useMemo(
    () =>
      queue
        .filter((a) => {
          const lead = scopedLeads.find((l) => l.id === a.leadId);
          if (!lead || !isLeadActive(lead)) return false;
          const nowTs = now || Date.now();
          const conf = liveConfidence(lead, scopedTours, nowTs);
          return intentFor(conf) === "hot";
        })
        .filter(uniqueLeadActionFilter()),
    [queue, scopedLeads, scopedTours, now]
  );

  return (
    <AppShell>
      <div className="space-y-8 animate-in fade-in duration-500">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Sun className="h-3.5 w-3.5 animate-pulse" />
              <span className="min-h-[1em]">
                {mounted ? format(new Date(now), "EEEE, MMMM d · h:mm a") : "\u00a0"}
              </span>
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent drop-shadow-sm">
              {mounted ? greeting(now) : "Hello"}
              {me ? `, ${me.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="text-sm text-muted-foreground">
              {top.length === 0
                ? "Inbox zero. Nothing pending right now."
                : `${queue.length} action${queue.length > 1 ? "s" : ""} ranked. Start at the top.`}
            </p>
          </div>
          <Link to="/leads" className="text-sm font-medium text-primary inline-flex items-center gap-1.5 hover:text-primary/80 transition-all bg-primary/10 hover:bg-primary/20 border border-primary/20 px-4 py-2 rounded-full backdrop-blur-sm hover:shadow-md hover:shadow-primary/5">
            All leads <ArrowUpRight className="h-4 w-4" />
          </Link>
        </header>

        {/* Personal KPIs for TCM */}
        {perf && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassKpiCard label="My leads" value={perf.leadCount} sub={`${perf.toursDone} tours done`} />
            <GlassKpiCard
              label="My conversion"
              value={`${perf.conversion}%`}
              sub={`${perf.bookings} booked`}
              tone="success"
            />
            <GlassKpiCard
              label="Pending post-tour"
              value={perf.pendingPostTour}
              sub="Fill now"
              tone={perf.pendingPostTour ? "destructive" : "default"}
            />
            <GlassKpiCard
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
        <section className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">Do this next</h2>
              <span className="text-[10px] text-muted-foreground font-mono">{queue.length} ranked</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <Legend color="bg-destructive" label={`${grouped.urgent} urgent`} />
              <Legend color="bg-warning" label={`${grouped.today} today`} />
              <Legend color="bg-primary" label={`${grouped.hot} hot`} />
              <div className="w-px h-4 bg-border mx-1" />
              <Link to="/leads" className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium">
                All leads <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </header>
          {top.length === 0 ? (
            <div className="px-6 py-16 text-center bg-gradient-to-b from-transparent to-success/5">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4 shadow-inner">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="font-display text-xl font-semibold text-foreground/90">Inbox zero.</div>
              <div className="text-sm text-muted-foreground mt-1">
                Take a breath. New leads will land here automatically.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto scrollbar-none">
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
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Mini
            title="Critical now"
            icon={AlertTriangle}
            accent="destructive"
            count={criticalItems.length}
            items={criticalItems.slice(0, 10)}
            leads={scopedLeads}
            action={<Link to="/leads" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">All leads <ArrowUpRight className="h-3 w-3" /></Link>}
          />
          <Mini
            title="Hot pipeline"
            icon={Flame}
            accent="accent"
            count={hotItems.length}
            items={hotItems.slice(0, 10)}
            leads={scopedLeads}
            action={<Link to="/leads" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">All leads <ArrowUpRight className="h-3 w-3" /></Link>}
          />
        </section>
      </div>
    </AppShell>
  );
}

function GlassKpiCard({
  label, value, sub, tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "accent" | "success" | "warning" | "destructive";
}) {
  const toneMap = {
    default: "from-card/60 to-card/40 bg-card/30 border-border/50 text-foreground",
    accent: "from-primary/10 to-primary/5 bg-primary/5 border-primary/20 text-primary",
    success: "from-success/10 to-success/5 bg-success/5 border-success/20 text-success",
    warning: "from-warning/10 to-warning/5 bg-warning/5 border-warning/20 text-warning-foreground",
    destructive: "from-destructive/10 to-destructive/5 bg-destructive/5 border-destructive/20 text-destructive",
  }[tone];

  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 bg-gradient-to-br ${toneMap} group`}>
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="mt-3 font-display text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground/80 mt-1.5 font-medium">{sub}</div>}
      </div>
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute -inset-x-4 -inset-y-4 z-0 bg-gradient-to-r from-transparent via-current/5 to-transparent rotate-45 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none" />
    </div>
  );
}

function Mini({
  title,
  icon: Icon,
  accent,
  count,
  items,
  leads,
  action,
}: {
  title: string;
  icon: typeof Flame;
  accent: "destructive" | "accent";
  count: number;
  items: NextAction[];
  leads: Lead[];
  action?: React.ReactNode;
}) {
  const { selectLead } = useApp();
  const cls = accent === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${cls}`} />
          <h2 className="font-display text-sm font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {action}
        </div>
      </header>
      <div className="flex-1 flex flex-col overflow-y-auto max-h-[350px] scrollbar-none divide-y divide-border -mx-px">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8 m-auto">
            {title === "Critical now"
              ? "No urgent items. SLA is healthy."
              : "No hot leads right now."}
          </div>
        )}
        {items.map((a) => {
          const lead = leads.find((l) => l.id === a.leadId);
          if (!lead) return null;
          return (
            <QuickActionRow
              key={`${a.leadId}-${a.kind}`}
              lead={lead}
              reason={a.reason}
              accent={accent}
              compact={true}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color} shadow-sm`} /> {label}
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

