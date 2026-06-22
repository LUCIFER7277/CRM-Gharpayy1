import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { useCalendar, KIND_META, type CalEvent, type CalEventKind } from "@/lib/calendar-store";
import { googleCalendarTemplateUrl, outlookCalendarTemplateUrl } from "@/lib/calendar-sync";
import { fromLocalInput, toLocalInput } from "./CalendarUtils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing event id when editing */
  eventId?: string;
  /** Materialised CRM/broadcast event that may not exist in the local calendar store yet */
  event?: CalEvent;
  /** Default start when creating */
  defaultStart?: Date;
}

export function EventDialog({ open, onOpenChange, eventId, event, defaultStart }: Props) {
  const { events, addEvent, upsertEvent, updateEvent, deleteEvent } = useCalendar();
  const stored = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const existing = stored ?? event;
  const canDelete = Boolean(stored);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CalEventKind>("meeting");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");
  const [reminder, setReminder] = useState<string>("15");

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setKind(existing.kind);
      setStart(toLocalInput(existing.start));
      setEnd(toLocalInput(existing.end));
      setAllDay(existing.allDay);
      setLocation(existing.location ?? "");
      setDescription(existing.description ?? "");
      setAttendees((existing.attendees ?? []).join(", "));
      setReminder(String(existing.reminder ?? 15));
    } else {
      const base = new Date(defaultStart ?? new Date());
      base.setMinutes(0, 0, 0);
      const startD = new Date(base);
      const endD = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle("");
      setKind("meeting");
      setStart(toLocalInput(startD.toISOString()));
      setEnd(toLocalInput(endD.toISOString()));
      setAllDay(false);
      setLocation("");
      setDescription("");
      setAttendees("");
      setReminder("15");
    }
  }, [open, existing, defaultStart]);

  const save = () => {
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    if (!start || !end) {
      toast.error("Start and end time are required.");
      return;
    }
    const startIso = fromLocalInput(start);
    const endIso = fromLocalInput(end);
    if (+new Date(endIso) <= +new Date(startIso)) {
      toast.error("End time must be after start time.");
      return;
    }
    const payload = {
      title: title.trim(),
      kind,
      start: startIso,
      end: endIso,
      allDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      attendees: attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      reminder: Number(reminder) as CalEvent["reminder"],
    };
    if (existing) {
      if (stored) {
        updateEvent(existing.id, payload);
      } else {
        upsertEvent({
          ...existing,
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      }
      toast.success("Event updated.");
    } else {
      addEvent({ ...payload, externalSource: "local" });
      toast.success("Event added to calendar.");
    }
    onOpenChange(false);
  };

  const remove = () => {
    if (!existing) return;
    deleteEvent(existing.id);
    toast.success("Event deleted.");
    onOpenChange(false);
  };

  const previewEvent = {
    title: title || "Untitled",
    start: start ? fromLocalInput(start) : new Date().toISOString(),
    end: end ? fromLocalInput(end) : new Date(Date.now() + 3600000).toISOString(),
    description,
    location,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {existing ? "Edit event" : "New event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CalEventKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: m.color }}
                        />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reminder</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="5">5 minutes before</SelectItem>
                  <SelectItem value="10">10 minutes before</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="ev-allday" />
            <Label htmlFor="ev-allday" className="cursor-pointer">
              All day
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location or video link"
            />
          </div>

          <div>
            <Label>Attendees (comma-separated emails)</Label>
            <Input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes, agenda, or context"
              rows={3}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={googleCalendarTemplateUrl(previewEvent)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" /> Add to Google
            </a>
            <a
              href={outlookCalendarTemplateUrl(previewEvent)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" /> Add to Outlook
            </a>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {canDelete && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={remove}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{existing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
