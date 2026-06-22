import { CopyChip } from "@/components/atc/CopyChip";
import type { VisitRecord, VisitStage } from "@/lib/visits/war-store";
import {
  visitBlock, visitReminderBlock, visitReachedBlock, visitOngoingBlock,
  visitDoneBlock, hotLeadBlock, tokenRequestBlock, revivalBlock, ownerNotifyBlock,
  type VisitCopyCtx,
} from "@/lib/impact/copy-formats";

function ctxFor(v: VisitRecord, pricePerBed?: number): VisitCopyCtx {
  return {
    leadName: v.leadName,
    leadPhone: v.leadPhone,
    propertyName: v.propertyName,
    propertyArea: v.propertyArea,
    scheduledAt: v.scheduledAt,
    pricePerBed,
  };
}

export function VisitCopyChips({
  v, pricePerBed, layout = "wrap",
}: {
  v: VisitRecord;
  pricePerBed?: number;
  layout?: "wrap" | "inline";
}) {
  const c = ctxFor(v, pricePerBed);
  const items = chipsForStage(v.stage, c);
  items.push({
    label: "Owner ping",
    text: ownerNotifyBlock({
      propertyName: v.propertyName,
      event: v.stage === "scheduled" ? "scheduled"
        : v.stage === "started" ? "started"
        : v.stage === "at-property" ? "reached"
        : v.stage === "tour-ongoing" ? "reached"
        : v.stage === "completed" ? "completed"
        : v.stage === "booked" ? "booked"
        : v.stage === "objection" ? "objection"
        : "scheduled",
      whenMs: Date.now(),
      reaction: v.reaction,
      objectionCategory: v.objections[0]?.category,
    }),
  });

  return (
    <div className={layout === "inline" ? "inline-flex flex-wrap gap-1" : "flex flex-wrap gap-1.5"}>
      {items.map((i) => (
        <CopyChip key={i.label} size="xs" label={i.label} text={i.text} />
      ))}
    </div>
  );
}

function chipsForStage(stage: VisitStage, c: VisitCopyCtx): Array<{ label: string; text: string }> {
  switch (stage) {
    case "scheduled":
      return [
        { label: "Confirm", text: visitBlock(c) },
        { label: "T-60", text: visitReminderBlock(c, "t60") },
        { label: "T-15", text: visitReminderBlock(c, "t15") },
      ];
    case "started":
      return [
        { label: "On way", text: visitReminderBlock(c, "t15") },
        { label: "Address", text: visitBlock(c) },
      ];
    case "at-property":
      return [
        { label: "Reached", text: visitReachedBlock(c) },
      ];
    case "tour-ongoing":
      return [
        { label: "Tour ping", text: visitOngoingBlock(c) },
      ];
    case "completed":
      return [
        { label: "Thank-you", text: visitDoneBlock(c) },
        { label: "Hot nudge", text: hotLeadBlock(c) },
        { label: "Token req", text: tokenRequestBlock(c) },
      ];
    case "objection":
      return [
        { label: "Reassure", text: visitDoneBlock(c) },
        { label: "Hot nudge", text: hotLeadBlock(c) },
      ];
    case "follow-up":
      return [
        { label: "Hot nudge", text: hotLeadBlock(c) },
        { label: "Token req", text: tokenRequestBlock(c) },
      ];
    case "booked":
      return [
        { label: "Welcome", text: visitDoneBlock(c) },
      ];
    case "lost":
      return [
        { label: "Revive", text: revivalBlock(c) },
      ];
  }
}
