import { useMemo, useState } from "react";
import { Link, useParams } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useSettings, renderTemplate, type MessageTemplate } from "@/myt/lib/settings-context";
import { useTourData, type TourEventKind, type TCMReport, type CustomerFeedback } from "@/myt/lib/tour-data-context";
import { fmtWhen, genOtp, mapsLink, whatsappLink } from "@/myt/lib/messaging-utils";
import { computeTourScore, detectMismatches } from "@/myt/lib/intelligence";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/myt/components/CopyButton";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  KeyRound,
  MapPin,
  MessageSquare,
  Phone,
  PlayCircle,
  Send,
  StopCircle,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_LABEL: Record<TourEventKind, string> = {
  booked: "📌 Booked",
  confirmation_sent: "📤 Confirmation sent",
  confirmed_by_customer: "✅ Customer confirmed",
  reschedule_requested: "🔁 Reschedule requested",
  reminder_sent: "⏰ Reminder sent",
  tcm_on_the_way: "🚗 TCM on the way",
  customer_running_late: "🐢 Customer running late",
  tour_started: "▶️ Tour started",
  tour_ended: "⏹️ Tour ended",
  no_show: "👻 No-show",
  cancelled: "❌ Cancelled",
  feedback_received: "💬 Customer feedback",
  tcm_report_filed: "📝 TCM report filed",
  custom_message_sent: "💬 Custom message",
};

