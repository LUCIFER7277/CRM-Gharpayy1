import type { Lead, Tour } from "@/lib/types";
import type { Quotation } from "@/lib/crm10x/quotations";
import type { NextBestAction } from "@/lib/crm10x/impact-scoring";
import { isTodayIST } from "@/lib/crm10x/dates";
import type { TourQueueBand } from "@/lib/crm10x/tour-queue-bands";

export type HardActionKey =
  | "call-hot"
  | "schedule"
  | "quote"
  | "negotiate"
  | "book"
  | "checkin"
  | "revive";

/** Opens the matching tool in the lead drawer (`auto` = pick from NBA). */
export type LeadFocusAction = HardActionKey | "auto";

export function mapNbaToFocusAction(
  nbaVerb: string,
  column: string,
  hasQuote: boolean,
): LeadFocusAction {
  if (nbaVerb === "call") return "call-hot";
  if (nbaVerb === "schedule") return "schedule";
  if (nbaVerb === "quote" || nbaVerb === "follow-quote") return "quote";
  if (nbaVerb === "negotiate") return "negotiate";
  if (nbaVerb === "book") return "book";
  if (nbaVerb === "revive") return "revive";
  if (column === "booked") return "checkin";
  if (column === "quoted" && hasQuote) return "quote";
  if (column === "scheduled" || column === "onTour") return "schedule";
  return "call-hot";
}

export type ImpactPriority = "now" | "today" | "soon" | "later" | "won";

export type ImpactEnrichedPick = {
  lead: Lead;
  openTour?: Tour;
  lastQuote?: Quotation;
  nba: NextBestAction;
  score: number;
  column: string;
  tourBand?: TourQueueBand;
};

function byScore(a: ImpactEnrichedPick, b: ImpactEnrichedPick) {
  return b.score - a.score;
}

function allMatch(list: ImpactEnrichedPick[], pred: (e: ImpactEnrichedPick) => boolean) {
  return [...list].sort(byScore).filter(pred);
}

export function pickLeadsForHardAction(
  key: HardActionKey,
  list: ImpactEnrichedPick[],
  limit = 5,
): ImpactEnrichedPick[] {
  const active = list.filter((e) => e.lead.stage !== "dropped" && e.lead.stage !== "booked");
  let matches: ImpactEnrichedPick[] = [];

  switch (key) {
    case "call-hot":
      matches = allMatch(
        active,
        (e) =>
          e.nba.verb === "call" ||
          (e.lead.intent === "hot" && ["new", "contacted", "tour-scheduled", "on-tour"].includes(e.lead.stage)),
      );
      break;
    case "schedule":
      matches = allMatch(
        active,
        (e) =>
          e.nba.verb === "schedule" ||
          ((e.column === "inbox" || e.lead.stage === "new" || e.lead.stage === "contacted") && !e.openTour),
      );
      break;
    case "quote":
      matches = allMatch(
        active,
        (e) =>
          e.nba.verb === "quote" ||
          e.column === "quoted" ||
          e.lead.stage === "tour-done" ||
          e.lead.stage === "quote-sent",
      );
      break;
    case "negotiate":
      matches = allMatch(
        active,
        (e) => e.nba.verb === "negotiate" || e.lead.stage === "negotiation" || e.nba.verb === "follow-quote",
      );
      break;
    case "book":
      matches = allMatch(
        active,
        (e) => e.nba.verb === "book" || e.lastQuote?.status === "paid",
      );
      break;
    case "checkin":
      matches = allMatch(list, (e) => e.column === "booked" || e.lead.stage === "booked");
      break;
    case "revive":
      matches = allMatch(
        list,
        (e) => e.nba.verb === "revive" || e.lead.stage === "dropped" || e.lead.stage === "not-responding-3d" || e.lead.stage === "not-responding-7d",
      );
      break;
  }

  return matches.slice(0, limit);
}

export function topSuggestion(list: ImpactEnrichedPick[]): ImpactEnrichedPick | undefined {
  const active = list.filter((e) => e.lead.stage !== "booked" && e.lead.stage !== "dropped");
  const escalate = allMatch(active, (e) => e.nba.pressure === "escalate")[0];
  if (escalate) return escalate;
  return allMatch(active, (e) => e.nba.verb !== "rest")[0];
}

export function classifyImpactPriority(e: ImpactEnrichedPick): ImpactPriority {
  if (e.column === "booked" || e.lead.stage === "booked") return "won";
  if (e.nba.pressure === "escalate" || e.tourBand === "fire") return "now";
  if (
    e.tourBand === "confirm" ||
    (e.openTour && isTodayIST(e.openTour.scheduledAt)) ||
    e.column === "onTour"
  ) {
    return "today";
  }
  if (e.tourBand === "soon" || e.nba.pressure === "watch") return "soon";
  return "later";
}

export const IMPACT_PRIORITY_META: Record<
  ImpactPriority,
  { label: string; dot: string; hint: string }
> = {
  now: { label: "Do now", dot: "bg-danger", hint: "Escalating — act immediately" },
  today: { label: "Today", dot: "bg-warning", hint: "Tour or follow-up due today" },
  soon: { label: "Soon", dot: "bg-info", hint: "Coming up — stay ready" },
  later: { label: "Later", dot: "bg-muted-foreground", hint: "No rush yet" },
  won: { label: "Won", dot: "bg-success", hint: "Booked — check-in & handover" },
};
