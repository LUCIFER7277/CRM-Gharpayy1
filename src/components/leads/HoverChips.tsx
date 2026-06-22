// Hover-card-enabled chips - when user hovers a stage / source / assignee / intent badge
// they see a quick preview (last activity, who owns it, time-in-stage). Used in the
// LeadDrawer and lead row tables for "more info, fewer clicks".
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { formatDistanceToNow } from "date-fns";
import type { Lead } from "@/contracts";

const STAGE_DESCRIPTIONS: Record<string, string> = {
  "new": "Just landed - first contact required within SLA.",
  "contacted": "Connected at least once. Needs qualification.",
  "tour-scheduled": "Tour booked. Confirm 24h prior, reduce no-shows.",
  "tour-done": "Tour complete. Push to negotiation now.",
  "negotiation": "Closing window. Owner approval / draft prep.",
  "booked": "Won. Onboard tenant, register XP.",
  "dropped": "Lost - log reason, schedule revival.",
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  hot: "Highest priority - contact within 5 minutes for ~3x conversion.",
  warm: "Active interest - keep cadence under 24h.",
  cold: "Long-tail - drip nurture sequence recommended.",
};

export function StageChip({ lead }: { lead: Lead }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Badge className="cursor-help capitalize">{lead.stage.replace("-", " ")}</Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs space-y-2">
        <div className="font-semibold text-sm capitalize">Stage · {lead.stage.replace("-", " ")}</div>
        <p className="text-muted-foreground">{STAGE_DESCRIPTIONS[lead.stage] ?? "-"}</p>
        <div className="border-t pt-2 grid grid-cols-2 gap-1">
          <span className="text-muted-foreground">Updated</span>
          <span>{formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}</span>
          <span className="text-muted-foreground">Confidence</span>
          <span>{lead.confidence}%</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function IntentChip({ lead }: { lead: Lead }) {
  const v: "destructive" | "outline" | "secondary" =
    lead.intent === "hot" ? "destructive" : lead.intent === "warm" ? "secondary" : "outline";
  const labelMap = { hot: "Hot", warm: "Good", cold: "Bad" };
  const label = labelMap[lead.intent as keyof typeof labelMap] || lead.intent;
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Badge variant={v} className="cursor-help">{label}</Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 text-xs space-y-1">
        <div className="font-semibold text-sm">Intent · {label}</div>
        <p className="text-muted-foreground">{INTENT_DESCRIPTIONS[lead.intent] ?? "-"}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function SourceChip({ lead }: { lead: Lead }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Badge variant="secondary" className="cursor-help">Source: {lead.source}</Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-56 text-xs">
        <div className="font-semibold text-sm">{lead.source}</div>
        <p className="text-muted-foreground mt-1">Channel of acquisition. Used for ROI and channel-mix analytics.</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function AssigneeChip({ lead, assignees }: { lead: Lead; assignees?: { id: string; label: string }[] }) {
  if (!lead.assignedTcmId) {
    return <Badge variant="outline" className="cursor-help">Unassigned</Badge>;
  }
  const label = assignees?.find((a) => a.id === lead.assignedTcmId)?.label ?? lead.assignedTcmId.slice(-6);
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Badge variant="outline" className="cursor-help">TCM: {label}</Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-56 text-xs">
        <div className="font-semibold text-sm">{label}</div>
        <p className="text-muted-foreground mt-1">Owner of this lead. Re-assign from the Details tab.</p>
      </HoverCardContent>
    </HoverCard>
  );
}
