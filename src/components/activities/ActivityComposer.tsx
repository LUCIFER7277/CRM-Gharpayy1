// Salesforce-style quick-log composer. Tabs for Call / Email / Meeting / Note /
// SMS / WhatsApp / Site visit. Standardized "subject" line per kind, plus the
// fields that actually matter for that kind (direction, outcome, duration, schedule).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, Calendar, StickyNote, MessageSquare, MessageCircle, MapPin, Bell } from "lucide-react";
import type { ActivityKind } from "@/contracts";

type Outcome = "connected" | "no_answer" | "busy" | "voicemail" | "interested" | "not_interested" | "callback_requested" | "scheduled" | "completed" | "rescheduled" | "cancelled" | "neutral";

interface Props {
  onLog: (input: {
    kind: ActivityKind;
    subject: string;
    body?: string;
    direction?: "inbound" | "outbound" | "internal";
    outcome?: Outcome | null;
    durationSec?: number;
    scheduledFor?: string | null;
  }) => Promise<{ ok: boolean }>;
}

const SUBJECT_TEMPLATES: Record<string, string[]> = {
  call: ["Discovery call", "Follow-up call", "Budget discussion", "Closing call", "Reschedule call", "Voicemail"],
  email: ["Sent property options", "Sent quote", "Follow-up email", "Reply to inquiry", "Document request"],
  sms: ["Sent shortlist", "Reminder sent", "Follow-up SMS"],
  whatsapp: ["Sent listing", "Voice note shared", "Confirmed visit time", "Sent location pin"],
  meeting: ["Discovery meeting", "Property walkthrough", "Negotiation", "Closing meeting"],
  note: ["Internal note", "Manager handoff note", "Background context"],
  site_visit: ["Scheduled site visit", "Completed site visit", "No-show"],
  follow_up: ["Follow up tomorrow", "Follow up next week", "Wait for funding"],
};

export function ActivityComposer({ onLog }: Props) {
  return (
    <Tabs defaultValue="call" className="w-full">
      <TabsList className="grid grid-cols-4 md:grid-cols-8 h-auto">
        <TabsTrigger value="call" className="flex-col gap-1 py-2 text-xs"><Phone className="h-3.5 w-3.5" />Call</TabsTrigger>
        <TabsTrigger value="email" className="flex-col gap-1 py-2 text-xs"><Mail className="h-3.5 w-3.5" />Email</TabsTrigger>
        <TabsTrigger value="whatsapp" className="flex-col gap-1 py-2 text-xs"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</TabsTrigger>
        <TabsTrigger value="sms" className="flex-col gap-1 py-2 text-xs"><MessageSquare className="h-3.5 w-3.5" />SMS</TabsTrigger>
        <TabsTrigger value="meeting" className="flex-col gap-1 py-2 text-xs"><Calendar className="h-3.5 w-3.5" />Meeting</TabsTrigger>
        <TabsTrigger value="site_visit" className="flex-col gap-1 py-2 text-xs"><MapPin className="h-3.5 w-3.5" />Visit</TabsTrigger>
        <TabsTrigger value="note" className="flex-col gap-1 py-2 text-xs"><StickyNote className="h-3.5 w-3.5" />Note</TabsTrigger>
        <TabsTrigger value="follow_up" className="flex-col gap-1 py-2 text-xs"><Bell className="h-3.5 w-3.5" />Follow-up</TabsTrigger>
      </TabsList>

      {(["call","email","whatsapp","sms","meeting","site_visit","note","follow_up"] as const).map((kind) => (
        <TabsContent key={kind} value={kind}>
          <KindForm kind={kind} onLog={onLog} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function KindForm({ kind, onLog }: { kind: ActivityKind; onLog: Props["onLog"] }) {
  const templates = SUBJECT_TEMPLATES[kind] ?? ["Logged"];
  const [subject, setSubject] = useState(templates[0]);
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound" | "internal">(kind === "note" || kind === "follow_up" ? "internal" : "outbound");
  const [outcome, setOutcome] = useState<Outcome>("neutral");
  const [durationMin, setDurationMin] = useState<number>(0);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const showOutcome = kind === "call" || kind === "meeting" || kind === "site_visit";
  const showDuration = kind === "call" || kind === "meeting";
  const showSchedule = kind === "follow_up" || kind === "meeting" || kind === "site_visit";

  const submit = async () => {
    if (!subject.trim()) return;
    setBusy(true);
    const r = await onLog({
      kind,
      subject: subject.trim(),
      body: body.trim() || undefined,
      direction,
      outcome: showOutcome ? outcome : null,
      durationSec: showDuration ? durationMin * 60 : 0,
      scheduledFor: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null,
    });
    setBusy(false);
    if (r.ok) { setBody(""); setDurationMin(0); setScheduledFor(""); }
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap gap-1">
        {templates.map((t) => (
          <button key={t} type="button" onClick={() => setSubject(t)}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${subject === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <Textarea placeholder="Details (optional)" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {kind !== "note" && kind !== "follow_up" && (
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showOutcome && (
          <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="no_answer">No answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="not_interested">Not interested</SelectItem>
              <SelectItem value="callback_requested">Callback requested</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showDuration && (
          <Input type="number" min={0} placeholder="Duration (min)" value={durationMin || ""} onChange={(e) => setDurationMin(Number(e.target.value) || 0)} />
        )}
        {showSchedule && (
          <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !subject.trim()}>{busy ? "Logging…" : "Log activity"}</Button>
      </div>
    </div>
  );
}
