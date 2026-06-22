import { useEffect, useMemo, useState } from "react";
import { useCRM10x } from "@/lib/crm10x/store";
import type {
  DecisionAuthority, Gender, RoomTypePref,
} from "@/lib/crm10x/types";
import type { Lead } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(value?: string | null) {
  const input = toInputDate(value);
  if (!input) return "";
  return new Date(input).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function LeadDeepProfile({
  lead,
  defaultOpen = false,
  showShiftingHistory = true,
}: {
  lead: Lead;
  defaultOpen?: boolean;
  showShiftingHistory?: boolean;
}) {
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const upsert = useCRM10x((s) => s.upsertProfile);
  const [open, setOpen] = useState(defaultOpen);

  const f = profile ?? { leadId: lead.id, updatedAt: new Date().toISOString() };

  const completion = profileCompletion(f as unknown as Record<string, unknown>);

  useEffect(() => {
    const patch: Record<string, unknown> = { leadId: lead.id };
    const inferredGender = inferGender(lead);
    const inferredRoom = inferRoom(lead);
    const [budgetMin, budgetMax] = inferBudgetRange(lead);
    const moveInDate = toInputDate(f.preferredMoveInDate || lead.moveInDate);

    if (!f.gender && inferredGender) patch.gender = inferredGender;
    if (!f.roomType && inferredRoom) patch.roomType = inferredRoom;
    if (!f.preferredMoveInDate && moveInDate) patch.preferredMoveInDate = new Date(moveInDate).toISOString();
    const canCorrectCollapsedBudget =
      budgetMin !== undefined &&
      budgetMax !== undefined &&
      budgetMin !== budgetMax &&
      f.budgetStated === lead.budget &&
      f.budgetMax === lead.budget;
    if ((!f.budgetStated && budgetMin) || canCorrectCollapsedBudget) patch.budgetStated = budgetMin;
    if ((!f.budgetMax && budgetMax) || canCorrectCollapsedBudget) patch.budgetMax = budgetMax;
    if (Object.keys(patch).length > 1) upsert(patch as Parameters<typeof upsert>[0]);
  }, [
    lead.id,
    lead.need,
    lead.room,
    lead.budget,
    (lead as Lead & { budgetText?: string }).budgetText,
    lead.moveInDate,
    f.gender,
    f.roomType,
    f.preferredMoveInDate,
    f.budgetStated,
    f.budgetMax,
    upsert,
  ]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-full flex items-center justify-center px-3 py-2 text-xs hover:bg-muted/40"
      >
        <span className="font-semibold flex items-center justify-center gap-2">
          Deep profile
          <span className="text-[10px] text-muted-foreground">{completion}% complete</span>
          {completion >= 80 && <CheckCircle2 className="h-3 w-3 text-success" />}
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-2.5">
          <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-lg border border-border/80">
            <div className="space-y-2 border-r border-border bg-muted/10 p-2.5">
              <Field label="PG type">
                <OptionPills
                  value={f.gender ?? ""}
                  options={[
                    { value: "boys-pg", label: "Boys PG" },
                    { value: "girls-pg", label: "Girls PG" },
                    { value: "co-live", label: "Co-live" },
                  ]}
                  onChange={(v) => upsert({ leadId: lead.id, gender: v as Gender })}
                />
              </Field>
              <Field label="Room">
                <OptionPills
                  value={f.roomType ?? ""}
                  options={[
                    { value: "single", label: "Single" },
                    { value: "double", label: "Double" },
                    { value: "any", label: "Any" },
                  ]}
                  onChange={(v) => upsert({ leadId: lead.id, roomType: v as RoomTypePref })}
                />
              </Field>
              <Field label="Decision-maker">
                <OptionPills
                  value={f.decisionMaker ?? ""}
                  options={[
                    { value: "self", label: "Self" },
                    { value: "parents", label: "Parents" },
                    { value: "company-hr", label: "Company / HR" },
                  ]}
                  onChange={(v) => upsert({ leadId: lead.id, decisionMaker: v as DecisionAuthority })}
                />
              </Field>
            </div>
            <div className="space-y-2 bg-muted/10 p-2.5">
              <Field label="Location feasibility">
                <OptionPills
                  value={f.locationFeasible === undefined ? "" : f.locationFeasible ? "yes" : "no"}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  onChange={(v) => upsert({ leadId: lead.id, locationFeasible: v === "yes" })}
                />
              </Field>
              <Field label="Company / college">
                <Input
                  className="h-8 text-xs"
                  value={f.companyOrCollege ?? ""}
                  onChange={(e) => upsert({ leadId: lead.id, companyOrCollege: e.target.value })}
                />
              </Field>
              <Field label="Best time to call">
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. after 6 PM"
                  value={f.bestCallTime ?? ""}
                  onChange={(e) => upsert({ leadId: lead.id, bestCallTime: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-[1.25fr_0.75fr] gap-2 rounded-lg border border-border/80 bg-muted/10 p-2.5">
            <Field label="Move-in date">
              <Input
                type="date"
                className="h-8 text-xs"
                min={new Date().toISOString().slice(0, 10)}
                value={toInputDate(f.preferredMoveInDate || lead.moveInDate)}
                onChange={(e) => {
                  const value = e.target.value;
                  upsert({
                    leadId: lead.id,
                    preferredMoveInDate: value ? new Date(value).toISOString() : undefined,
                    verifiedMoveIn: Boolean(value),
                  });
                }}
              />
            </Field>
            <div className="rounded-md border border-border bg-card px-2 py-1.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Current</div>
              <div className="truncate text-xs font-semibold text-foreground">
                {toDisplayDate(f.preferredMoveInDate || lead.moveInDate) || "Not set"}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/10 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Budget check</span>
              <Button
                size="sm" variant={f.verifiedBudget ? "default" : "outline"}
                className="h-6 px-2 text-[10px]"
                onClick={() => { upsert({ leadId: lead.id, verifiedBudget: !f.verifiedBudget }); toast.success("Budget verification updated"); }}
              >
                {f.verifiedBudget ? "Verified" : "Mark verified"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Stated budget (₹)">
                <Input
                  type="number" className="h-8 text-xs"
                  value={f.budgetStated ?? ""}
                  onChange={(e) => upsert({ leadId: lead.id, budgetStated: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max budget (₹)">
                <Input
                  type="number" className="h-8 text-xs"
                  value={f.budgetMax ?? ""}
                  onChange={(e) => upsert({ leadId: lead.id, budgetMax: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>

          {showShiftingHistory && <ShiftingDateHistory lead={lead} />}
        </div>
      )}
    </div>
  );
}

export function ShiftingDateHistory({ lead }: { lead: Lead }) {
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const addShiftingDate = useCRM10x((s) => s.addShiftingDate);
  const f = profile ?? { leadId: lead.id, updatedAt: new Date().toISOString() };
  const history = f.shiftingHistory ?? [];
  const activeDate = useMemo(() => {
    const raw = f.preferredMoveInDate || lead.moveInDate || "";
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }, [f.preferredMoveInDate, lead.moveInDate]);
  const [newShift, setNewShift] = useState(activeDate);
  const [shiftReason, setShiftReason] = useState("");

  useEffect(() => {
    setNewShift(activeDate);
  }, [activeDate, lead.id]);

  const submitShift = () => {
    if (!newShift) {
      toast.error("Pick a shifting date");
      return;
    }
    addShiftingDate(lead.id, {
      shiftingDate: new Date(newShift).toISOString(),
      reason: shiftReason || undefined,
      loggedBy: lead.assignedTcmId,
    });
    toast.success("Shifting date updated - old entry kept in history");
    setShiftReason("");
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <CalendarClock className="h-3.5 w-3.5 text-accent" />
          Shifting date history
        </div>
        {activeDate && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Active: {format(new Date(activeDate), "MMM d, yyyy")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Current shifting date</Label>
          <Input type="date" className="h-8 text-xs" value={newShift} onChange={(e) => setNewShift(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason if changed</Label>
          <Input className="h-8 text-xs" placeholder="e.g. family asked for next week" value={shiftReason} onChange={(e) => setShiftReason(e.target.value)} />
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={submitShift}>Update</Button>
      </div>
      {history.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <History className="h-3 w-3" /> Past entries
          </div>
          {history.slice(0, 6).map((h, i) => (
            <div key={`${h.ts}-${i}`} className="flex items-center justify-between text-[11px]">
              <span>
                <span className={i === 0 ? "font-semibold text-foreground" : "text-muted-foreground line-through"}>
                  {format(new Date(h.shiftingDate), "MMM d, yyyy")}
                </span>
                {h.reason && <span className="text-muted-foreground"> · {h.reason}</span>}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {format(new Date(h.ts), "MMM d")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function OptionPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-7 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function countFilled(p: Record<string, unknown>): number {
  const keys = [
    "gender","roomType","decisionMaker",
    "locationFeasible","companyOrCollege","budgetStated","verifiedBudget",
    "preferredMoveInDate",
  ];
  return keys.filter((k) => {
    const v = p[k];
    return v !== undefined && v !== null && v !== "";
  }).length;
}

function profileCompletion(p: Record<string, unknown>): number {
  const total = 8;
  return Math.min(100, Math.round((countFilled(p) / total) * 100));
}

function inferGender(lead: Lead): Gender | undefined {
  const need = String(lead.need ?? "").toLowerCase();
  if (need.includes("boy")) return "boys-pg";
  if (need.includes("girl")) return "girls-pg";
  if (need.includes("coed") || need.includes("co-ed")) return "co-live";
  return undefined;
}

function inferRoom(lead: Lead): RoomTypePref | undefined {
  const room = String(lead.room ?? "").toLowerCase();
  if (room.includes("private") || room.includes("single")) return "single";
  if (room.includes("shared") || room.includes("double")) return "double";
  if (room.includes("both") || room.includes("any") || room.includes("studio")) return "any";
  return undefined;
}

function inferBudgetRange(lead: Lead): [number | undefined, number | undefined] {
  const candidates = [
    (lead as Lead & { budgetText?: string }).budgetText,
    lead.notes,
    lead.specialReqs,
    lead.fullAddress,
  ].filter(Boolean).join(" ");
  const match = candidates.match(/(\d+(?:\.\d+)?)\s*k?\s*[-–]\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (match) {
    const min = Number(match[1]) * 1000;
    const max = Number(match[2]) * 1000;
    if (min > 0 && max >= min) return [min, max];
  }
  return lead.budget ? [lead.budget, lead.budget] : [undefined, undefined];
}
