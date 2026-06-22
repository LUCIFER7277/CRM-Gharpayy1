// "Find my PG" contact card — every property exposes Manager + Owner + Zone TCM.
// Tap-to-call, prefilled WhatsApp scripts, "best time to call" hints, and a
// one-click .ics download to add a visit slot to Google/Apple/Outlook calendar.

import { useMemo } from "react";
import type { PG } from "@/property-genius/data/types";
import { ZONES, areaToZone } from "@/property-genius/data/zones";
import { getZonePhone } from "@/property-genius/lib/zoneOverrides";
import { waLink, telLink } from "@/property-genius/lib/wa";
import { Phone, MessageCircle, Calendar as CalendarIcon, Clock, MapPin, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pg: PG;
  /** Optional visit slot (ISO) — when present, the .ics button uses it. */
  slotISO?: string;
  /** Lead name to personalise the WhatsApp scripts. */
  leadName?: string;
}

function bestWindow(now = new Date()): { label: string; tone: "success" | "warning" | "muted" } {
  const h = now.getHours();
  if (h >= 10 && h < 13) return { label: "Best time — call now (10am–1pm)", tone: "success" };
  if (h >= 16 && h < 20) return { label: "Good time — call now (4pm–8pm)", tone: "success" };
  if (h >= 13 && h < 16) return { label: "Lunch lull — try after 4pm", tone: "warning" };
  if (h >= 20 && h < 22) return { label: "Late window — keep it short", tone: "warning" };
  return { label: "Off-hours — WhatsApp first, call after 10am", tone: "muted" };
}

function icsForVisit(pg: PG, slotISO: string, leadName?: string) {
  const start = new Date(slotISO);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = `PG Visit — ${pg.name}`;
  const loc = pg.mapsLink || `${pg.area}, ${pg.locality || "Bangalore"}`;
  const desc =
    `${leadName ? leadName + " visiting " : "Visit "}${pg.name}\\n` +
    `Manager: ${pg.manager?.name || ""} ${pg.manager?.phone || ""}\\n` +
    `Owner: ${pg.owner?.name || ""} ${pg.owner?.phone || ""}\\n` +
    `Maps: ${pg.mapsLink || ""}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gharpayy//Visit//EN",
    "BEGIN:VEVENT",
    `UID:${pg.id}-${start.getTime()}@gharpayy`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${loc.replace(/\n/g, " ")}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function gcalLink(pg: PG, slotISO: string, leadName?: string) {
  const start = new Date(slotISO);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = encodeURIComponent(`PG Visit — ${pg.name}`);
  const details = encodeURIComponent(
    `${leadName ? leadName + " visiting " : "Visit "}${pg.name}\n` +
    `Manager: ${pg.manager?.name || ""} ${pg.manager?.phone || ""}\n` +
    `Owner: ${pg.owner?.name || ""} ${pg.owner?.phone || ""}\n` +
    `Maps: ${pg.mapsLink || ""}`
  );
  const location = encodeURIComponent(pg.mapsLink || `${pg.area}, ${pg.locality || "Bangalore"}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
}

function downloadICS(pg: PG, slotISO: string, leadName?: string) {
  const blob = new Blob([icsForVisit(pg, slotISO, leadName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `visit-${pg.id}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

interface RowProps {
  role: string;
  name: string;
  phone?: string;
  pg: PG;
  leadName?: string;
  hint: string;
}
function ContactRow({ role, name, phone, pg, leadName, hint }: RowProps) {
  if (!phone && !name) return null;
  const msg =
    `Hi ${leadName || "{name}"}, this is from ${pg.name}. ` +
    `You can speak to ${name || role} directly on ${phone || ""}. ` +
    `Maps: ${pg.mapsLink || ""}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{role}</div>
        <div className="truncate text-sm font-semibold">{name || "—"}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {hint}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <a
          href={(phone && telLink(phone)) || undefined}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px] font-medium",
            phone ? "hover:border-primary/40" : "pointer-events-none opacity-40"
          )}
          title={phone ? `Call ${phone}` : "No phone on file"}
        >
          <Phone className="h-3 w-3 text-primary" />
          <span className="font-mono">{phone || "—"}</span>
        </a>
        {phone && (
          <a
            href={waLink(phone, msg)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 p-1.5 hover:border-primary/40"
            title="WhatsApp"
          >
            <MessageCircle className="h-3 w-3 text-primary" />
          </a>
        )}
      </div>
    </div>
  );
}

export function PGContactCard({ pg, slotISO, leadName }: Props) {
  const zone = useMemo(() => {
    const zid = areaToZone(pg.area);
    return ZONES.find((z) => z.id === zid);
  }, [pg.area]);
  const zonePhone = zone ? getZonePhone(zone.id) : "";
  const window = bestWindow();

  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" /> Find my PG — Direct Contacts
        </h3>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          window.tone === "success" && "bg-success/10 text-success",
          window.tone === "warning" && "bg-warning/10 text-warning",
          window.tone === "muted" && "bg-muted text-muted-foreground",
        )}>{window.label}</span>
      </div>

      <div className="space-y-2">
        <ContactRow
          role="Manager (on-site)"
          name={pg.manager?.name || ""}
          phone={pg.manager?.phone}
          pg={pg} leadName={leadName}
          hint="Best for live tour, room photos, lock-in"
        />
        <ContactRow
          role="Owner"
          name={pg.owner?.name || ""}
          phone={pg.owner?.phone}
          pg={pg} leadName={leadName}
          hint="Best for rent negotiation & long-stay deals"
        />
        {zone && (
          <ContactRow
            role={`Zone TCM · ${zone.short}`}
            name="Gharpayy Sales"
            phone={zonePhone}
            pg={pg} leadName={leadName}
            hint="Backup line · escalations · alt PGs in zone"
          />
        )}
      </div>

      {/* Calendar block */}
      <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
          <CalendarIcon className="h-3.5 w-3.5" /> Add to calendar
        </div>
        {slotISO ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {new Date(slotISO).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <a
              href={gcalLink(pg, slotISO, leadName)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Google Calendar
            </a>
            <button
              onClick={() => downloadICS(pg, slotISO, leadName)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:border-primary/40"
            >
              .ics (Apple / Outlook)
            </button>
            {pg.mapsLink && (
              <a href={pg.mapsLink} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:border-primary/40">
                <MapPin className="h-3 w-3" /> Maps
              </a>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            Pick a slot above (Schedule a Visit) and the calendar buttons unlock.
          </div>
        )}
      </div>
    </section>
  );
}
