import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { scanRevivals } from "@/lib/revival";
import { useMountedNow } from "@/hooks/use-now";
import { useMemo } from "react";
import { Sparkles, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { IntentChip, ConfidenceBar } from "@/components/atoms";

export const Route = createFileRoute("/revival")({
  head: () => ({
    meta: [
      { title: "Revival queue - Gharpayy" },
      { name: "description", content: "Hidden revenue: cold leads matching new inventory, silent hot leads, resolvable objections." },
    ],
  }),
  component: RevivalPage,
});

function RevivalPage() {
  const { leads, properties, tours, sendMessage, startSequence, selectLead } = useApp();
  const [now] = useMountedNow();
  const candidates = useMemo(
    () => scanRevivals(leads, properties, tours, now),
    [leads, properties, tours, now],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-info" /> Revival queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {candidates.length} hidden opportunit{candidates.length === 1 ? "y" : "ies"} - silent leads, cold matches, and now-resolvable objections.
          </p>
        </header>

        {candidates.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <div className="font-display font-semibold">No revival candidates.</div>
            <div className="text-xs text-muted-foreground mt-1">All leads are active or properly closed.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {candidates.map((c) => {
              const lead = leads.find((l) => l.id === c.leadId);
              if (!lead) return null;
              const signalCfg = {
                "hot-silent": { label: "Hot · silent", cls: "bg-destructive/10 text-destructive border-destructive/20" },
                "cold-match": { label: "Inventory match", cls: "bg-info/10 text-info border-info/20" },
                "objection-resolved": { label: "Objection cleared", cls: "bg-success/10 text-success border-success/20" },
              }[c.signal];
              return (
                <div key={c.leadId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <button onClick={() => selectLead(lead.id)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{lead.name}</span>
                      <IntentChip intent={lead.intent} />
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${signalCfg.cls}`}>
                        {signalCfg.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.reason}</div>
                  </button>
                  <ConfidenceBar value={lead.confidence} />
                  <span className="text-[10px] font-mono text-muted-foreground w-12 text-right">score {c.score}</span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => {
                      sendMessage(lead.id, "Revival template sent");
                      startSequence(lead.id, "cold-revival");
                      toast.success(`Revival sequence started · ${lead.name}`);
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Re-engage
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => selectLead(lead.id)}>
                    Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
