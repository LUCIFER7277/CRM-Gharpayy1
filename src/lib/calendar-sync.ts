import type { CalEvent } from "./calendar-store";

/* ============================== ICS ============================== */

const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += 73) chunks.push(line.slice(i, i + 73));
  return chunks.join("\r\n ");
};

const escapeIcsText = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const toIcsDate = (iso: string, allDay: boolean): string => {
  const d = new Date(iso);
  if (allDay) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

export function eventsToIcs(events: CalEvent[], calendarName = "Align Deal Flow"): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Align Deal Flow//Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName)}`);

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@align-deal-flow`);
    lines.push(`DTSTAMP:${toIcsDate(e.updatedAt, false)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(e.start, true)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(e.end, true)}`);
    } else {
      lines.push(`DTSTART:${toIcsDate(e.start, false)}`);
      lines.push(`DTEND:${toIcsDate(e.end, false)}`);
    }
    lines.push(fold(`SUMMARY:${escapeIcsText(e.title)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeIcsText(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeIcsText(e.location)}`));
    if (e.attendees?.length) {
      for (const a of e.attendees) lines.push(fold(`ATTENDEE;CN=${escapeIcsText(a)}:mailto:${a}`));
    }
    lines.push(`CATEGORIES:${e.kind.toUpperCase()}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ========================== ICS Parsing ========================== */

const unfold = (text: string): string =>
  text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");

const unescapeIcsText = (s: string): string =>
  s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

const parseIcsDate = (raw: string): { iso: string; allDay: boolean } => {
  // Strip param prefix if present
  const value = raw.includes(":") ? raw.split(":").pop()! : raw;
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00.000Z`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { iso: new Date().toISOString(), allDay: false };
  const [, Y, Mo, D, H, Mi, S, Z] = m;
  if (Z) return { iso: `${Y}-${Mo}-${D}T${H}:${Mi}:${S}.000Z`, allDay: false };
  // floating time -> treat as local
  const local = new Date(Number(Y), Number(Mo) - 1, Number(D), Number(H), Number(Mi), Number(S));
  return { iso: local.toISOString(), allDay: false };
};

export function icsToEvents(text: string, externalSource: "ics" | "google" | "outlook" = "ics"): CalEvent[] {
  const unfolded = unfold(text);
  const lines = unfolded.split(/\r?\n/);
  const events: CalEvent[] = [];
  let current: Partial<CalEvent> | null = null;
  let inEvent = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { kind: "meeting", externalSource };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.start && current.end && current.title) {
        const now = new Date().toISOString();
        events.push({
          id: current.externalId ?? `imp-${Math.random().toString(36).slice(2, 10)}`,
          title: current.title!,
          kind: current.kind ?? "meeting",
          start: current.start!,
          end: current.end!,
          allDay: current.allDay ?? false,
          description: current.description,
          location: current.location,
          attendees: current.attendees,
          externalSource,
          externalId: current.externalId,
          rrule: current.rrule,
          createdAt: now,
          updatedAt: now,
        });
      }
      current = null;
      inEvent = false;
      continue;
    }
    if (!inEvent || !current) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = head.split(";")[0].toUpperCase();

    switch (key) {
      case "UID":
        current.externalId = value;
        break;
      case "SUMMARY":
        current.title = unescapeIcsText(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeIcsText(value);
        break;
      case "LOCATION":
        current.location = unescapeIcsText(value);
        break;
      case "DTSTART": {
        const p = parseIcsDate(line);
        current.start = p.iso;
        current.allDay = p.allDay;
        break;
      }
      case "DTEND": {
        const p = parseIcsDate(line);
        current.end = p.iso;
        break;
      }
      case "RRULE":
        current.rrule = value;
        break;
      case "CATEGORIES": {
        const v = value.toLowerCase();
        if (v.includes("tour")) current.kind = "tour";
        else if (v.includes("call")) current.kind = "call";
        else if (v.includes("follow")) current.kind = "follow-up";
        else if (v.includes("task")) current.kind = "task";
        else if (v.includes("personal")) current.kind = "personal";
        else current.kind = "meeting";
        break;
      }
      case "ATTENDEE": {
        const email = value.replace(/^mailto:/i, "").trim();
        current.attendees = [...(current.attendees ?? []), email];
        break;
      }
    }
  }
  return events;
}

/* ===================== Provider URL helpers ===================== */

export function googleCalendarTemplateUrl(e: Pick<CalEvent, "title" | "start" | "end" | "description" | "location">): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end)}`,
    details: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarTemplateUrl(e: Pick<CalEvent, "title" | "start" | "end" | "description" | "location">): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start,
    enddt: e.end,
    body: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
