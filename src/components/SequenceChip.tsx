import { useApp } from "@/lib/store";
import { evaluateSequence, SEQUENCES } from "@/lib/sequences";
import type { SequenceStep } from "@/lib/sequences";
import { useMountedNow } from "@/hooks/use-now";
import { Pause, Play, Sparkles, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SequenceChip({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const { sequences, toggleSequencePause, stopSequence } = useApp();
  const [now, mounted] = useMountedNow(60_000);
  const seq = sequences.find((s) => s.leadId === leadId && !s.stoppedReason);
  if (!seq) return null;
  const state = mounted ? evaluateSequence(seq, now) : null;
  const def = SEQUENCES[seq.kind];

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-info/10 text-info border border-info/20 px-1.5 py-0.5 text-[10px] font-medium">
        <Sparkles className="h-2.5 w-2.5" />
        {def.name} · {seq.currentStep + 1}/{state?.totalSteps ?? def.steps.length}
        {seq.paused && <Pause className="h-2.5 w-2.5" />}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <span className="font-display text-sm font-semibold">{def.name} sequence</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            step {seq.currentStep + 1} / {def.steps.length}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => toggleSequencePause(seq.leadId)}
            title={seq.paused ? "Resume" : "Pause"}
          >
            {seq.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            onClick={() => { stopSequence(seq.leadId, "Stopped manually"); toast.success("Sequence stopped"); }}
            title="Stop"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {state?.nextStep
          ? `Next: "${state.nextStep.label}" ${state.nextAtMs && mounted ? formatDistanceToNow(new Date(state.nextAtMs), { addSuffix: true }) : "soon"}`
          : "All steps sent - awaiting reply."}
      </div>
      <div className="flex gap-1">
        {def.steps.map((s: SequenceStep, i: number) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= seq.currentStep ? "bg-info" : "bg-muted"}`}
            title={s.label}
          />
        ))}
      </div>
    </div>
  );
}
