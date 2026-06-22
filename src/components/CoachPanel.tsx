import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, AlertOctagon, ListTodo, BookOpen, Flame, Trophy,
  Phone, MessageSquare, ChevronRight, Sparkles, Target, Radio, Users2, Zap,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useGame, whoKey } from "@/lib/gamification";
import { useMountedNow } from "@/hooks/use-now";
import { useConnectorFeed } from "@/hooks/use-connector-feed";
import { personName } from "@/lib/people";
import type { ConnectorEvent } from "@/lib/connectors";
import {
  buildCoachReport, HOW_TO, computeBadges,
  type CoachItem, type CoachKind,
} from "@/lib/coach";
import { CoachAutoPilot } from "./CoachAutoPilot";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Props {
  /** When true, panel renders compact (sidebar widget). */
  compact?: boolean;
}

export function CoachPanel({ compact = false }: Props) {
  const role            = useApp((s) => s.role);
  const currentTcmId    = useApp((s) => s.currentTcmId);
  const tcms            = useApp((s) => s.tcms);
  const leads           = useApp((s) => s.leads);
  const tours           = useApp((s) => s.tours);
  const followUps       = useApp((s) => s.followUps);
  const activities      = useApp((s) => s.activities);
  const bookings        = useApp((s) => s.bookings);
  const handoffs        = useApp((s) => s.handoffs);
  const selectLead      = useApp((s) => s.selectLead);
  const completeFollowUp= useApp((s) => s.completeFollowUp);
  const logCall         = useApp((s) => s.logCall);
  const sendMessage     = useApp((s) => s.sendMessage);
  const [now, mounted] = useMountedNow();
  const awardXp = useGame((s) => s.awardXp);
  const rolloverIfNeeded = useGame((s) => s.rolloverIfNeeded);
  const who = whoKey(role, currentTcmId);
  // Subscribe directly to this user's persisted slot so XP awards re-render.
  const userSlot = useGame((s) => s.byUser[who]);
  const stats = mounted
    ? useGame.getState().getStats(who)
    : { xp: 0, streak: 0, xpToday: 0, bookingsClosed: 0, cleared: {}, lastWinDate: null, todayKey: null };
  // ensure dependency tracking
  void userSlot;

  // Day rollover lives in an effect (no store writes from render).
  useEffect(() => {
    if (mounted) rolloverIfNeeded(who);
  }, [mounted, who, rolloverIfNeeded]);

  const report = useMemo(() => {
    if (!mounted) return null;
    return buildCoachReport({
      role, currentTcmId, tcms, leads, tours, followUps,
      activities, bookings, handoffs, now,
      ownerSignals: { staleRooms: 0, pendingBlocks: 0 },
    });
  }, [role, currentTcmId, tcms, leads, tours, followUps, activities, bookings, handoffs, now, mounted]);

  const badges = computeBadges(stats.xp, stats.streak, stats.bookingsClosed);

  if (!mounted || !report) return <CoachSkeleton />;

  const clearItem = (item: CoachItem, label: string) => {
    const earned = awardXp(who, item.xp, item.id);
    if (earned > 0) {
      toast.success(`+${earned} XP · ${label}`, {
        description: item.title,
      });
    }
  };

  const openLead = (leadId?: string) => {
    if (leadId) selectLead(leadId);
  };

  return (
    <div className={cn("space-y-4", compact && "text-[13px]")}>
      {/* HEADER */}
      <div className="flex items-start gap-4">
        <MissionRing pct={report.mission.pct} streak={stats.streak} />
        <div className="flex-1 min-w-0">
          <div className="font-display text-xl font-semibold leading-tight truncate">
            {report.greeting}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{report.subline}</div>
          {report.arc && (
            <div className="mt-1.5 inline-flex items-start gap-1.5 text-[11px] text-accent/90 bg-accent/5 border border-accent/20 rounded-md px-2 py-1">
              <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
              <span><span className="font-semibold">This week:</span> {report.arc}</span>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 font-mono">
              <Trophy className="h-3 w-3" /> {stats.xp} XP
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 font-mono">
              <Flame className="h-3 w-3" /> {stats.streak}d streak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 font-mono">
              <Sparkles className="h-3 w-3" /> +{stats.xpToday} today
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-mono">
              <Target className="h-3 w-3" /> {report.mission.done}/{report.mission.target} mission
            </span>
          </div>
        </div>
      </div>

      {/* PERSONA PLAYBOOK TIP - voice + tactical hint of the day */}
      {report.playbookTip && (
        <div className="rounded-md border border-border bg-card/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            <BookOpen className="h-3 w-3" />
            Today's playbook tip
          </div>
          <div className="text-[12.5px] text-foreground">{report.playbookTip}</div>
        </div>
      )}

      {/* PREDICT-AND-SAVE - leads about to slip in next 6h */}
      <PredictBar leads={leads} tours={tours} now={now} role={role} currentTcmId={currentTcmId} onOpen={openLead} />

      {/* AUTO-PILOT (Coach 4.0) - top-3 plan with confidence + streak multiplier */}
      <CoachAutoPilot
        report={report}
        compact={compact}
        onClear={(item) => {
          const fu = followUps.find((f) => f.leadId === item.leadId && !f.done);
          if (fu) completeFollowUp(fu.id);
          clearItem(item, "Auto-Pilot");
        }}
      />

      {/* TABS */}
      <Tabs defaultValue={report.missed.length > 0 ? "missed" : "todo"} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="done" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Done</span>
            <span className="text-[10px] opacity-70">({report.done.length})</span>
          </TabsTrigger>
          <TabsTrigger value="missed" className="gap-1.5 data-[state=active]:text-destructive">
            <AlertOctagon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Missed</span>
            <span className="text-[10px] opacity-70">({report.missed.length})</span>
          </TabsTrigger>
          <TabsTrigger value="todo" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">To do</span>
            <span className="text-[10px] opacity-70">({report.todo.length})</span>
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live</span>
          </TabsTrigger>
          <TabsTrigger value="how" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">How</span>
          </TabsTrigger>
        </TabsList>

        {/* DONE */}
        <TabsContent value="done" className="mt-3">
          <ScrollArea className={cn(compact ? "h-[260px]" : "h-[420px]")}>
            {report.done.length === 0 ? (
              <Empty
                icon={<Sparkles className="h-5 w-5" />}
                title="Nothing done yet today."
                hint="Clear one Missed item to start your streak."
              />
            ) : (
              <ul className="space-y-1.5 pr-2">
                {report.done.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-md border border-border bg-success/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span className="flex-1 text-sm truncate">{d.text}</span>
                    <span className="text-[11px] font-mono text-success">+{d.xp}</span>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        {/* MISSED */}
        <TabsContent value="missed" className="mt-3">
          <ScrollArea className={cn(compact ? "h-[260px]" : "h-[420px]")}>
            {report.missed.length === 0 ? (
              <Empty
                icon={<CheckCircle2 className="h-5 w-5 text-success" />}
                title="No misses. Clean operator."
                hint="Keep this rolling to grow your streak."
              />
            ) : (
              <ul className="space-y-2 pr-2">
                {report.missed.map((m) => (
                  <ItemRow
                    key={m.id}
                    item={m}
                    severity="missed"
                    onOpen={() => openLead(m.leadId)}
                    onCall={() => { if (m.leadId) { logCall(m.leadId); clearItem(m, "Call logged"); } }}
                    onMessage={() => { if (m.leadId) { sendMessage(m.leadId, "Quick check-in from coach"); clearItem(m, "Message sent"); } }}
                    onMarkDone={() => clearItem(m, "Cleared")}
                  />
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        {/* TODO */}
        <TabsContent value="todo" className="mt-3">
          <ScrollArea className={cn(compact ? "h-[260px]" : "h-[420px]")}>
            {report.todo.length === 0 ? (
              <Empty
                icon={<Sparkles className="h-5 w-5" />}
                title="Inbox zero."
                hint="Use this hour to revive a cold lead or update notes."
              />
            ) : (
              <ul className="space-y-2 pr-2">
                {report.todo.map((t) => (
                  <ItemRow
                    key={t.id}
                    item={t}
                    severity="todo"
                    onOpen={() => openLead(t.leadId)}
                    onCall={() => { if (t.leadId) { logCall(t.leadId); clearItem(t, "Call logged"); } }}
                    onMessage={() => { if (t.leadId) { sendMessage(t.leadId, "Quick check-in from coach"); clearItem(t, "Message sent"); } }}
                    onMarkDone={() => {
                      // Best-effort: complete a matching follow-up if found
                      const fu = followUps.find((f) => f.leadId === t.leadId && !f.done);
                      if (fu) completeFollowUp(fu.id);
                      clearItem(t, "Cleared");
                    }}
                  />
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        {/* LIVE - connector feed across roles */}
        <TabsContent value="live" className="mt-3">
          <ScrollArea className={cn(compact ? "h-[260px]" : "h-[420px]")}>
            <LiveFeed compact={compact} />
          </ScrollArea>
        </TabsContent>

        {/* HOW */}
        <TabsContent value="how" className="mt-3">
          <ScrollArea className={cn(compact ? "h-[260px]" : "h-[420px]")}>
            <HowSection role={role} />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* BADGES */}
      {!compact && (
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Badges</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                title={b.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                  b.earned
                    ? "bg-accent/10 text-accent border border-accent/30"
                    : "bg-muted text-muted-foreground border border-transparent opacity-60",
                )}
              >
                <span className="text-base leading-none">{b.emoji}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ItemRow({
  item, severity, onOpen, onCall, onMessage, onMarkDone,
}: {
  item: CoachItem;
  severity: "missed" | "todo";
  onOpen: () => void;
  onCall: () => void;
  onMessage: () => void;
  onMarkDone: () => void;
}) {
  const [showHow, setShowHow] = useState(false);
  const how = HOW_TO[item.kind];
  return (
    <li className={cn(
      "rounded-md border p-3",
      severity === "missed" ? "border-destructive/30 bg-destructive/5" : "border-border bg-card",
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.title}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{item.why}</div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px] shrink-0">+{item.xp} XP</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.leadId && (
          <>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onCall}>
              <Phone className="h-3 w-3 mr-1" /> Call
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onMessage}>
              <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onOpen}>
              Open <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => setShowHow((v) => !v)}>
          <BookOpen className="h-3 w-3 mr-1" /> How
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-7 px-2 ml-auto"
          onClick={onMarkDone}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Done
        </Button>
      </div>

      {showHow && how && (
        <div className="mt-2 rounded-md bg-muted/40 border border-border p-2.5 text-[12px]">
          <div className="font-semibold text-foreground mb-1.5">{how.goal}</div>
          <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
            {how.steps.map((s, i) => (
              <li key={i}>
                <span className="text-foreground">{s.step}</span>
                {s.hint && <div className="ml-5 text-[11px] italic text-muted-foreground">{s.hint}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

function HowSection({ role }: { role: string }) {
  const kinds: CoachKind[] =
    role === "owner"
      ? ["owner-room-stale", "owner-block-pending"]
      : role === "flow-ops"
        ? ["first-response", "no-follow-up", "flowops-handoff-unread", "flowops-reassign-stuck", "post-tour-overdue"]
        : ["post-tour-overdue", "follow-up-overdue", "tour-today", "hot-untouched", "no-follow-up", "first-response"];

  return (
    <div className="space-y-3 pr-2">
      {kinds.map((k) => {
        const how = HOW_TO[k];
        return (
          <div key={k} className="rounded-md border border-border bg-card p-3">
            <div className="font-semibold text-sm mb-1">{how.goal}</div>
            <ol className="space-y-1.5 text-[12px] list-decimal list-inside text-muted-foreground">
              {how.steps.map((s, i) => (
                <li key={i}>
                  <span className="text-foreground">{s.step}</span>
                  {s.hint && <div className="ml-5 text-[11px] italic">{s.hint}</div>}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
      <div className="mb-2">{icon}</div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs mt-1">{hint}</div>
    </div>
  );
}

/* LIVE FEED - cross-role connector ticker. */
function LiveFeed({ compact }: { compact: boolean }) {
  const events = useConnectorFeed(40);
  if (events.length === 0) {
    return (
      <Empty
        icon={<Radio className="h-5 w-5" />}
        title="The team is quiet right now."
        hint="As Flow Ops, TCMs and Owners act, you'll see it here in real time."
      />
    );
  }
  return (
    <ul className="space-y-1.5 pr-2">
      {events.map((e) => (
        <li key={e.id} className={cn("flex items-start gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5",
          e.kind === "booking.closed" && "border-success/40 bg-success/5",
          e.kind === "post_tour.filled" && "border-accent/30 bg-accent/5",
        )}>
          <FeedDot kind={e.kind} />
          <div className="flex-1 min-w-0">
            <div className={cn("text-[12px] truncate", e.kind === "booking.closed" && "font-medium")}>
              {e.text}
            </div>
            {e.assists && e.assists.length > 0 && (
              <div className="text-[10px] text-accent mt-0.5 inline-flex items-center gap-1">
                <Users2 className="h-3 w-3" /> assist · {e.assists.map((a) => personName(a.id, a.role)).join(", ")}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{relTime(e.ts)}</span>
        </li>
      ))}
      {compact && (
        <li className="text-[10px] text-muted-foreground text-center pt-2">- live across all roles -</li>
      )}
    </ul>
  );
}

function FeedDot({ kind }: { kind: ConnectorEvent["kind"] }) {
  const color =
    kind === "booking.closed" ? "bg-success" :
    kind === "post_tour.filled" ? "bg-accent" :
    kind === "tour.scheduled" ? "bg-info" :
    kind === "tour.completed" ? "bg-info" :
    kind === "owner.room_updated" || kind === "owner.block_decided" ? "bg-warning" :
    kind === "handoff.sent" ? "bg-primary" :
    "bg-muted-foreground";
  return <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", color)} />;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/* PREDICT-AND-SAVE - leads about to slip in next ~6 hours. */
function PredictBar({
  leads, tours, now, role, currentTcmId, onOpen,
}: {
  leads: ReturnType<typeof useApp.getState>["leads"];
  tours: ReturnType<typeof useApp.getState>["tours"];
  now: number;
  role: string;
  currentTcmId: string;
  onOpen: (id?: string) => void;
}) {
  const slipping = useMemo(() => {
    const filterTcm = role === "tcm" ? currentTcmId : undefined;
    return leads
      .filter((l) => (!filterTcm || l.assignedTcmId === filterTcm) && l.stage !== "booked" && l.stage !== "dropped")
      .map((l) => {
        const silentH = (now - +new Date(l.updatedAt)) / 36e5;
        const intentBoost = l.intent === "hot" ? 24 : l.intent === "warm" ? 12 : 4;
        // Risk score 0-100 - silence + intent + recent tour
        const hasUpcoming = tours.some((t) => t.leadId === l.id && t.status === "scheduled");
        const risk = Math.min(100, Math.round(silentH * 4 + intentBoost - (hasUpcoming ? 30 : 0)));
        return { lead: l, risk, silentH };
      })
      .filter((x) => x.risk >= 55)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 3);
  }, [leads, tours, now, role, currentTcmId]);

  if (slipping.length === 0) return null;
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-warning font-semibold mb-1.5">
        <Zap className="h-3 w-3" />
        Predicted to slip · save them now
      </div>
      <ul className="space-y-1">
        {slipping.map(({ lead, risk, silentH }) => (
          <li key={lead.id} className="flex items-center gap-2 text-[12px]">
            <span className="font-mono text-warning shrink-0 w-8">{risk}%</span>
            <span className="flex-1 truncate">
              <span className="font-medium">{lead.name}</span>
              <span className="text-muted-foreground"> · {Math.round(silentH)}h silent · {lead.intent}</span>
            </span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => onOpen(lead.id)}>
              Save
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoachSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/2 bg-muted rounded" />
          <div className="h-3 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/3 bg-muted rounded" />
        </div>
      </div>
      <div className="h-10 bg-muted rounded" />
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}

/* MISSION RING - circular progress with streak in center */
function MissionRing({ pct, streak }: { pct: number; streak: number }) {
  const size = 76;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" className="text-muted" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" className="text-accent transition-all duration-500"
          strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Flame className="h-3.5 w-3.5 text-warning" />
        <div className="text-base font-mono font-bold leading-none mt-0.5">{streak}</div>
        <div className="text-[8px] uppercase tracking-wider text-muted-foreground">streak</div>
      </div>
    </div>
  );
}
