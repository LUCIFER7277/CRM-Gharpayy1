import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Settings2,
  Clock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";
import { useCalendar, KIND_META, type CalEvent, type CalEventKind } from "@/lib/calendar-store";
import { selectBroadcastCalendar, useNotifications } from "@/lib/notifications";
import { MonthView } from "@/components/calendar/MonthView";
import { TimeGridView } from "@/components/calendar/TimeGridView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { EventDialog } from "@/components/calendar/EventDialog";
import { SyncPanel } from "@/components/calendar/SyncPanel";
import { headerLabel, navigate, type CalendarView } from "@/components/calendar/CalendarUtils";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { role, currentTcmId, tours, followUps, leads, properties } = useApp();
  const authUser = useAuthUser((s) => s.user);
  const notifications = useNotifications((s) => s.items);
  const { events } = useCalendar();
  const [view, setView] = useState<CalendarView>("week");
  const [focus, setFocus] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [editing, setEditing] = useState<{
    open: boolean;
    eventId?: string;
    event?: CalEvent;
    defaultStart?: Date;
  }>({ open: false });
  const [syncOpen, setSyncOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CalEventKind | "all">("all");
  const reminderFiredRef = useState(() => new Set<string>())[0];

  // Materialise CRM tours + follow-ups as calendar events (transient, not persisted).
  const crmEvents = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    const activeUserId = authUser?.id ?? currentTcmId;
    const shouldShowMemberOwned = (tcmId?: string | null) => {
      if (role !== "tcm" && (role as string) !== "member") return true;
      if (!tcmId) return true;
      return tcmId === currentTcmId || tcmId === activeUserId;
    };

    for (const t of tours) {
      if (!shouldShowMemberOwned(t.tcmId)) continue;
      const lead = leadMap.get(t.leadId);
      const property = t.propertyId ? propertyMap.get(t.propertyId) : undefined;
      const start = new Date(t.scheduledAt);
      if (Number.isNaN(+start)) continue;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      out.push({
        id: `crm-tour-${t.id}`,
        title: lead ? `Tour · ${lead.name}` : "Tour",
        kind: "tour",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        leadId: t.leadId,
        tourId: t.id,
        location: property
          ? `${property.name} · ${property.area}`
          : lead?.preferredArea || undefined,
        description: [
          lead?.phone ? `Phone: ${lead.phone}` : "",
          lead?.budget ? `Budget: ₹${Math.round(lead.budget / 1000)}k` : "",
          lead?.preferredArea ? `Area: ${lead.preferredArea}` : "",
          t.status ? `Tour status: ${t.status}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        reminder: 15,
        externalSource: "local",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      });
    }

    for (const f of followUps.filter((x) => !x.done)) {
      if (!shouldShowMemberOwned(f.tcmId)) continue;
      const lead = leadMap.get(f.leadId);
      const start = new Date(f.dueAt);
      if (Number.isNaN(+start)) continue;
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      out.push({
        id: `crm-fu-${f.id}`,
        title: lead ? `Follow-up · ${lead.name}` : "Follow-up",
        kind: "follow-up",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        leadId: f.leadId,
        followUpId: f.id,
        description: [
          f.reason,
          lead?.phone ? `Phone: ${lead.phone}` : "",
          lead?.preferredArea ? `Area: ${lead.preferredArea}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        reminder: f.priority === "urgent" ? 10 : 15,
        externalSource: "local",
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
      });
    }
    return out;
  }, [authUser?.id, currentTcmId, followUps, leads, properties, role, tours]);

  const broadcastEvents = useMemo<CalEvent[]>(() => {
    const items = selectBroadcastCalendar(notifications, role, authUser?.id ?? currentTcmId);
    return items.map((n) => {
      const start = new Date(n.dueAt ?? Date.now());
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        id: `broadcast-${n.id}`,
        title: n.title,
        kind: "task" as const,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        description: n.body,
        reminder: 15 as const,
        externalSource: "local" as const,
        externalId: n.id,
        createdAt: new Date(n.ts).toISOString(),
        updatedAt: new Date(n.ts).toISOString(),
      };
    });
  }, [authUser?.id, currentTcmId, notifications, role]);

  const allEvents = useMemo(() => {
    const byKey = new Map<string, CalEvent>();
    const keyFor = (e: CalEvent) =>
      e.tourId
        ? `tour:${e.tourId}`
        : e.followUpId
          ? `follow:${e.followUpId}`
          : e.externalId
            ? `ext:${e.externalId}`
            : `event:${e.id}`;
    for (const e of [...crmEvents, ...broadcastEvents]) {
      byKey.set(keyFor(e), e);
    }
    for (const e of events) {
      const key = keyFor(e);
      const base = byKey.get(key);
      byKey.set(key, base ? { ...base, ...e, id: base.id } : e);
    }
    const merged = Array.from(byKey.values());
    const q = search.trim().toLowerCase();
    return merged
      .filter((e) => {
        if (filter !== "all" && e.kind !== filter) return false;
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location ?? "").toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  }, [broadcastEvents, crmEvents, events, search, filter]);
  const todayEvents = useMemo(
    () => allEvents.filter((event) => isSameDay(new Date(event.start), new Date())).slice(0, 6),
    [allEvents],
  );

  // Reminders: calendar-wide scheduler for manual, CRM and broadcast events.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const e of allEvents) {
        if (!e.reminder) continue;
        const trigger = +new Date(e.start) - e.reminder * 60000;
        const fireKey = `${e.id}:${e.start}:${e.reminder}`;
        if (now >= trigger && now < trigger + 120000 && !reminderFiredRef.has(fireKey)) {
          reminderFiredRef.add(fireKey);
          playCalendarReminderSound();
          toast.info(e.title, {
            description: `Starts ${(e.reminder as number) === 0 ? "now" : `in ${e.reminder} min`} · ${format(new Date(e.start), "p")}`,
          });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(e.title, {
              body: `In ${e.reminder} min · ${format(new Date(e.start), "p")}`,
            });
          }
        }
      }
    };
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [allEvents, reminderFiredRef]);

  const openEvent = (e: CalEvent) => {
    setEditing({ open: true, eventId: e.id, event: e });
  };

  const openSlot = (start: Date) => {
    setEditing({ open: true, defaultStart: start });
  };

  const openDay = (d: Date) => {
    setSelectedDay(d);
    if (view === "month") {
      // Open new event for that day at 9am
      const slot = new Date(d);
      slot.setHours(9, 0, 0, 0);
      // Don't auto-open - just select. Double-click via button below opens.
    }
  };

  const goToday = () => setFocus(new Date());

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3rem)] p-4 gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Calendar</h1>
            <Badge variant="secondary" className="ml-1">
              {allEvents.length} events
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
                className="pl-8 h-9 w-56"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as CalEventKind | "all")}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(KIND_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSyncOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1.5" /> Sync
            </Button>
            <Button
              onClick={() => setEditing({ open: true, defaultStart: selectedDay ?? new Date() })}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New event
            </Button>
          </div>
        </div>

        {/* Sub-toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={goToday}>
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setFocus(navigate(view, focus, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setFocus(navigate(view, focus, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 font-display text-lg">{headerLabel(view, focus)}</span>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex gap-3">
          <aside className="hidden lg:flex flex-col w-56 border rounded-lg bg-card p-3 gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Today
                </div>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {todayEvents.length}
                </Badge>
              </div>
              {todayEvents.length === 0 ? (
                <div className="rounded-md border border-dashed px-2 py-3 text-xs text-muted-foreground">
                  No calendar work due today.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todayEvents.map((event) => {
                    const meta = KIND_META[event.kind];
                    return (
                      <button
                        key={event.id}
                        onClick={() => openEvent(event)}
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-left text-xs transition hover:bg-accent/40"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {event.allDay ? "All day" : format(new Date(event.start), "h:mm a")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                My calendars
              </div>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(KIND_META).map(([k, m]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
                    <span>{m.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Connected
              </div>
              <ConnectionsList onOpen={() => setSyncOpen(true)} />
            </div>
            <div className="mt-auto text-xs text-muted-foreground">
              <p>Tours and follow-ups from your CRM appear here automatically.</p>
            </div>
          </aside>

          {view === "month" && (
            <MonthView
              focus={focus}
              events={allEvents}
              onEventClick={openEvent}
              onDayClick={openDay}
              selectedDay={selectedDay}
            />
          )}
          {(view === "week" || view === "day") && (
            <TimeGridView
              focus={focus}
              events={allEvents}
              view={view}
              onEventClick={openEvent}
              onSlotClick={openSlot}
            />
          )}
          {view === "agenda" && <AgendaView events={allEvents} onEventClick={openEvent} />}
        </div>
      </div>

      <EventDialog
        open={editing.open}
        onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))}
        eventId={editing.eventId}
        event={editing.event}
        defaultStart={editing.defaultStart}
      />
      <SyncPanel open={syncOpen} onOpenChange={setSyncOpen} eventsOverride={allEvents} />
    </AppShell>
  );
}

function playCalendarReminderSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.38);
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Browser may block audio until the user has interacted. Toast/browser notifications still work.
  }
}

function ConnectionsList({ onOpen }: { onOpen: () => void }) {
  const { connections } = useCalendar();
  if (connections.length === 0) {
    return (
      <button onClick={onOpen} className="text-xs text-primary hover:underline">
        Connect Google, Outlook, or ICS →
      </button>
    );
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {connections.map((c) => (
        <li key={c.provider} className="flex items-center justify-between">
          <span className="capitalize">{c.provider}</span>
          <span className="text-muted-foreground truncate ml-2">{c.account}</span>
        </li>
      ))}
    </ul>
  );
}
