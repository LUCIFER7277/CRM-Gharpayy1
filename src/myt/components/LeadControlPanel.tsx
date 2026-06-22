import { useMemo, useState, ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Phone, MessageCircle, CalendarPlus, ClipboardList, MessageSquare, Activity as ActivityIcon,
  Wallet, MapPin, Building2, AlertTriangle, CheckCircle2, ThumbsUp, ThumbsDown, Sparkles,
  Tag, FileText, Clock, Send, RefreshCw, X, Bell,
} from "lucide-react";
import { Tour, Lead, TourStatus, TourOutcome, WhyLost } from "@/myt/lib/types";
import { useAppState } from "@/myt/lib/app-context";
import { useTourData } from "@/myt/lib/tour-data-context";
import { memberDisplayName, memberShortLabel, useOrgMembers } from "@/hooks/useOrgDirectory";
import { intentBg, confirmationLabel } from "@/myt/lib/confidence";
import { toast } from "sonner";
import { cn, formatTime12h } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

type Subject =
  | { kind: "tour"; tour: Tour }
  | { kind: "lead"; lead: Lead };

interface Props {
  subject: Subject;
  trigger?: ReactNode;
  defaultTab?: "overview" | "tour" | "actions" | "followup" | "post-tour" | "activity";
}

const STAGES: { value: TourStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Tour Done" },
  { value: "no-show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

const SIGNAL_TAGS = [
  "Price issue", "Location mismatch", "Parents involved",
  "Comparing options", "Food concern", "Move-in delay", "Hot lead",
];

export function LeadControlPanel({ subject, trigger, defaultTab = "overview" }: Props) {
  const [open, setOpen] = useState(false);
  const { tours, setTours, leads, setLeads } = useAppState();
  const { members: orgMembers } = useOrgMembers();
  const { addEvent, eventsForTour, reports, setReport } = useTourData();

  // ----- derive lead + tour from subject + global state -----
  const lead = subject.kind === "lead"
    ? subject.lead
    : leads.find((l) => l.phone === subject.tour.phone || l.name === subject.tour.leadName);

  const leadTours = useMemo(
    () => (lead
      ? tours
          .filter((candidate) => candidate.phone === lead.phone || candidate.leadName === lead.name)
          .sort((a, b) => `${b.tourDate}T${b.tourTime}`.localeCompare(`${a.tourDate}T${a.tourTime}`))
      : []),
    [lead, tours],
  );

  const scheduledTourActivity = useMemo(
    () => (lead ? eventsForTour(leadTours[0]?.id ?? "").find(() => false) : null),
    [lead, leadTours, eventsForTour],
  );

  const tour = subject.kind === "tour"
    ? subject.tour
    : (scheduledTourActivity?.tourId ? tours.find((candidate) => candidate.id === scheduledTourActivity.tourId) : null)
      ?? leadTours.find((candidate) => candidate.status === "scheduled")
      ?? leadTours[0];

  const assignedMember = tour
    ? orgMembers.find((member) => member.id === tour.assignedTo)
    : null;
  const assignedToName = tour
    ? assignedMember
      ? memberShortLabel(assignedMember)
      : tour.assignedToName
    : "";
  const assignedToLabel = assignedToName || tour?.assignedToName || "";

  const name = tour?.leadName ?? lead?.name ?? "Lead";
  const phone = tour?.phone ?? lead?.phone ?? "";
  const area = tour?.area ?? lead?.area ?? "-";
  const budget = tour?.budget ?? lead?.budget ?? 0;
  const property = tour?.propertyName;

  // ----- local state -----
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [fuDate, setFuDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [fuPriority, setFuPriority] = useState<"hot" | "warm" | "cold">(
    tour?.intent === "hard" ? "hot" : tour?.intent === "medium" ? "warm" : "cold"
  );
  const [fuReason, setFuReason] = useState("Decision check-in");
  const [waText, setWaText] = useState("");

  // post-tour
  const existingReport = tour ? reports[tour.id] : undefined;
  const [ptOutcome, setPtOutcome] = useState<TourOutcome | "">(tour?.outcome ?? "");
  const [ptConfidence, setPtConfidence] = useState(existingReport ? 80 : tour?.confidenceScore ?? 50);
  const [ptObjection, setPtObjection] = useState<WhyLost>(tour?.whyLost ?? null);
  const [ptObjectionNote, setPtObjectionNote] = useState("");
  const [ptDecisionDate, setPtDecisionDate] = useState("");
  const [ptNextFollowUp, setPtNextFollowUp] = useState(fuDate);

  const events = useMemo(() => (tour ? eventsForTour(tour.id) : []), [tour, eventsForTour]);

  // ----- helpers -----
  const updateTour = (patch: Partial<Tour>) => {
    if (!tour) return;
    setTours((prev) => prev.map((t) => (t.id === tour.id ? { ...t, ...patch } : t)));
  };
  const updateLead = (patch: Partial<Lead>) => {
    if (!lead) return;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)));
  };
  const log = (kind: any, notes: string) => {
    if (tour) addEvent({ tourId: tour.id, kind, notes });
  };

  // ----- actions -----
  const setStatus = (status: TourStatus) => {
    updateTour({ status, ...(status === "completed" ? { showUp: true } : {}) });
    log(status === "completed" ? "tour_ended" : status === "no-show" ? "no_show" : "custom_message_sent",
      `Status → ${status}`);
    toast.success(`Status updated to ${status}`);
  };

  const sendWhatsApp = (text: string) => {
    if (!phone) { toast.error("No phone on file"); return; }
    const cleaned = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`, "_blank");
    log("custom_message_sent", text.slice(0, 80));
    toast.success("WhatsApp opened");
  };

  const callNow = () => {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
    log("custom_message_sent", "Call placed");
  };

  const saveNote = () => {
    if (!note.trim()) return;
    log("custom_message_sent", `Note: ${note.trim()}${tags.length ? ` [${tags.join(", ")}]` : ""}`);
    toast.success("Note saved");
    setNote(""); setTags([]);
  };

  const saveFollowUp = () => {
    const dueAt = new Date(fuDate).toISOString();
    log("reminder_sent", `Follow-up scheduled · ${fuPriority.toUpperCase()} · ${fuReason} · ${format(new Date(fuDate), "MMM d")}`);
    toast.success(`Follow-up set ${format(new Date(fuDate), "MMM d")}`, { description: fuReason });
    if (lead) updateLead({ notes: `[FU ${fuDate}] ${fuReason}\n${lead.notes ?? ""}` });
  };

  const savePostTour = () => {
    if (!tour) return;
    if (!ptOutcome) { toast.error("Pick an outcome"); return; }
    if (!ptObjection && ptOutcome !== "booked" && ptOutcome !== "token-paid") {
      toast.error("Tag the key objection"); return;
    }
    if (!ptNextFollowUp) { toast.error("Next follow-up date is mandatory"); return; }

    updateTour({ outcome: ptOutcome, whyLost: ptObjection, remarks: ptObjectionNote });
    setReport({
      tourId: tour.id,
      arrived: tour.showUp ? "yes" : "no",
      punctuality: "on_time",
      budgetAlignment: "exact",
      propertyReaction: ptOutcome === "booked" || ptOutcome === "token-paid" ? "positive" : "neutral",
      interestLevel: ptConfidence >= 70 ? "high" : ptConfidence >= 40 ? "medium" : "low",
      firstObjection: ptObjection ?? undefined,
      decisionAuthority: "self",
      emotionalTone: "neutral",
      outcome: (ptOutcome === "booked" || ptOutcome === "token-paid") ? "booked"
              : ptOutcome === "follow-up" ? "warm"
              : ptOutcome === "draft" ? "hot"
              : "cold",
      nextStep: `${fuReason} on ${ptNextFollowUp}`,
      notes: ptObjectionNote,
      filedAt: new Date().toISOString(),
    });
    log("tcm_report_filed", `Outcome: ${ptOutcome} · confidence ${ptConfidence}%`);
    toast.success("Post-tour update saved");
  };

  const stale = tour?.status === "completed" && !tour.outcome;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Open
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 overflow-y-auto"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border bg-surface-2/40 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-heading flex items-center gap-2 flex-wrap">
                {name}
                {tour && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase", intentBg[tour.intent])}>
                    {tour.intent}
                  </span>
                )}
                {stale && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" /> Update required
                  </Badge>
                )}
              </SheetTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                {phone && <span className="mr-2">📞 {phone}</span>}
                <span className="mr-2">📍 {area}</span>
                <span>💰 ₹{(budget/1000).toFixed(0)}k</span>
              </p>
              {tour && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {tour.propertyName} · {tour.tourDate} {formatTime12h(tour.tourTime)} · TCM {assignedToName}
                </p>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick actions row */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={callNow} disabled={!phone}>
              <Phone className="h-3 w-3" /> Call
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => sendWhatsApp(`Hi ${name}, this is regarding your Gharpayy tour. Can we connect?`)} disabled={!phone}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
            {tour && (
              <Select value={tour.status} onValueChange={(v) => setStatus(v as TourStatus)}>
                <SelectTrigger className="h-7 text-[11px] w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue={stale ? "post-tour" : defaultTab} className="p-4">
          <TabsList className="w-full justify-start h-9 flex-wrap">
            <TabsTrigger value="overview" className="text-[11px] gap-1"><FileText className="h-3 w-3" /> Overview</TabsTrigger>
            <TabsTrigger value="actions" className="text-[11px] gap-1"><MessageSquare className="h-3 w-3" /> Action</TabsTrigger>
            <TabsTrigger value="followup" className="text-[11px] gap-1"><Bell className="h-3 w-3" /> Follow-up</TabsTrigger>
            {tour && <TabsTrigger value="post-tour" className={cn("text-[11px] gap-1", stale && "text-destructive")}><CheckCircle2 className="h-3 w-3" /> Post-tour</TabsTrigger>}
            <TabsTrigger value="activity" className="text-[11px] gap-1"><ActivityIcon className="h-3 w-3" /> Activity</TabsTrigger>
          </TabsList>

          {/* ---- OVERVIEW ---- */}
          <TabsContent value="overview" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info icon={<Wallet className="h-3.5 w-3.5" />} label="Budget" value={`₹${budget.toLocaleString()}/mo`} />
              <Info icon={<MapPin className="h-3.5 w-3.5" />} label="Area" value={area} />
              {tour && <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Property" value={property!} />}
              {tour && <Info icon={<Clock className="h-3.5 w-3.5" />} label="Slot" value={`${tour.tourDate} ${formatTime12h(tour.tourTime)}`} />}
              {lead && <Info icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.addedByName ?? "-"} />}
              {lead && <Info icon={<Clock className="h-3.5 w-3.5" />} label="Move-in" value={lead.moveInDate} />}
            </div>

            {tour && (tour.confidenceReason?.length ?? 0) > 0 && (
              <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Why this score</div>
                {tour!.confidenceReason!.join(" · ")}
              </div>
            )}

            {/* Notes + signals */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Add note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did the lead say? Concerns, decision triggers, parent objections…"
                className="min-h-[70px] text-xs"
              />
              <div className="flex flex-wrap gap-1">
                {SIGNAL_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTags((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t])}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      tags.includes(t)
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-surface-2 border-border text-muted-foreground hover:bg-surface-3"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button size="sm" className="w-full gap-1.5" onClick={saveNote} disabled={!note.trim()}>
                <FileText className="h-3.5 w-3.5" /> Save to log
              </Button>
            </div>
          </TabsContent>

          {/* ---- ACTIONS (WhatsApp templates) ---- */}
          <TabsContent value="actions" className="mt-3 space-y-2">
            <div className="space-y-2">
              {[
                { label: "Reconfirm tour", text: `Hi ${name}, just confirming your tour today at ${tour ? formatTime12h(tour.tourTime) : "the scheduled time"} for ${property ?? "the property"}. Reply YES to confirm.` },
                { label: "Send directions", text: `Hi ${name}, here are directions for your visit: https://maps.google.com/?q=${encodeURIComponent(property ?? area)}. TCM ${memberDisplayName(assignedMember, assignedToLabel)} will meet you.` },
                { label: "Urgency nudge", text: `Hi ${name}, only 2 beds left in your range at ${property ?? "this property"}. 3 others viewing today. Hold expires in 4 hours. Reply YES to lock.` },
                { label: "Post-tour check-in", text: `Hi ${name}, hope the visit went well! Did you like the place? Reply 1: Loved it · 2: Good unsure · 3: Need better options.` },
                { label: "Token request", text: `Hi ${name}, lock your bed at ${property ?? ""} with a refundable ₹2,000 token. Pay here: gharpayy.com/pay/${tour?.id ?? ""}` },
              ].map((t) => (
                <div key={t.label} className="rounded-md border border-border bg-surface-2/40 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold">{t.label}</span>
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={() => sendWhatsApp(t.text)}>
                      <Send className="h-3 w-3" /> Send
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{t.text}</p>
                </div>
              ))}

              <div className="rounded-md border border-border bg-surface-2/40 p-2.5 space-y-2">
                <Label className="text-[11px] text-muted-foreground">Custom message</Label>
                <Textarea value={waText} onChange={(e) => setWaText(e.target.value)} placeholder="Type a custom WhatsApp message…" className="min-h-[60px] text-xs" />
                <Button size="sm" className="w-full gap-1.5" disabled={!waText.trim()} onClick={() => { sendWhatsApp(waText); setWaText(""); }}>
                  <Send className="h-3.5 w-3.5" /> Send custom
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---- FOLLOW-UP ---- */}
          <TabsContent value="followup" className="mt-3 space-y-3">
            <div className="rounded-md border border-amber/30 bg-amber/5 p-2.5 text-[11px] text-amber-foreground/90">
              ⚠ Every lead must have a next follow-up date. No exceptions.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Next follow-up</Label>
                <Input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Priority</Label>
                <Select value={fuPriority} onValueChange={(v) => setFuPriority(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">🔥 Hot - today</SelectItem>
                    <SelectItem value="warm">☀️ Warm - 24h</SelectItem>
                    <SelectItem value="cold">❄️ Cold - this week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">What to do</Label>
              <Select value={fuReason} onValueChange={setFuReason}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Decision check-in">Decision check-in</SelectItem>
                  <SelectItem value="Reconfirm tour">Reconfirm tour</SelectItem>
                  <SelectItem value="Send property options">Send property options</SelectItem>
                  <SelectItem value="Pricing discussion">Pricing discussion</SelectItem>
                  <SelectItem value="Token / advance push">Token / advance push</SelectItem>
                  <SelectItem value="Parent call">Parent call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveFollowUp} className="w-full gap-1.5">
              <Bell className="h-4 w-4" /> Set follow-up
            </Button>
          </TabsContent>

          {/* ---- POST-TOUR (mandatory enforcement) ---- */}
          {tour && (
            <TabsContent value="post-tour" className="mt-3 space-y-3">
              {stale && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Tour ended without an update. Fill all fields to clear the flag.
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Outcome (mandatory)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { v: "booked", label: "✅ Booked" },
                    { v: "token-paid", label: "💰 Token" },
                    { v: "draft", label: "📄 Draft" },
                    { v: "follow-up", label: "🔁 Follow-up" },
                    { v: "not-interested", label: "❌ Not fit" },
                    { v: "rejected", label: "🚫 Rejected" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setPtOutcome(o.v as TourOutcome)}
                      className={cn(
                        "h-8 rounded-md border text-[10px] font-medium transition-colors",
                        ptOutcome === o.v
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-surface-2 text-muted-foreground hover:bg-surface-3"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Deal confidence · {ptConfidence}%</Label>
                <Slider value={[ptConfidence]} onValueChange={(v) => setPtConfidence(v[0])} max={100} step={5} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Key objection</Label>
                <Select value={ptObjection ?? ""} onValueChange={(v) => setPtObjection((v || null) as WhyLost)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select objection" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="delay">Decision delay</SelectItem>
                    <SelectItem value="comparing">Comparing options</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Add detail (exact words help)" value={ptObjectionNote} onChange={(e) => setPtObjectionNote(e.target.value)} className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Expected decision date</Label>
                  <Input type="date" value={ptDecisionDate} onChange={(e) => setPtDecisionDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Next follow-up *</Label>
                  <Input type="date" value={ptNextFollowUp} onChange={(e) => setPtNextFollowUp(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <Button onClick={savePostTour} className="w-full gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Submit post-tour update
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Skipping or partial fills block new tour assignments after 4 hours.
              </p>
            </TabsContent>
          )}

          {/* ---- ACTIVITY TIMELINE ---- */}
          <TabsContent value="activity" className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No activity yet. Every action you take here will appear in this timeline.</p>
            ) : (
              <div className="space-y-1.5">
                {events.map((e) => (
                  <div key={e.id} className="rounded-md border border-border bg-surface-2/40 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{e.kind.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
                    </div>
                    {e.notes && <p className="text-muted-foreground mt-0.5">{e.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">{icon}{label}</div>
      <div className="text-foreground font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
