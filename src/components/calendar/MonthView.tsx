import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import { KIND_META, type CalEvent } from "@/lib/calendar-store";
import { eventsForDay, monthGrid } from "./CalendarUtils";
import { cn } from "@/lib/utils";

interface Props {
  focus: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onDayClick: (d: Date) => void;
  selectedDay?: Date;
}

export function MonthView({ focus, events, onEventClick, onDayClick, selectedDay }: Props) {
  const days = monthGrid(focus);
  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {headers.map((h) => (
          <div key={h} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {days.map((d) => {
          const inMonth = isSameMonth(d, focus);
          const today = isToday(d);
          const selected = selectedDay && isSameDay(d, selectedDay);
          const dayEvents = eventsForDay(events, d);
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              className={cn(
                "border-b border-r p-1.5 text-left flex flex-col gap-1 min-h-0 hover:bg-accent/40 transition-colors",
                !inMonth && "bg-muted/20 text-muted-foreground",
                selected && "ring-2 ring-inset ring-primary",
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center text-xs font-medium h-6 w-6 rounded-full",
                  today && "bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {visible.map((e) => {
                  const m = KIND_META[e.kind];
                  return (
                    <span
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[11px] cursor-pointer",
                        m.bg,
                        m.text,
                      )}
                      title={e.title}
                    >
                      {!e.allDay && (
                        <span className="opacity-70 mr-1">{format(new Date(e.start), "h:mma").toLowerCase()}</span>
                      )}
                      {e.title}
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[11px] text-muted-foreground pl-1">+{overflow} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
