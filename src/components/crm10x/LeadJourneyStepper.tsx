import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useQuotationsQuery } from "@/lib/crm10x/quotations";
import { useCheckin } from "@/lib/checkins/store";
import { useDossierReadiness } from "@/lib/crm10x/dossier-readiness";
import { pickRelevantActiveTour } from "@/lib/lead-helpers";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Lock, ChevronRight, ClipboardCheck,
  Calendar, MessageSquare, IndianRupee, KeyRound, ArrowRight,
} from "lucide-react";

export type JourneyTab =
  | "impact" | "tour" | "post" | "quote" | "negotiation" | "checkin";

type StepState = "done" | "active" | "todo" | "locked";

interface Step {
  key: JourneyTab;
  label: string;
  icon: typeof Calendar;
  state: StepState;
  cta: string;
  hint?: string;
}

export function LeadJourneyStepper({
  lead, currentTab, onJump,
}: {
  lead: Lead;
  currentTab: string;
  onJump: (tab: JourneyTab) => void;
}) {
  const tours = useApp((s) => s.tours);
  const { data: leadQuotes = [] } = useQuotationsQuery(lead.id);
  const { data: checkin } = useCheckin(lead.id);
  const dossier = useDossierReadiness(lead);

  const steps: Step[] = useMemo(() => {
    const leadTours = tours.filter((t) => t.leadId === lead.id);
    const openTour = pickRelevantActiveTour(leadTours);
    const completedTour = leadTours.find((t) => t.status === "completed");
    const pendingPost = leadTours.find((t) => t.status === "completed" && !t.postTour.filledAt);
    const paidQuote = leadQuotes.find((q) => q.status === "paid");
    const sentQuote = leadQuotes.find((q) => q.status === "sent");

    const hasTourProgress =
      Boolean(openTour || completedTour) ||
      ["tour-scheduled", "on-tour", "tour-done", "negotiation", "quote-sent", "booked"].includes(lead.stage);
    const visitReady = lead.tags?.includes("impact:visit-ready") ?? false;
    const dossierDone = visitReady || dossier.ready || hasTourProgress;
    const tourDone = !!completedTour || ["tour-done", "negotiation", "quote-sent", "booked"].includes(lead.stage);
    const postDone = !!completedTour && !pendingPost;
    const bookingDone = lead.stage === "booked" || !!paidQuote;
    const checkinDone = !!checkin && checkin.stage === "settled";

    const order = [
      { key: "impact" as const, done: dossierDone, unlock: true, label: "Impact", icon: ClipboardCheck, cta: "Complete profile",
        hint: visitReady ? "Visit ready" : dossierDone ? "Ready" : `${dossier.filledCount}/${dossier.totalCount} dossier fields` },
      { key: "tour" as const, done: tourDone, unlock: dossierDone, label: "Tour", icon: Calendar,
        cta: openTour ? "Move to on-tour" : "Schedule tour",
        hint: openTour ? "Scheduled" : completedTour ? "Completed" : "Not scheduled" },
      { key: "post" as const, done: postDone, unlock: tourDone, label: "Post-tour", icon: MessageSquare,
        cta: pendingPost ? "Fill post-tour" : "Review",
        hint: pendingPost ? "Pending form" : postDone ? "Complete" : "Awaiting tour" },
      { key: "quote" as const, done: bookingDone, unlock: postDone, label: "Quote · Book", icon: IndianRupee,
        cta: bookingDone ? "View booking" : "Send quote",
        hint: bookingDone ? "Booked" : sentQuote ? "Quote sent" : "Pending" },
      { key: "checkin" as const, done: checkinDone, unlock: bookingDone, label: "Check-in", icon: KeyRound,
        cta: checkinDone ? "View check-in" : checkin?.stage === "moved_in" ? "Complete check-in" : "Start check-in",
        hint: checkin ? checkin.stage.replace(/_/g, " ") : bookingDone ? "Pending" : "Locked" },
    ];

    let foundActive = false;
    return order.map((o): Step => {
      let state: StepState;
      if (o.done) state = "done";
      else if (!o.unlock) state = "locked";
      else if (!foundActive) { state = "active"; foundActive = true; }
      else state = "todo";
      return { key: o.key, label: o.label, icon: o.icon, state, cta: o.cta, hint: o.hint };
    });
  }, [tours, lead, leadQuotes, checkin, dossier.ready, dossier.filledCount, dossier.totalCount]);

  const activeStep = steps.find((s) => s.state === "active") ?? steps.find((s) => s.state === "todo");
  const nextLabel = activeStep ? activeStep.cta : "All steps complete";

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-2 space-y-2">
      {/* Step row with arrows */}
      <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isCurrent = currentTab === s.key;
          const tone =
            s.state === "done" ? "border-success/60 bg-success/10 text-success"
            : s.state === "active" ? "border-accent bg-accent/15 text-foreground ring-1 ring-accent"
            : s.state === "locked" ? "border-border bg-card text-foreground"
            : "border-border bg-card text-foreground";
          return (
            <div key={s.key} className="flex items-center shrink-0">
              <button
                onClick={() => (s.state === "done" || s.state === "active") && onJump(s.key)}
                disabled={s.state === "locked" || s.state === "todo"}
                aria-current={isCurrent ? "step" : undefined}
                className={`group flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 min-w-[92px] transition-all ${tone} ${isCurrent ? "shadow-sm" : ""} ${s.state === "locked" || s.state === "todo" ? "cursor-not-allowed" : "hover:brightness-110"}`}
                title={s.state === "locked" || s.state === "todo" ? "Complete previous step first" : s.label}
              >
                <div className="flex items-center gap-1">
                  {s.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    : s.state === "locked" ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <Icon className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-[10px] font-semibold whitespace-nowrap">{s.label}</span>
                </div>
                {s.hint && <span className="max-w-[84px] truncate text-[9px] text-muted-foreground leading-none">{s.hint}</span>}
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 mx-0.5 shrink-0 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {activeStep && (
        <Button
          size="sm"
          className="w-full h-7 text-[11px] gap-1.5 font-semibold"
          onClick={() => onJump(activeStep.key)}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Next step · {nextLabel}
        </Button>
      )}
    </div>
  );
}
