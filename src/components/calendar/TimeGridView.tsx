import { format, isSameDay, isToday } from "date-fns";
import { useEffect, useRef } from "react";
import { KIND_META, type CalEvent } from "@/lib/calendar-store";
import { HOURS, durationMinutes, eventsForDay, minutesFromMidnight, weekDays } from "./CalendarUtils";
import { cn } from "@/lib/utils";

interface Props {
  focus: Date;
  events: CalEvent[];
  view: "week" | "day";
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (start: Date) => void;
}

const SLOT_PX = 48;

export function TimeGridView({ focus, events, view, onEventClick, onSlotClick }: Props) {
  const days = view === "week" ? weekDays(focus) : [focus];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SLOT_PX * 7;
    }
  }, []);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="flex-1 min-h-0 border rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="grid border-b" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="border-l px-2 py-2 text-center">
              <div className="text-xs text-muted-foreground uppercase">{format(d, "EEE")}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold",
                  today && "bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground text-right pr-2 border-b"
                style={{ height: SLOT_PX }}
              >
                {h === 0 ? "" : format(new Date(2024, 0, 1, h), "h a")}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayEvents = eventsForDay(events, d).filter((e) => !e.allDay);
            const eventLayouts = layoutOverlappingEvents(dayEvents);
            const showNowLine = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className="relative border-l">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b cursor-pointer hover:bg-accent/30"
                    style={{ height: SLOT_PX }}
                    onClick={() => {
                      const slot = new Date(d);
                      slot.setHours(h, 0, 0, 0);
                      onSlotClick(slot);
                    }}
                  />
                ))}

                {showNowLine && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: (currentMinutes / 60) * SLOT_PX }}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
                    <div className="h-px flex-1 bg-red-500" />
                  </div>
                )}

                {eventLayouts.map(({ event: e, column, columns }) => {
                  const top = (minutesFromMidnight(e.start) / 60) * SLOT_PX;
                  const height = Math.max(30, (durationMinutes(e) / 60) * SLOT_PX - 3);
                  const m = KIND_META[e.kind];
                  const gutter = 4;
                  const width = `calc((100% - ${gutter * (columns + 1)}px) / ${columns})`;
                  const left = `calc(${gutter}px + ${column} * (${width} + ${gutter}px))`;
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className={cn(
                        "absolute rounded-md border px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md focus:z-20 focus:outline-none focus:ring-2 focus:ring-ring",
                        m.bg,
                        m.text,
                      )}
                      style={{ top, height, left, width, borderColor: m.color }}
                    >
                      <div className="font-semibold truncate">{e.title}</div>
                      <div className="opacity-75 truncate">
                        {format(new Date(e.start), "h:mma").toLowerCase()} – {format(new Date(e.end), "h:mma").toLowerCase()}
                      </div>
                      {height > 42 && e.location && <div className="opacity-75 truncate">{e.location}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function layoutOverlappingEvents(events: CalEvent[]) {
  const sorted = events
    .slice()
    .sort((a, b) => +new Date(a.start) - +new Date(b.start) || +new Date(a.end) - +new Date(b.end));
  const active: Array<{ event: CalEvent; column: number }> = [];
  const layouts: Array<{ event: CalEvent; column: number; columns: number; group: number }> = [];
  let group = 0;
  let groupMaxColumns = 1;
  let groupIndexes: number[] = [];

  const closeGroup = () => {
    for (const index of groupIndexes) {
      layouts[index].columns = groupMaxColumns;
    }
    groupIndexes = [];
    groupMaxColumns = 1;
  };

  sorted.forEach((event) => {
    const start = +new Date(event.start);
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (+new Date(active[i].event.end) <= start) active.splice(i, 1);
    }
    if (active.length === 0 && groupIndexes.length > 0) {
      closeGroup();
      group += 1;
    }

    const used = new Set(active.map((item) => item.column));
    let column = 0;
    while (used.has(column)) column += 1;
    active.push({ event, column });
    groupMaxColumns = Math.max(groupMaxColumns, active.length, column + 1);
    const index = layouts.push({ event, column, columns: 1, group }) - 1;
    groupIndexes.push(index);
  });
  closeGroup();
  return layouts;
}
