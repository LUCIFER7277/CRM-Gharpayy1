import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Inbox, AlertTriangle, Sparkles, Circle, UserCheck, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  startNotificationsBridge,
  type AppNotification,
  type NotifSeverity,
} from "@/lib/notifications";
import type { Role } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useAppState } from "@/myt/lib/app-context";
import { useAssignmentNotifications } from "@/lib/assignment-notifications-store";
import { AssignmentNotificationCard } from "@/components/AssignmentNotificationCard";
import { useAuthUser } from "@/lib/auth-store";

const sevDot: Record<NotifSeverity, string> = {
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warning",
  urgent: "bg-destructive",
};

function timeAgo(ts: number, now: number): string {
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationCenter({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement | null>(null);
  const authUser = useAuthUser((s) => s.user);

  useEffect(() => { startNotificationsBridge(); }, []);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const currentTcmId = useApp((s) => s.currentTcmId);
  const { currentMemberId } = useAppState();
  const recipientId = currentMemberId ?? (role === "tcm" ? currentTcmId : undefined);
  const unread = useUnreadCount(role, recipientId);
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const markRead = useNotifications((s) => s.markRead);

  // Assignment notifications (server-backed)
  const { pending: allAssignments, refresh: refreshAssignments } = useAssignmentNotifications();
  const pendingAssignments = allAssignments.filter(a => a.status === "pending");

  useEffect(() => {
    refreshAssignments();
    // Refresh assignments every minute just in case
    const int = setInterval(refreshAssignments, 60000);
    return () => clearInterval(int);
  }, [refreshAssignments]);

  const myId = recipientId;
  const visible: AppNotification[] = items.filter(
    (n) =>
      (n.audience.length === 0 || n.audience.includes(role)) &&
      (n.recipientId ? n.recipientId === myId : true),
  );

  // Total badge count = unread regular + pending assignments
  const totalBadge = unread + pendingAssignments.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-mono font-semibold flex items-center justify-center ring-2 ring-background">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-90 max-w-[92vw] rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl z-50"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Inbox
              {totalBadge > 0 && (
                <span className="text-[10px] font-mono rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5">
                  {totalBadge} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => markAllRead(role, recipientId)}
              disabled={unread === 0}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 inline-flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark all read
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto overscroll-contain">
            {/* 1. Pending Assignments Block */}
            {pendingAssignments.length > 0 && (
              <div className="border-b border-border/50 bg-background/50">
                <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground bg-muted/30">
                  Pending assignments ({pendingAssignments.length})
                </div>
                {pendingAssignments.slice(0, 3).map((notif) => (
                  <AssignmentNotificationCard
                    key={notif._id}
                    notification={notif}
                    currentUserId={recipientId}
                    compact
                    onActionComplete={() => {
                      if (pendingAssignments.length === 1 && unread === 0) setOpen(false);
                    }}
                  />
                ))}
                {pendingAssignments.length > 3 && (
                  <Link
                    to="/inbox"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-xs text-center font-medium text-accent hover:bg-accent/5 transition-colors"
                  >
                    +{pendingAssignments.length - 3} more — view in Inbox
                  </Link>
                )}
              </div>
            )}

            {/* Empty state if nothing at all */}
            {visible.length === 0 && pendingAssignments.length === 0 ? (
              <div className="px-4 py-8 text-center flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">You're all caught up</p>
                <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
              </div>
            ) : (
              <>
                {visible.length > 0 && pendingAssignments.length > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 border-b border-border/50">
                    Other notifications
                  </div>
                )}
                {visible.slice(0, 40).map((n) => {
                  const Body = (
                    <div className="flex gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/50 last:border-b-0">
                      <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", sevDot[n.severity])} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-semibold truncate", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</span>
                          {!n.read && <Circle className="h-1.5 w-1.5 fill-accent text-accent shrink-0" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">{timeAgo(n.ts, now)} ago</div>
                      </div>
                      {n.severity === "urgent" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-1" />}
                    </div>
                  );
                  const onClick = () => { markRead(n.id); setOpen(false); };
                  return n.href ? (
                    <Link key={n.id} to={n.href} onClick={onClick} className="block">
                      {Body}
                    </Link>
                  ) : (
                    <button key={n.id} type="button" onClick={onClick} className="block w-full text-left">
                      {Body}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
