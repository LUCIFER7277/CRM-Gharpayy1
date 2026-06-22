import type { Lead, LeadStage, Property, TCM, Tour } from "@/lib/types";
import type { Quotation } from "@/lib/crm10x/quotations";
import type { NextBestAction } from "@/lib/crm10x/impact-scoring";
import type { TourQueueBand } from "@/lib/crm10x/tour-queue-bands";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type ColumnKey = "inbox" | "scheduled" | "onTour" | "quoted" | "booked";

/** Target stage when dragging a card into a column (confirmed in dialog). */
export const COLUMN_STAGE_TARGET: Partial<Record<ColumnKey, LeadStage>> = {
  inbox: "contacted",
  scheduled: "tour-scheduled",
  onTour: "on-tour",
  quoted: "quote-sent",
  booked: "booked",
};

export type ImpactEnriched = {
  lead: Lead;
  openTour?: Tour;
  lastQuote?: Quotation;
  nba: NextBestAction;
  score: number;
  column: ColumnKey;
  tourBand?: TourQueueBand;
  tourTimeHint?: string;
};

export const COLUMNS: { key: ColumnKey; label: string; tint: string; icon: LucideIcon }[] = [
  { key: "inbox", label: "Inbox", tint: "border-l-info", icon: Sparkles },
  { key: "scheduled", label: "Tour scheduled", tint: "border-l-accent", icon: Calendar },
  { key: "onTour", label: "On tour today", tint: "border-l-warning", icon: UserCheck },
  { key: "quoted", label: "Quote sent", tint: "border-l-primary", icon: FileText },
  { key: "booked", label: "Booked", tint: "border-l-success", icon: CheckCircle2 },
];

export type EnrichedLite = ImpactEnriched;

export type BoardColumnProps = {
  columnKey: ColumnKey;
  items: ImpactEnriched[];
  tcms: TCM[];
  properties: Property[];
  nowMs: number;
  focusLeadId: string | null;
  focusAction: import("@/lib/crm10x/impact-hard-actions").LeadFocusAction | null;
  keyboardFocusLeadId: string | null;
  onFocusConsumed: () => void;
  onRequestStageMove: (leadId: string, from: ColumnKey, to: ColumnKey) => void;
};
