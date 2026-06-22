import { useState, useMemo } from "react";
import { useCRM10x } from "@/lib/crm10x/store";
import type { ObjectionCode, ObjectionResolution } from "@/lib/crm10x/types";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const OBJECTION_OPTIONS: { code: ObjectionCode; label: string }[] = [
  { code: "price-too-high", label: "Price too high" },
  { code: "location-not-suitable", label: "Location not suitable" },
  { code: "room-too-small", label: "Room too small" },
  { code: "not-ready-yet", label: "Not ready to move yet" },
  { code: "comparing-other-pgs", label: "Comparing other PGs" },
  { code: "needs-family-approval", label: "Needs family approval" },
  { code: "food-not-available", label: "Food not available" },
  { code: "no-ac", label: "No AC" },
  { code: "safety-concern", label: "Safety concern" },
  { code: "no-response-to-offer", label: "No response to offer" },
  { code: "other", label: "Other" },
];

export function ObjectionLogger({
  lead, tourId, context, onLogged,
}: {
  lead: Lead;
  tourId?: string;
  context: "call" | "visit" | "whatsapp";
  onLogged?: () => void;
}) {
  const log = useCRM10x((s) => s.logObjection);
  const allObjections = useCRM10x((s) => s.objections);
  const previousObjection = useMemo(
    () => allObjections.filter((o) => o.leadId === lead.id).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0],
    [allObjections, lead.id],
  );
  const [code, setCode] = useState<ObjectionCode | "">("");
  const [leadWords, setLeadWords] = useState("");
  const [handling, setHandling] = useState("");
  const [resolution, setResolution] = useState<ObjectionResolution>("no");
  const [showPrevious, setShowPrevious] = useState(false);

  const submit = () => {
    if (!code) { toast.error("Pick an objection"); return; }
    if (code === "other" && leadWords.trim().length < 3) {
      toast.error("Write the other objection");
      return;
    }
    if (handling.trim().length < 5) {
      toast.error("Describe how you handled it");
      return;
    }
    log({ leadId: lead.id, tourId, context, code, leadWords, handling, resolution, loggedBy: lead.assignedTcmId });
    toast.success("Objection logged");
    setCode(""); setLeadWords(""); setHandling(""); setResolution("no");
    onLogged?.();
  };

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-warning-foreground">
        <AlertOctagon className="h-3.5 w-3.5" /> Objection capture (mandatory)
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Primary objection</Label>
        <Select value={code} onValueChange={(v) => setCode(v as ObjectionCode)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select objection" /></SelectTrigger>
          <SelectContent>
            {OBJECTION_OPTIONS.map((o) => (
              <SelectItem key={o.code} value={o.code} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {code && (
        <>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {code === "other" ? "Other objection" : "Lead's exact words"}
            </Label>
            <Textarea
              rows={2} value={leadWords} onChange={(e) => setLeadWords(e.target.value)}
              placeholder={code === "other" ? "Write the objection the lead raised..." : 'e.g. "12k is more than I can do, my parents said max 10k"'}
              className="text-xs resize-none"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">How you handled it</Label>
            <Textarea
              rows={2} value={handling} onChange={(e) => setHandling(e.target.value)}
              placeholder="What you said, what offer you made…"
              className="text-xs resize-none"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Is it resolved?</Label>
            <Select value={resolution} onValueChange={(v) => setResolution(v as ObjectionResolution)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes - fully</SelectItem>
                <SelectItem value="partially">Partially</SelectItem>
                <SelectItem value="no">No - still blocking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="rounded-md border border-border bg-muted/20 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Previous objection
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            disabled={!previousObjection}
            onClick={() => setShowPrevious((value) => !value)}
          >
            {showPrevious ? "Hide" : "See"}
          </Button>
        </div>
        {showPrevious && previousObjection ? (
          <div className="mt-2 rounded-md border border-border bg-card p-2 text-[11px]">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <span>{format(new Date(previousObjection.ts), "MMM d, h:mm a")}</span>
              <span className="capitalize">{previousObjection.resolution === 'yes' ? 'Resolved fully' : previousObjection.resolution === 'no' ? 'Not resolved' : 'Partially resolved'}</span>
            </div>
            <div className="font-semibold text-foreground">{OBJECTION_OPTIONS.find((o) => o.code === previousObjection.code)?.label || previousObjection.code}</div>
            {previousObjection.leadWords && <div className="mt-1 whitespace-pre-wrap text-muted-foreground italic">"{previousObjection.leadWords}"</div>}
            {previousObjection.handling && <div className="mt-1 whitespace-pre-wrap text-foreground">{previousObjection.handling}</div>}
          </div>
        ) : null}
      </div>
      <Button size="sm" onClick={submit} className="w-full h-8 text-xs">Log objection</Button>
    </div>
  );
}

export function ObjectionTag({ leadId }: { leadId: string }) {
  const open = useCRM10x((s) => s.unresolvedObjectionFor(leadId));
  if (!open) return null;
  const label = OBJECTION_OPTIONS.find((o) => o.code === open.code)?.label ?? open.code;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive font-medium">
      <AlertOctagon className="h-2.5 w-2.5" /> Objection: {label}
    </span>
  );
}
