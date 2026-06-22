import { useMemo } from "react";
import { useApp } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { formatINR, useQuotationsQuery } from "@/lib/crm10x/quotations";
import { useLeadInterests } from "@/lib/crm10x/lead-interests";
import { resolvePropertyById } from "@/lib/crm10x/property-catalog";
import { Badge } from "@/components/ui/badge";
import { Brain, Target, AlertTriangle, Heart } from "lucide-react";
import { differenceInHours, format, isValid, parseISO } from "date-fns";

function parseLeadDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const iso = parseISO(trimmed);
  if (isValid(iso)) return iso;
  const fallback = new Date(trimmed);
  return isValid(fallback) ? fallback : null;
}

function formatMonthYear(raw: string | null | undefined): string {
  const d = parseLeadDate(raw);
  if (!d) return "Not specified";
  return format(d, "MMM yyyy");
}

function formatShortDate(raw: string | null | undefined): string {
  const d = parseLeadDate(raw);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(d);
}

/**
 * Smart Dossier — 3-line auto-summary of a lead, derived from store data.
 * Drop into any drawer/sheet for an instant context bite.
 */
export function SmartDossier({ lead }: { lead: Lead }) {
  const tours = useApp((s) => s.tours);
  const properties = useApp((s) => s.properties);
  const activities = useApp((s) => s.activities);
  const { data: quotes = [] } = useQuotationsQuery(lead.id);
  const { data: interests = [] } = useLeadInterests(lead.id);

  const summary = useMemo(() => {
    const leadTours = tours.filter((t) => t.leadId === lead.id);
    const lastTour = [...leadTours].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0];
    const lastQuote = quotes
      .filter((q) => q.leadId === lead.id)
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
    const lastNote = activities
      .filter((a) => a.leadId === lead.id && a.kind === "note_added")
      .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))[0];

    const confidence = [
      lead.replied ? 20 : 0,
      lead.tourDate || lastTour?.scheduledAt ? 30 : 0,
      lead.budget > 0 ? 20 : 0,
      (lead.interestLevel ?? lead.priority ?? lead.intent) === "hot" ? 30 : 0,
    ].reduce((a, b) => a + b, 0);
    const intentRaw = String(lead.interestLevel ?? lead.priority ?? lead.intent);
    const intentLabel = intentRaw === "hot" ? "HOT" : intentRaw === "medium" || intentRaw === "warm" ? "WARM" : "COLD";
    const moveInSource = lead.moveInDate || lead.earliestCheckIn;
    const moveInLabel = formatMonthYear(moveInSource);
    const budgetLabel = lead.budget > 0 ? formatINR(lead.budget) : "Not specified";
    const blocker = lead.primaryObjection ?? lastTour?.postTour?.objection ?? lastTour?.postTour?.objectionNote;
    const lastContact = parseLeadDate(lead.lastContactAt);
    const freshness = lastContact
      ? `Untouched ${differenceInHours(new Date(), lastContact)}h`
      : "Never contacted";

    // Line 1 — budget + area + move-in
    const budgetLine = `${budgetLabel}/mo · ${lead.preferredArea || "Area not specified"} · move-in ${moveInLabel}`;

    // Line 2 — must-haves (from tags) + interested properties
    const mustHaves = (lead.tags ?? []).filter((t) => !["hot", "warm", "cold"].includes(t)).slice(0, 3);
    const liked = interests
      .map((pid) => resolvePropertyById(pid, properties)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
    const wantsLine =
      [mustHaves.length ? `Wants: ${mustHaves.join(" · ")}` : null, liked ? `Liked: ${liked}` : null]
        .filter(Boolean)
        .join("  ·  ") || "No stated preferences yet.";

    // Line 3 — last objection / blocker / signal
    const blockerLine = blocker
      ? `Last blocker: ${blocker}`
      : lastQuote
        ? `Quote sent ${formatShortDate(lastQuote.sentAt)} · awaiting reply.`
        : lastNote
          ? `Latest note: ${lastNote.text.slice(0, 90)}${lastNote.text.length > 90 ? "..." : ""}`
          : "No blockers logged";

    return { budgetLine, wantsLine, blockerLine, confidence, intentLabel, freshness };
  }, [lead, tours, properties, activities, quotes, interests]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-br from-accent/5 via-card to-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-accent/15 text-accent flex items-center justify-center">
          <Brain className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-accent">Smart dossier</div>
        <Badge variant="outline" className="text-[9px] ml-auto">{summary.intentLabel}</Badge>
        <Badge variant="outline" className="text-[9px]">{summary.confidence}% conf</Badge>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-start gap-2">
          <Target className="h-3 w-3 text-primary mt-0.5 shrink-0" />
          <span className="text-foreground">{summary.budgetLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <Heart className="h-3 w-3 text-danger mt-0.5 shrink-0" />
          <span className="text-foreground">{summary.wantsLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
          <span className="text-foreground">{summary.blockerLine}</span>
        </div>
        <div className="flex items-start gap-2">
          <Brain className="h-3 w-3 text-accent mt-0.5 shrink-0" />
          <span className="text-foreground">{summary.freshness}</span>
        </div>
      </div>
    </div>
  );
}
