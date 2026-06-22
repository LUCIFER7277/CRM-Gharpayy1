import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { format, isPast, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";

export const Route = createFileRoute("/tours")({
  head: () => ({
    meta: [{ title: "Tours - Gharpayy" }, { name: "description", content: "Live tour pipeline with post-tour enforcement on every completed visit." }],
  }),
  component: ToursPage,
});

function ToursPage() {
  const { tours, leads, properties, tcms, selectLead } = useApp();
  const [now, mounted] = useMountedNow();

  const sorted = [...tours].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));

  const upcoming = sorted.filter((t) => t.status === "scheduled");
  const completed = sorted.filter((t) => t.status === "completed");
  const incomplete = completed.filter((t) => !t.postTour.filledAt);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Tours</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} upcoming · {completed.length} completed · <span className="text-destructive font-medium">{incomplete.length} pending post-tour</span>
          </p>
        </header>

        {incomplete.length > 0 && (
          <Section title="Post-tour enforcement" tone="destructive" icon={AlertTriangle}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {incomplete.map((t) => {
                const lead = leads.find((l) => l.id === t.leadId);
                const prop = properties.find((p) => p.id === t.propertyId);
                const tcm = tcms.find((x) => x.id === t.tcmId);
                if (!lead) return null;
                const hours = mounted ? Math.round((now - +new Date(t.scheduledAt)) / 36e5) : null;
                return (
                  <button
                    key={t.id} onClick={() => selectLead(lead.id)}
                    className="text-left rounded-lg border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{lead.name}</span>
                      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                        {hours === null ? "Overdue" : `${hours}h overdue`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{prop?.name} · {tcm?.name}</div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Upcoming tours" icon={Clock}>
          <TourList tours={upcoming} />
        </Section>

        <Section title="Completed" icon={CheckCircle2}>
          <TourList tours={completed} />
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title, icon: Icon, tone = "default", children,
}: {
  title: string; icon: typeof Clock; tone?: "default" | "destructive"; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
        <h2 className="font-display text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TourList({ tours }: { tours: import("@/lib/types").Tour[] }) {
  const { leads, properties, tcms, selectLead } = useApp();
  if (tours.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No tours.</div>;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {tours.map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const prop = properties.find((p) => p.id === t.propertyId);
        const tcm = tcms.find((x) => x.id === t.tcmId);
        if (!lead) return null;
        const when = new Date(t.scheduledAt);
        const overdue = t.status === "scheduled" && isPast(when) && !isToday(when);
        return (
          <button
            key={t.id} onClick={() => selectLead(lead.id)}
            className="w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors"
          >
            <div className="col-span-3">
              <div className="font-medium text-sm">{lead.name}</div>
              <div className="text-[11px] text-muted-foreground">{lead.phone}</div>
            </div>
            <div className="col-span-3 text-xs">{prop?.name}</div>
            <div className="col-span-2 text-xs">{tcm?.name}</div>
            <div className="col-span-2 text-xs font-mono">{format(when, "MMM d, p")}</div>
            <div className="col-span-2 flex items-center gap-1.5 justify-end">
              <Badge variant="outline" className="capitalize text-[10px]">{t.status}</Badge>
              {t.decision && <Badge variant="outline" className="capitalize text-[10px]">{t.decision}</Badge>}
              {overdue && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Late</Badge>}
              {t.status === "completed" && !t.postTour.filledAt && (
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Form</Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
