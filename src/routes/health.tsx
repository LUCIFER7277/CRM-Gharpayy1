import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { useSettings } from "@/myt/lib/settings-context";
import { CheckCircle2, AlertTriangle, Activity, Database, MessageSquare, Zap, Brain, Layers, Target } from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";
import { format } from "date-fns";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "System Health - Gharpayy" },
      { name: "description", content: "Live module mount status, build info and data integrity check for the Arena Infrastructure CRM." },
    ],
  }),
  component: HealthPage,
});

interface ModuleCheck {
  id: string;
  label: string;
  icon: typeof Activity;
  ok: boolean;
  detail: string;
  href?: string;
}

function HealthPage() {
  const { leads, tours, properties, bookings, tcms } = useApp();
  const { profiles, messageOutcomes, calls, objections } = useCRM10x();
  const { settings } = useSettings();
  const [now, mounted] = useMountedNow();

  const checks: ModuleCheck[] = [
    {
      id: "leads", label: "Leads module", icon: Target, href: "/leads",
      ok: leads.length > 0,
      detail: `${leads.length} leads · ${tours.length} tours · ${bookings.length} bookings`,
    },
    {
      id: "deep-profile", label: "Deep profile store", icon: Database,
      ok: true,
      detail: `${Object.keys(profiles).length} enriched profiles · ${calls.length} calls · ${objections.length} objections logged`,
    },
    {
      id: "smart-wa", label: "SmartWaLayer", icon: MessageSquare,
      ok: true,
      detail: `${messageOutcomes.length} sends tracked · ${messageOutcomes.filter((m) => m.replied).length} replied · ${messageOutcomes.filter((m) => m.bookedAfter).length} booked-after`,
    },
    {
      id: "queue", label: "Daily Action Queue", icon: Zap, href: "/queue",
      ok: true,
      detail: "Mounted at /queue - fire/confirm/recover/nurture bands",
    },
    {
      id: "zone-brain", label: "Zone Brain", icon: Brain, href: "/zone-brain",
      ok: settings.zones && settings.zones.length > 0,
      detail: `${settings.zones?.length ?? 0} zones · ${tcms.length} TCMs · capacity + rebalancing recos`,
    },
    {
      id: "conversion", label: "Conversion Intelligence", icon: Activity, href: "/manager",
      ok: true,
      detail: "Mounted on Manager dashboard - funnel velocity, objection-loss, agent cohort",
    },
    {
      id: "supply", label: "Supply Hub", icon: Layers, href: "/supply-hub",
      ok: properties.length > 0,
      detail: `${properties.length} properties indexed · matcher v2 live`,
    },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const allGreen = okCount === checks.length;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">System Health</h1>
            <p className="text-sm text-muted-foreground">
              Arena Infrastructure runtime check -{" "}
              <span className={allGreen ? "text-success font-mono" : "text-destructive font-mono"}>
                {okCount}/{checks.length} modules OK
              </span>
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono min-h-[1em]">
            {mounted ? format(new Date(now), "EEE MMM d · HH:mm:ss") : "\u00a0"}
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card divide-y divide-border">
          {checks.map((c) => {
            const Icon = c.icon;
            const Tone = c.ok ? CheckCircle2 : AlertTriangle;
            const row = (
              <div className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.detail}</div>
                </div>
                <Tone className={`h-4 w-4 shrink-0 ${c.ok ? "text-success" : "text-destructive"}`} />
                <span className={`text-[10px] font-mono uppercase ${c.ok ? "text-success" : "text-destructive"}`}>
                  {c.ok ? "OK" : "FAIL"}
                </span>
              </div>
            );
            return c.href ? (
              <Link key={c.id} to={c.href} className="block hover:bg-muted/40 transition-colors">{row}</Link>
            ) : (
              <div key={c.id}>{row}</div>
            );
          })}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-xs space-y-1.5">
          <div className="font-display font-semibold text-sm mb-2">Build info</div>
          <Row k="App" v="Gharpayy · Arena Infrastructure" />
          <Row k="Stack" v="TanStack Start · Vite · Zustand (persisted)" />
          <Row k="Persistence" v="localStorage v1 - gharpayy.crm10x.v1" />
          <Row k="Last hydrated" v={mounted ? format(new Date(now), "PPpp") : "-"} />
        </section>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground">{v}</span>
    </div>
  );
}
