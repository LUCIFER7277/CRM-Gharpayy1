import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useMountedNow } from "@/hooks/use-now";

/**
 * Hard 48h gate after a tour-done lead with no log entry.
 * Forces capture of either a decision-by date (lead's words) OR a reason
 * for why no commitment was obtained, before the agent can move on.
 */
export function PostVisitGate({ lead }: { lead: Lead }) {
  const tours = useApp((s) => s.tours);
  const activities = useApp((s) => s.activities);
  const allCalls = useCRM10x((s) => s.calls);
  const calls = useMemo(() => allCalls.filter((c) => c.leadId === lead.id), [allCalls, lead.id]);
  const addCommitment = useCRM10x((s) => s.addCommitment);
  const [, mounted] = useMountedNow();

  const lastVisit = useMemo(
    () => tours.filter((t) => t.leadId === lead.id && t.status === "completed")
      .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0],
    [tours, lead.id],
  );

  const hoursSince = lastVisit
    ? (Date.now() - new Date(lastVisit.scheduledAt).getTime()) / 3_600_000
    : 0;

  const hasRecentLog = useMemo(() => {
    if (!lastVisit) return true;
    const cutoff = new Date(lastVisit.scheduledAt).getTime();
    const visitActivity = activities.find(
      (a) => a.leadId === lead.id && +new Date(a.ts) > cutoff && a.kind !== "tour_completed",
    );
    const visitCall = calls.find((c) => +new Date(c.ts) > cutoff);
    return Boolean(visitActivity || visitCall);
  }, [activities, calls, lastVisit, lead.id]);

  const tripped = lastVisit && hoursSince >= 48 && !hasRecentLog && lead.stage !== "booked" && lead.stage !== "dropped";

  const [decisionBy, setDecisionBy] = useState("");
  const [exactWords, setExactWords] = useState("");
  const [reason, setReason] = useState("");

  if (!tripped) return null;

  const submitTimeline = () => {
    if (!decisionBy) { toast.error("Pick a date or reason"); return; }
    addCommitment({
      leadId: lead.id,
      decisionBy: new Date(decisionBy).toISOString(),
      exactWords: exactWords || "(no exact quote)",
    });
    toast.success("Lead commitment recorded");
    setDecisionBy(""); setExactWords("");
  };

  const submitReason = () => {
    if (reason.trim().length < 5) { toast.error("Describe why no decision timeline"); return; }
    // Park as a 24h follow-up
    useApp.getState().setLeadFollowUp(
      lead.id,
      new Date(Date.now() + 24 * 3600_000).toISOString(),
      "high",
      `Post-visit reason: ${reason}`,
    );
    toast.success("Follow-up scheduled - gate cleared");
    setReason("");
  };

  return (
    <div className="mx-5 mt-3 rounded-lg border-2 border-destructive bg-destructive/10 p-3 space-y-3 animate-pulse-soft">
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs">
          <div className="font-bold text-destructive">
            48h post-visit gate · {mounted ? formatDistanceToNow(new Date(lastVisit!.scheduledAt), { addSuffix: true }) : "recently"}
          </div>
          <div className="text-foreground/80 mt-0.5">
            You cannot move this lead forward without a decision timeline OR a logged reason.
            Manager has been notified.
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-card p-2">
        <div className="text-[11px] font-semibold">Did the lead give a decision timeline?</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Decide by</Label>
            <Input type="date" className="h-8 text-xs" value={decisionBy} onChange={(e) => setDecisionBy(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Exact words</Label>
            <Input className="h-8 text-xs" placeholder='e.g. "I will decide by Thursday"' value={exactWords} onChange={(e) => setExactWords(e.target.value)} />
          </div>
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={submitTimeline}>
          Save timeline (clears gate)
        </Button>
      </div>

      <div className="space-y-2 rounded-md bg-card p-2">
        <div className="text-[11px] font-semibold flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" /> No timeline? Log why:
        </div>
        <Textarea
          rows={2} className="text-xs resize-none"
          placeholder="Couldn't reach / they deflected / still thinking…"
          value={reason} onChange={(e) => setReason(e.target.value)}
        />
        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={submitReason}>
          Log reason + 24h follow-up
        </Button>
      </div>
    </div>
  );
}
