import type { Lead, Tour } from "@/lib/types";
import type { NextBestAction } from "@/lib/crm10x/impact-scoring";
import { isTodayIST, isTomorrowIST, minutesUntilTour } from "@/lib/crm10x/dates";

/** Priority bands inside Tour scheduled / On tour today columns (Daily Action Queue style). */
export type TourQueueBand = "fire" | "confirm" | "soon" | "later";

export const TOUR_BAND_ORDER: TourQueueBand[] = ["fire", "confirm", "soon", "later"];

export const TOUR_BAND_META: Record<
  TourQueueBand,
  { label: string; desc: string; border: string; header: string }
> = {
  fire: {
    label: "🔥 NOW",
    desc: "Overdue or starting within 30 min — top priority",
    border: "border-destructive/40",
    header: "bg-destructive/10 text-destructive",
  },
  confirm: {
    label: "📞 CONFIRM",
    desc: "Today / tomorrow — call to confirm visit",
    border: "border-warning/40",
    header: "bg-warning/10 text-warning",
  },
  soon: {
    label: "⚡ NEXT",
    desc: "Coming up soon — stay ready",
    border: "border-accent/40",
    header: "bg-accent/10 text-accent",
  },
  later: {
    label: "📅 LATER",
    desc: "Further out — plan ahead",
    border: "border-border",
    header: "bg-muted/50 text-muted-foreground",
  },
};

export function classifyTourBand(
  column: "scheduled" | "onTour",
  openTour: Tour | undefined,
  lead: Lead,
  nba: NextBestAction,
  nowMs: number,
): TourQueueBand {
  if (!openTour) {
    if (nba.pressure === "escalate" || lead.intent === "hot") return "fire";
    return "later";
  }

  const mins = minutesUntilTour(openTour.scheduledAt, nowMs);

  if (nba.pressure === "escalate") return "fire";
  if (lead.intent === "hot" && mins <= 120) return "fire";

  if (column === "onTour") {
    if (mins < 0 || mins <= 30) return "fire";
    if (mins <= 120) return "confirm";
    return "soon";
  }

  // Tour scheduled (typically future dates)
  if (mins < 0) return "fire";
  if (isTodayIST(openTour.scheduledAt) || isTomorrowIST(openTour.scheduledAt)) return "confirm";
  if (mins <= 60 * 24 * 7) return "soon";
  return "later";
}

export function tourBandSortKey(
  openTour: Tour | undefined,
  band: TourQueueBand,
): number {
  const bandOrder = TOUR_BAND_ORDER.indexOf(band);
  const time = openTour ? +new Date(openTour.scheduledAt) : Number.MAX_SAFE_INTEGER;
  return bandOrder * 1e15 + time;
}

export function tourTimeHint(openTour: Tour | undefined, nowMs: number): string | null {
  if (!openTour) return null;
  const mins = minutesUntilTour(openTour.scheduledAt, nowMs);
  if (mins < 0) return `Tour was ${Math.abs(mins)}m ago — confirm`;
  if (mins < 60) return `Tour in ${mins}m`;
  if (mins < 24 * 60) return `Tour in ${(mins / 60).toFixed(1)}h`;
  const days = Math.round(mins / (60 * 24));
  return `Tour in ${days}d`;
}
