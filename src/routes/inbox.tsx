import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Inbox as InboxIcon, Bell, ListTodo, CalendarDays, Mail, CheckCircle2, Filter, Send, AlertCircle, UserCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/lib/store";
import { useNotifications, selectInboxFor, type NotifChannel } from "@/lib/notifications";
import { activePersona, PERSONA_BY_ID } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { hasCapturedLeadName } from "@/lib/lead-helpers";
import { formatDistanceToNow } from "date-fns";
import { HRBroadcastComposer } from "@/components/HRBroadcastComposer";
import { useAppState } from "@/myt/lib/app-context";
import { useAssignmentNotifications } from "@/lib/assignment-notifications-store";
import { AssignmentNotificationCard } from "@/components/AssignmentNotificationCard";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

type Tab = "all" | "assignments" | "todo" | "calendar" | "email" | "broadcasts" | "tours";

function InboxPage() {
  const role = useApp((s) => s.role);
  const currentTcmId = useApp((s) => s.currentTcmId);
  const leads = useApp((s) => s.leads);
  const tours = useApp((s) => s.tours);
  const { currentMemberId } = useAppState();
  const recipientId = currentMemberId ?? (role === "tcm" ? currentTcmId : undefined);
  const me = activePersona(role, role === "tcm" ? currentTcmId : undefined);
  const authUser = useAuthUser((s) => s.user);

  // Regular notifications
  const items = useNotifications((s) => s.items);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const toggleTodoDone = useNotifications((s) => s.toggleTodoDone);
  const removeNotifications = useNotifications((s) => s.removeMany);

  // Assignment notifications (from server)
  const { pending: allAssignments, refresh: refreshAssignments } = useAssignmentNotifications();
  const truePending = useMemo(() => allAssignments.filter(a => a.status === "pending"), [allAssignments]);
  const pendingAssignments = allAssignments; // Keep pendingAssignments as an alias for allAssignments for the rest of the file to render them

  // Refresh pending assignments on mount and when the user logs in
  useEffect(() => {
    if (authUser?.id) {
      refreshAssignments();
    }
  }, [authUser?.id, refreshAssignments]);

  const currentLeadIds = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const currentTourIds = useMemo(() => new Set(tours.map((tour) => tour.id)), [tours]);
  const capturedLeadIds = useMemo(
    () => new Set(leads.filter((lead) => hasCapturedLeadName(lead)).map((lead) => lead.id)),
    [leads],
  );
  const isStaleTourNotification = useMemo(() => {
    return (item: typeof items[number]) => {
      if (item.kind !== "tour.scheduled") return false;
      if (item.tourId && !currentTourIds.has(item.tourId)) return true;
      if (item.leadId && !currentLeadIds.has(item.leadId)) return true;
      if (item.leadId && !capturedLeadIds.has(item.leadId)) return true;
      return item.body.includes("Lead name not captured");
    };
  }, [capturedLeadIds, currentLeadIds, currentTourIds]);
  const inbox = useMemo(() => {
    return selectInboxFor(items, role, recipientId).filter((item) => !isStaleTourNotification(item));
  }, [isStaleTourNotification, items, role, recipientId]);

  useEffect(() => {
    const staleIds = selectInboxFor(items, role, recipientId)
      .filter(isStaleTourNotification)
      .map((item) => item.id);
    removeNotifications(staleIds);
  }, [isStaleTourNotification, items, recipientId, removeNotifications, role]);
  const [tab, setTab] = useState<Tab>("assignments");

  // Default to "assignments" if there are pending ones, otherwise "all"
  useEffect(() => {
    if (truePending.length > 0) {
      setTab("assignments");
    } else {
      setTab("all");
    }
  }, [truePending.length]);

  const filtered = useMemo(() => {
    if (tab === "all") return inbox;
    if (tab === "broadcasts") return inbox.filter((n) => n.kind === "broadcast");
    if (tab === "tours") return inbox.filter((n) => n.kind === "tour.scheduled");
    if (tab === "todo") return inbox.filter((n) => n.channels?.includes("todo"));
    if (tab === "calendar") return inbox.filter((n) => n.channels?.includes("calendar"));
    if (tab === "email") return inbox.filter((n) => n.emailQueued);
    return inbox;
  }, [inbox, tab]);

  const counts = {
    all: inbox.length + allAssignments.length,
    assignments: allAssignments.length,
    broadcasts: inbox.filter((n) => n.kind === "broadcast").length,
    tours: inbox.filter((n) => n.kind === "tour.scheduled").length,
    todo: inbox.filter((n) => n.channels?.includes("todo") && !n.todoDone).length,
    calendar: inbox.filter((n) => n.channels?.includes("calendar")).length,
    email: inbox.filter((n) => n.emailQueued).length,
  };
  const unread = inbox.filter((n) => !n.read).length;

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <InboxIcon className="h-3.5 w-3.5" />
              <span>Inbox · {me.name}</span>
              <Badge variant="outline" className="text-[10px] font-mono">{labelForRole(role)}</Badge>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Everything you need to act on, in one place.
            </h1>
            <p className="text-sm text-muted-foreground">
              {truePending.length > 0 && (
                <span className="text-accent font-medium mr-1">
                  {truePending.length} pending assignment{truePending.length > 1 ? "s" : ""} ·
                </span>
              )}
              {inbox.length === 0
                ? "Nothing else to do right now."
                : `${unread} unread · ${counts.todo} open todos · ${counts.calendar} calendar items.`}
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => markAllRead(role, recipientId)}
            disabled={unread === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Mark all read
          </Button>
        </header>

        {/* HR can compose broadcasts straight from inbox */}
        {role === "hr" && <HRBroadcastComposer />}

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Filter className="h-3 w-3 text-muted-foreground mr-1" />
          {([
            ["assignments", "Assignments", UserCheck, counts.assignments],
            ["all", "All", InboxIcon, counts.all],
            ["broadcasts", "From HR", Send, counts.broadcasts],
            ["tours", "Tours", Bell, counts.tours],
            ["todo", "Todo", ListTodo, counts.todo],
            ["calendar", "Calendar", CalendarDays, counts.calendar],
            ["email", "Email", Mail, counts.email],
          ] as const).map(([k, label, Icon, n]) => (
            <button
              key={k}
              onClick={() => setTab(k as Tab)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5",
                tab === k
                  ? k === "assignments" && n > 0
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              <span className={cn(
                "font-mono text-[10px] opacity-70",
                k === "assignments" && n > 0 && tab !== k && "opacity-100 text-accent font-bold",
              )}>({n})</span>
            </button>
          ))}
        </div>

        <ScrollArea className="h-[calc(100vh-360px)] min-h-[400px] pr-2">
          {/* Assignment notifications panel */}
          {(tab === "assignments" || (tab === "all" && pendingAssignments.length > 0)) && (
            <div className="space-y-2 mb-4">
              {tab === "assignments" && pendingAssignments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No pending assignments. You're all caught up!
                </div>
              ) : (
                <>
                  {tab === "all" && <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 pl-1">Assignments</h3>}
                  <ul className="space-y-2">
                    {pendingAssignments.map((notif) => (
                      <AssignmentNotificationCard
                        key={notif._id}
                        notification={notif}
                        currentUserId={authUser?.id}
                        onActionComplete={refreshAssignments}
                      />
                    ))}
                  </ul>
                  {tab === "all" && filtered.length > 0 && <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6 pl-1">Other Notifications</h3>}
                </>
              )}
            </div>
          )}

          {/* Regular inbox items */}
          {tab !== "assignments" && (
            <>
              {filtered.length === 0 && (tab !== "all" || pendingAssignments.length === 0) ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Nothing here yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((n) => {
                    const sender = n.senderId ? PERSONA_BY_ID[n.senderId] : undefined;
                    const overdue = n.dueAt ? n.dueAt < Date.now() : false;
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "rounded-lg border p-3",
                          severityClass(n.severity),
                          !n.read && "ring-1 ring-accent/20",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <SeverityDot severity={n.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{n.title}</span>
                              {n.kind === "broadcast" && (
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  From {sender?.name.split(" ")[0] ?? "HR"}
                                </Badge>
                              )}
                              {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                            </div>
                            <p className="text-[12px] text-muted-foreground mt-0.5">{n.body}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="font-mono">{formatDistanceToNow(n.ts, { addSuffix: true })}</span>
                              {n.dueAt && (
                                <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                                  overdue ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
                                  {overdue ? <AlertCircle className="h-2.5 w-2.5" /> : <CalendarDays className="h-2.5 w-2.5" />}
                                  due {formatDistanceToNow(n.dueAt, { addSuffix: true })}
                                </span>
                              )}
                              {(n.channels ?? []).map((c) => <ChannelChip key={c} c={c} />)}
                              {n.emailQueued && (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-info/10 text-info">
                                  <Mail className="h-2.5 w-2.5" /> email queued
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {n.channels?.includes("todo") && (
                              <Button
                                variant={n.todoDone ? "outline" : "default"}
                                size="sm" className="h-7 text-[11px]"
                                onClick={() => toggleTodoDone(n.id)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {n.todoDone ? "Reopen" : "Done"}
                              </Button>
                            )}
                            {n.href && (
                              <Link
                                to={n.href}
                                onClick={() => markRead(n.id)}
                                className="text-[11px] text-accent hover:underline"
                              >
                                Open
                              </Link>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </ScrollArea>
      </div>
    </AppShell>
  );
}

function ChannelChip({ c }: { c: NotifChannel }) {
  const map: Record<NotifChannel, { Icon: typeof Bell; label: string }> = {
    "in-app": { Icon: Bell, label: "in-app" },
    todo: { Icon: ListTodo, label: "todo" },
    calendar: { Icon: CalendarDays, label: "calendar" },
    email: { Icon: Mail, label: "email" },
  };
  const { Icon, label } = map[c];
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-muted/60">
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const cls =
    severity === "urgent" ? "bg-destructive" :
    severity === "warn" ? "bg-warning" :
    severity === "success" ? "bg-success" :
    "bg-info";
  return <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", cls)} />;
}

function severityClass(severity: string): string {
  if (severity === "urgent") return "border-destructive/30 bg-destructive/5";
  if (severity === "warn") return "border-warning/30 bg-warning/5";
  if (severity === "success") return "border-success/30 bg-success/5";
  return "border-border bg-card";
}

function labelForRole(r: string): string {
  return r === "tcm" ? "TCM" : r === "flow-ops" ? "Flow Ops" : r === "hr" ? "HR" : "Owner";
}
