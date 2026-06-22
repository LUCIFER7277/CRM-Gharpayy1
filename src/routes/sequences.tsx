import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { evaluateSequence, SEQUENCES } from "@/lib/sequences";
import { useMountedNow } from "@/hooks/use-now";
import { useMemo } from "react";
import { Sparkles, Pause, Play, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/sequences")({
  head: () => ({
    meta: [
      { title: "Sequences - Gharpayy" },
      { name: "description", content: "Every WhatsApp sequence in flight. Pause, resume, stop. Auto-stops on reply or stage change." },
    ],
  }),
  component: SequencesPage,
});

function SequencesPage() {
  const { sequences, leads, toggleSequencePause, stopSequence, selectLead } = useApp();
  const [now, mounted] = useMountedNow(60_000);

  const active = useMemo(() => sequences.filter((s) => !s.stoppedReason), [sequences]);
  const stopped = useMemo(() => sequences.filter((s) => !!s.stoppedReason), [sequences]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-info" /> Sequences
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {active.length} active · {stopped.length} stopped. Auto-paused on reply, auto-stopped on booking or drop.
          </p>
        </header>

        {/* Active */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <span className="h-2 w-2 rounded-full bg-info animate-pulse" />
            <h2 className="font-display text-sm font-semibold">Active</h2>
            <span className="text-[10px] font-mono text-muted-foreground">{active.length}</span>
          </header>
          {active.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No active sequences. Start one from any lead's Control panel.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {active.map((seq) => {
                const lead = leads.find((l) => l.id === seq.leadId);
                if (!lead) return null;
                const def = SEQUENCES[seq.kind];
                const state = mounted ? evaluateSequence(seq, now) : null;
                return (
                  <div key={seq.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center hover:bg-muted/30 transition-colors">
                    <button onClick={() => selectLead(lead.id)} className="col-span-3 text-left min-w-0">
                      <div className="font-medium text-sm truncate">{lead.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{lead.preferredArea} · {lead.phone}</div>
                    </button>
                    <div className="col-span-2">
                      <div className="text-xs font-medium">{def.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">step {seq.currentStep + 1}/{def.steps.length}</div>
                    </div>
                    <div className="col-span-3">
                      <div className="flex gap-1">
                        {def.steps.map((s, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= seq.currentStep ? "bg-info" : "bg-muted"}`} title={s.label} />
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2 text-[11px] text-muted-foreground min-h-[1em]">
                      {state?.nextStep
                        ? <>Next <span className="font-medium text-foreground">{state.nextStep.label}</span> {state.nextAtMs && mounted ? formatDistanceToNow(new Date(state.nextAtMs), { addSuffix: true }) : "soon"}</>
                        : "Awaiting reply"}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { toggleSequencePause(seq.leadId); toast.success(seq.paused ? "Resumed" : "Paused"); }}
                        title={seq.paused ? "Resume" : "Pause"}>
                        {seq.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { stopSequence(seq.leadId, "Stopped from console"); toast.success("Stopped"); }}
                        title="Stop">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => selectLead(lead.id)} title="Open lead">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stopped (last 10) */}
        {stopped.length > 0 && (
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <h2 className="font-display text-sm font-semibold text-muted-foreground">Recently stopped</h2>
              <span className="text-[10px] font-mono text-muted-foreground">{stopped.length}</span>
            </header>
            <div className="divide-y divide-border">
              {stopped.slice(0, 10).map((seq) => {
                const lead = leads.find((l) => l.id === seq.leadId);
                if (!lead) return null;
                return (
                  <button key={seq.id} onClick={() => selectLead(lead.id)} className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{lead.name}</div>
                      <div className="text-[11px] text-muted-foreground">{SEQUENCES[seq.kind].name} · {seq.stoppedReason}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
