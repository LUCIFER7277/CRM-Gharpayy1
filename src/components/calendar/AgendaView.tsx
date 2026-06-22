import { format, isSameDay } from "date-fns";
import { KIND_META, type CalEvent } from "@/lib/calendar-store";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, MapPin, Users } from "lucide-react";

interface Props {
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}

export function AgendaView({ events, onEventClick }: Props) {
  const upcoming = events
    .filter((e) => new Date(e.end) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 50);

  if (upcoming.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border rounded-lg bg-card">
        <div className="text-center py-12">
          <CalendarIcon className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No upcoming events.</p>
          <p className="text-xs mt-1">Press “New event” to add one.</p>
        </div>
      </div>
    );
  }

  // group by day
  const groups = new Map<string, CalEvent[]>();
  for (const e of upcoming) {
    const k = format(new Date(e.start), "yyyy-MM-dd");
    const arr = groups.get(k) ?? [];
    arr.push(e);
    groups.set(k, arr);
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto border rounded-lg bg-card">
      <ul className="divide-y">
        {Array.from(groups.entries()).map(([key, list]) => {
          const day = new Date(key + "T00:00:00");
          const today = isSameDay(day, new Date());
          return (
            <li key={key}>
              <div className={cn("sticky top-0 bg-card/90 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wide", today ? "text-primary" : "text-muted-foreground")}>
                {format(day, "EEEE, MMMM d")}{today && " · Today"}
              </div>
              <ul>
                {list.map((e) => {
                  const m = KIND_META[e.kind];
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => onEventClick(e)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/40"
                      >
                        <span className="mt-1 inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-medium truncate">{e.title}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {e.allDay
                                ? "All day"
                                : `${format(new Date(e.start), "h:mma").toLowerCase()} – ${format(new Date(e.end), "h:mma").toLowerCase()}`}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className={cn("rounded px-1.5 py-0.5", m.bg, m.text)}>{m.label}</span>
                            {e.location && (
                              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                            )}
                            {e.attendees && e.attendees.length > 0 && (
                              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.attendees.length}</span>
                            )}
                            {e.externalSource && e.externalSource !== "local" && (
                              <span className="uppercase tracking-wide">{e.externalSource}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
