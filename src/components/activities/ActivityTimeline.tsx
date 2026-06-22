// Salesforce-style activity timeline. Groups by day, uses colored kind icons,
// shows direction, outcome, duration, and actor. Supports inline delete.
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, Mail, MessageSquare, MessageCircle, Calendar, StickyNote,
  MapPin, Bell, FileText, Receipt, Sparkles, ArrowRightLeft,
  UserPlus, Pencil, Link2, Trash2, Zap,
} from "lucide-react";
import type { Activity, ActivityKind } from "@/contracts";

const KIND_META: Record<ActivityKind, { icon: typeof Phone; label: string; tone: string }> = {
  created:           { icon: Sparkles,      label: "Created",         tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ai_parse:          { icon: Zap,           label: "AI Parsed",       tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  stage_changed:     { icon: ArrowRightLeft,label: "Stage",           tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  assigned:          { icon: UserPlus,      label: "Assigned",        tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  field_changed:     { icon: Pencil,        label: "Updated",         tone: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400" },
  todo_linked:       { icon: Link2,         label: "Todo linked",     tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  tour_scheduled:    { icon: Calendar,      label: "Tour scheduled",  tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  call:              { icon: Phone,         label: "Call",            tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  email:             { icon: Mail,          label: "Email",           tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  sms:               { icon: MessageSquare, label: "SMS",             tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  whatsapp:          { icon: MessageCircle, label: "WhatsApp",        tone: "bg-green-500/10 text-green-600 dark:text-green-400" },
  meeting:           { icon: Calendar,      label: "Meeting",         tone: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
  note:              { icon: StickyNote,    label: "Note",            tone: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  site_visit:        { icon: MapPin,        label: "Site visit",      tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  follow_up:         { icon: Bell,          label: "Follow-up",       tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  quote_sent:        { icon: Receipt,       label: "Quote sent",      tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  document_shared:   { icon: FileText,      label: "Document",        tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  payment_recorded:  { icon: Receipt,       label: "Payment",         tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

interface Props {
  activities: Activity[];
  loading?: boolean;
  onDelete?: (id: string) => void;
  emptyHint?: string;
}

export function ActivityTimeline({ activities, loading, onDelete, emptyHint }: Props) {
  const groups = useMemo(() => groupByDay(activities), [activities]);

  if (loading && activities.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">Loading timeline…</p>;
  }
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">{emptyHint ?? "No activity yet. Log a call, email, or note to start the timeline."}</p>;
  }

  return (
    <div className="relative pl-6">
      {/* vertical rail */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" aria-hidden />
      <div className="space-y-6">
        {groups.map(([day, items]) => (
          <section key={day}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">{day}</div>
            <ul className="space-y-3">
              {items.map((a) => {
                const meta = KIND_META[a.kind] ?? KIND_META.note;
                const Icon = meta.icon;
                return (
                  <li key={a._id} className="relative">
                    <span className={`absolute -left-[18px] top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background ${meta.tone}`}>
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="rounded-md border bg-card px-3 py-2 group hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                          <p className="text-sm font-medium truncate">{a.subject}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onDelete && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onDelete(a._id)} aria-label="Delete activity">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {a.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                      <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{new Date(a.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {a.direction !== "internal" && <span className="capitalize">{a.direction}</span>}
                        {a.outcome && <span className="capitalize">· {a.outcome.replace(/_/g, " ")}</span>}
                        {a.durationSec > 0 && <span>· {Math.round(a.durationSec / 60)} min</span>}
                        <span>· by {a.actor.slice(-6)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByDay(items: Activity[]): Array<[string, Activity[]]> {
  const map = new Map<string, Activity[]>();
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  for (const a of items) {
    const d = new Date(a.occurredAt); d.setHours(0,0,0,0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yest.getTime()) label = "Yesterday";
    else label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(a);
  }
  return Array.from(map.entries());
}