export default function TourCommand() {
  const { id } = useParams();
  const { tours, setTours } = useAppState();
  const { settings } = useSettings();
  const { addEvent, eventsForTour, feedback, reports } = useTourData();
  const tour = useMemo(() => tours.find((t) => t.id === id), [tours, id]);

  const [activeTplId, setActiveTplId] = useState<string>(settings.templates[0]?.id ?? "");
  const [customBody, setCustomBody] = useState("");
  const [otp, setOtp] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("15");

  const events = id ? eventsForTour(id) : [];
  const tourFeedback = id ? feedback[id] : undefined;
  const tourReport = id ? reports[id] : undefined;

  if (!tour) {
    return (
      <div className="p-6">
        <Link to="/myt/tours" className="text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to tours
        </Link>
        <p className="mt-4 text-muted-foreground">Tour not found.</p>
      </div>
    );
  }
  const safeTour = tour;

  const vars = {
    leadName: tour.leadName,
    propertyName: tour.propertyName,
    area: tour.area,
    when: fmtWhen(tour.tourDate, tour.tourTime),
    tcmName: tour.assignedToName,
    tcmPhone: "-",
    budget: tour.budget?.toLocaleString("en-IN") ?? "-",
    workLocation: tour.qualification?.workLocation ?? "-",
    mapsLink: mapsLink(tour.area, tour.propertyName),
    etaMinutes,
    otp: otp || "______",
    siteName: settings.siteName,
    signature: settings.signatureLine,
  };

  const activeTpl: MessageTemplate | undefined = settings.templates.find((t) => t.id === activeTplId);
  const renderedActive = activeTpl ? renderTemplate(activeTpl.body, vars) : "";
  const renderedCustom = renderTemplate(customBody, vars);
  const score = computeTourScore(tour, events, settings.weights, tourFeedback, tourReport);
  const mismatches = detectMismatches(tour, tourFeedback, tourReport);

  function logEvent(kind: TourEventKind, notes?: string, templateId?: string) {
    if (!id) return;
    addEvent({ tourId: id, kind, notes, templateId });
  }

  function setStatus(next: typeof safeTour.status) {
    setTours((prev) => prev.map((t) => (t.id === safeTour.id ? { ...t, status: next } : t)));
  }

  // Quick actions
  function handleCustomerConfirmed() {
    logEvent("confirmed_by_customer", "Customer replied YES");
    setStatus("confirmed");
    api.tours.update(safeTour.id, { status: "confirmed" }).catch(e => {
      console.error("Failed to update tour status", e);
      toast.error("Failed to save status change");
    });
    toast.success("Marked as confirmed by customer");
  }

  function handleStartTour() {
    if (!otp) {
      const fresh = genOtp();
      setOtp(fresh);
      toast.message(`OTP ${fresh} generated. Share with customer or use Tour Start OTP template.`);
      return;
    }
    logEvent("tour_started", `OTP: ${otp}`);
    setTours((prev) => prev.map((t) => (t.id === safeTour.id ? { ...t, status: "confirmed", showUp: true } : t)));
    api.tours.update(safeTour.id, { status: "confirmed", showUp: true }).catch(e => {
      console.error("Failed to update tour status", e);
      toast.error("Failed to save status change");
    });
    toast.success("Tour started");
  }

  function handleEndTour() {
    logEvent("tour_ended");
    setTours((prev) => prev.map((t) => (t.id === safeTour.id ? { ...t, status: "completed" } : t)));
    api.tours.update(safeTour.id, { status: "completed" }).catch(e => {
      console.error("Failed to update tour status", e);
      toast.error("Failed to save status change");
    });
    toast.success("Tour ended - please file TCM report");
  }

  function handleNoShow() {
    logEvent("no_show", "Marked no-show");
    setTours((prev) => prev.map((t) => (t.id === safeTour.id ? { ...t, status: "no-show", showUp: false } : t)));
    api.tours.update(safeTour.id, { status: "no-show", showUp: false }).catch(e => {
      console.error("Failed to update tour status", e);
      toast.error("Failed to save status change");
    });
    toast.warning("Marked as no-show");
  }

  function handleTcmOnWay() {
    logEvent("tcm_on_the_way", `ETA ${etaMinutes} min`);
  }

  function handleCustomerLate() {
    logEvent("customer_running_late");
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Link to="/myt/tours" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tours
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-xl">{tour.leadName}</CardTitle>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{tour.phone}</span>
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{tour.assignedToName}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{tour.area} · {tour.propertyName}</span>
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtWhen(tour.tourDate, tour.tourTime)}</span>
                <span>💰 ₹{tour.budget?.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={tour.status === "completed" ? "default" : "secondary"} className="capitalize">{tour.status}</Badge>
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-2xl font-bold tabular-nums">{score.total}<span className="text-xs text-muted-foreground">/100</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCustomerConfirmed}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Customer replied YES
            </Button>
            <Button size="sm" variant="outline" onClick={handleTcmOnWay}>
              <Truck className="h-4 w-4 mr-1" /> TCM on the way
            </Button>
            <Button size="sm" variant="outline" onClick={handleCustomerLate}>
              <CircleDot className="h-4 w-4 mr-1" /> Customer running late
            </Button>
            <Button size="sm" onClick={handleStartTour}>
              <PlayCircle className="h-4 w-4 mr-1" /> {otp ? "Confirm tour started" : "Generate OTP & start"}
            </Button>
            <Button size="sm" variant="default" onClick={handleEndTour}>
              <StopCircle className="h-4 w-4 mr-1" /> End tour
            </Button>
            <Button size="sm" variant="destructive" onClick={handleNoShow}>
              <XCircle className="h-4 w-4 mr-1" /> No-show
            </Button>
            <Link to={`/myt/tour/${tour.id}/report`}>
              <Button size="sm" variant="secondary"><Send className="h-4 w-4 mr-1" /> File TCM report</Button>
            </Link>
            <Link to={`/myt/feedback/${tour.id}`}>
              <Button size="sm" variant="secondary"><MessageSquare className="h-4 w-4 mr-1" /> Customer feedback</Button>
            </Link>
          </div>

          {mismatches.length > 0 && (
            <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <div className="font-semibold mb-0.5">⚠ Mismatch detected</div>
              {mismatches.map((m, i) => <div key={i}>• {m.reason}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages">Copy-paste messages</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({events.length})</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
        </TabsList>

        {/* Messages */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a scenario → copy → paste in WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-2">
                {settings.templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTplId(t.id)}
                    className={cn(
                      "text-left rounded border p-2 hover:border-primary transition-colors",
                      activeTplId === t.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{t.scenario}</div>
                  </button>
                ))}
              </div>

              {activeTpl && (
                <div className="rounded border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold">{activeTpl.label}</div>
                      <div className="text-xs text-muted-foreground">{activeTpl.scenario}</div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {activeTpl.id === "tour_start_otp" && (
                        <div className="flex items-center gap-1">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="OTP"
                            className="h-7 w-24 text-xs"
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOtp(genOtp())}>
                            Gen
                          </Button>
                        </div>
                      )}
                      {activeTpl.id === "tcm_eta" && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">ETA</span>
                          <Input
                            value={etaMinutes}
                            onChange={(e) => setEtaMinutes(e.target.value)}
                            className="h-7 w-16 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      )}
                      <CopyButton
                        text={renderedActive}
                        variant="default"
                        label="Copy message"
                        onCopied={() => logEvent("custom_message_sent", `Copied: ${activeTpl.label}`, activeTpl.id)}
                      />
                      <a
                        href={whatsappLink(tour.phone, renderedActive)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => logEvent("custom_message_sent", `WA opened: ${activeTpl.label}`, activeTpl.id)}
                      >
                        <Button size="sm" variant="secondary"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open WhatsApp</Button>
                      </a>
                    </div>
                  </div>
                  <Textarea value={renderedActive} readOnly rows={Math.min(12, renderedActive.split("\n").length + 1)} className="font-mono text-xs" />
                </div>
              )}

              <div className="rounded border p-3 space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Custom message (variables work: {"{{leadName}}, {{propertyName}}, {{when}}…"})</Label>
                <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={3} placeholder="Type a custom message…" />
                {customBody && (
                  <>
                    <div className="text-xs text-muted-foreground">Preview</div>
                    <Textarea value={renderedCustom} readOnly rows={Math.min(8, renderedCustom.split("\n").length + 1)} className="font-mono text-xs" />
                    <div className="flex gap-2">
                      <CopyButton text={renderedCustom} variant="default" />
                      <a href={whatsappLink(tour.phone, renderedCustom)} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="secondary"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open WhatsApp</Button>
                      </a>
                    </div>
                  </>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Edit any template wording in <Link to="/myt/settings" className="text-primary underline">Settings → Message Templates</Link>.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet. Use the action buttons above to log lifecycle moments.</p>
              ) : (
                <ol className="relative border-l pl-4 space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="text-sm font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(e.at).toLocaleString("en-IN")}</div>
                      {e.notes && <div className="text-xs mt-0.5">{e.notes}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score */}
        <TabsContent value="score">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="text-3xl font-bold tabular-nums">{score.total}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="space-y-2">
                {(Object.keys(score.parts) as Array<keyof typeof score.parts>).map((k) => {
                  const p = score.parts[k];
                  const pct = p.max ? (p.earned / p.max) * 100 : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                        <span className="tabular-nums">{p.earned}/{p.max}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">Adjust weights in <Link to="/myt/settings" className="underline">Settings → Score Weights</Link>.</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
