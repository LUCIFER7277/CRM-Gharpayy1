import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useMemo } from "react";
import { ArrowRight, MessageSquare, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/handoffs")({
  head: () => ({
    meta: [
      { title: "Handoffs - Gharpayy" },
      { name: "description", content: "FlowOps ↔ TCM communication thread. Every lead handover, every urgent ping." },
    ],
  }),
  component: HandoffsPage,
});

function HandoffsPage() {
  const { handoffs, leads, tcms, role, currentTcmId, selectLead, markHandoffsRead } = useApp();

  // Group by lead, surface unread to me first
  const grouped = useMemo(() => {
    const byLead = new Map<string, typeof handoffs>();
    for (const h of handoffs) {
      const arr = byLead.get(h.leadId) ?? [];
      arr.push(h);
      byLead.set(h.leadId, arr);
    }
    return Array.from(byLead.entries())
      .map(([leadId, msgs]) => {
        const sorted = [...msgs].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
        const last = sorted[0];
        const unread = sorted.filter((m) => !m.read && m.to === role).length;
        const hasUrgent = sorted.some((m) => m.priority === "urgent" && !m.read);
        return { leadId, msgs: sorted, last, unread, hasUrgent };
      })
      .sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        return +new Date(b.last.ts) - +new Date(a.last.ts);
      });
  }, [handoffs, role]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" /> Handoffs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            FlowOps qualifies and routes. TCM closes. Both sides stay in sync here - every lead, in real time.
          </p>
        </header>

        {grouped.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <div className="font-display font-semibold">No handoffs yet.</div>
            <div className="text-xs text-muted-foreground mt-1">When FlowOps routes a lead or a TCM updates one, it appears here.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {grouped.map(({ leadId, msgs, last, unread, hasUrgent }) => {
              const lead = leads.find((l) => l.id === leadId);
              if (!lead) return null;
              const fromLabel = last.from === "flow-ops"
                ? "Flow Ops"
                : last.from === "tcm"
                  ? tcms.find((t) => t.id === last.fromId)?.name ?? "TCM"
                  : "HR";
              return (
                <div
                  key={leadId}
                  className={`px-4 py-3 hover:bg-muted/30 transition-colors ${hasUrgent ? "bg-destructive/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasUrgent && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="font-medium text-sm">{lead.name}</span>
                        {unread > 0 && (
                          <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-1.5 py-0 text-[10px] font-mono">
                            {unread} new
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">· {msgs.length} msg{msgs.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <span>{fromLabel}</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span>{last.to === "flow-ops" ? "Flow Ops" : last.to === "tcm" ? "TCM" : "HR"}</span>
                        <ClientOnly fallback={<span suppressHydrationWarning>· …</span>}>
                          <span>· {format(new Date(last.ts), "MMM d, p")}</span>
                        </ClientOnly>
                      </div>
                      <div className="text-sm mt-1.5 line-clamp-2">{last.text}</div>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => { selectLead(leadId); markHandoffsRead(leadId); }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
