import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfidenceBar, IntentChip } from "@/components/atoms";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { useMountedNow } from "@/hooks/use-now";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/follow-ups")({
  head: () => ({
    meta: [{ title: "Follow-ups - Gharpayy" }, { name: "description", content: "Daily follow-up queue ranked by deal probability and urgency." }],
  }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  const { followUps, leads, completeFollowUp, selectLead, role, currentTcmId } = useApp();
  const authUser = useAuthUser((s) => s.user);
  const [, mounted] = useMountedNow();

  const selfId = authUser?.id || (role === "tcm" ? currentTcmId : "");
  const scopedFollowUps = useMemo(() => {
    if (!selfId || role !== "tcm") return followUps;
    return followUps.filter((f) => f.tcmId === selfId);
  }, [followUps, role, selfId]);

  const enriched = useMemo(() => {
    return scopedFollowUps
      .filter((f) => !f.done)
      .map((f) => ({ f, lead: leads.find((l) => l.id === f.leadId) }))
      .filter((x) => x.lead);
  }, [scopedFollowUps, leads]);

  const overdue = enriched.filter((x) => isPast(new Date(x.f.dueAt)) && !isToday(new Date(x.f.dueAt)));
  const today = enriched.filter((x) => isToday(new Date(x.f.dueAt)));
  const upcoming = enriched.filter((x) => !isPast(new Date(x.f.dueAt)) && !isToday(new Date(x.f.dueAt)));
  const hot = enriched.filter((x) => x.lead!.intent === "hot");

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Follow-up queue</h1>
          <p className="text-sm text-muted-foreground">
            {overdue.length} overdue · {today.length} today · {upcoming.length} upcoming · {hot.length} hot
          </p>
        </header>

        <Bucket
          title="Overdue" tone="destructive" items={overdue}
          mounted={mounted}
          onDone={(id) => { completeFollowUp(id); toast.success("Follow-up marked done"); }}
          onOpen={selectLead}
        />
        <Bucket
          title="Today" tone="accent" items={today}
          mounted={mounted}
          onDone={(id) => { completeFollowUp(id); toast.success("Follow-up marked done"); }}
          onOpen={selectLead}
        />
        <Bucket
          title="Upcoming" items={upcoming}
          mounted={mounted}
          onDone={(id) => { completeFollowUp(id); toast.success("Follow-up marked done"); }}
          onOpen={selectLead}
        />
      </div>
    </AppShell>
  );
}

function Bucket({
  title, items, tone = "default", mounted, onDone, onOpen,
}: {
  title: string;
  items: { f: import("@/lib/types").FollowUp; lead?: import("@/lib/types").Lead }[];
  tone?: "default" | "accent" | "destructive";
  mounted: boolean;
  onDone: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const toneCls = {
    default: "border-border",
    accent: "border-accent/30",
    destructive: "border-destructive/30",
  }[tone];
  const titleCls = {
    default: "text-foreground",
    accent: "text-accent",
    destructive: "text-destructive",
  }[tone];

  return (
    <section>
      <h2 className={`font-display text-sm font-semibold mb-2 ${titleCls}`}>{title} <span className="text-muted-foreground font-normal">({items.length})</span></h2>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <div className={`rounded-xl border ${toneCls} bg-card overflow-hidden divide-y divide-border`}>
          {items.map(({ f, lead }) => (
            <div key={f.id} className="grid grid-cols-12 px-4 py-3 items-center gap-2 hover:bg-accent/5 transition-colors">
              <button onClick={() => onOpen(lead!.id)} className="col-span-3 text-left">
                <div className="font-medium text-sm">{lead!.name}</div>
                <div className="text-[11px] text-muted-foreground">{lead!.phone}</div>
              </button>
              <div className="col-span-2 flex items-center gap-2">
                <IntentChip intent={lead!.intent} />
              </div>
              <div className="col-span-2"><ConfidenceBar value={lead!.confidence} /></div>
              <div className="col-span-3 text-xs">
                <div>{f.reason}</div>
                <div className="text-muted-foreground text-[11px]">{format(new Date(f.dueAt), "MMM d, p")} · {mounted ? formatDistanceToNow(new Date(f.dueAt), { addSuffix: true }) : "-"}</div>
              </div>
              <div className="col-span-2 flex justify-end gap-1.5">
                <Button size="sm" variant="outline" className="h-8" onClick={() => onOpen(lead!.id)}>Open</Button>
                <Button size="sm" className="h-8" onClick={() => onDone(f.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
