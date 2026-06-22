import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { funnelMetrics, topObjections, avgStageVelocity } from "@/lib/crm10x/intelligence";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertTriangle, ArrowRight, Phone, Trophy, Users, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ConversionIntelligence } from "./ConversionIntelligence";

const OBJECTION_LABELS: Record<string, string> = {
  "price-too-high": "Price too high",
  "location-not-suitable": "Location",
  "room-too-small": "Room size",
  "not-ready-yet": "Not ready",
  "comparing-other-pgs": "Comparing PGs",
  "needs-family-approval": "Family approval",
  "food-not-available": "Food",
  "no-ac": "No AC",
  "safety-concern": "Safety",
  "no-response-to-offer": "Silent",
};

export function ManagerDashboard() {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const tours = useApp((s) => s.tours);
  const activities = useApp((s) => s.activities);
  const calls = useCRM10x((s) => s.calls);
  const objections = useCRM10x((s) => s.objections);
  const commitments = useCRM10x((s) => s.commitments);
  const coachingNotes = useCRM10x((s) => s.coachingNotes);

  // ------- Today's pulse
  const today = new Date(); today.setHours(0,0,0,0);
  const callsToday = calls.filter((c) => new Date(c.ts) >= today);
  const visitsToday = tours.filter((t) => {
    const d = new Date(t.scheduledAt); d.setHours(0,0,0,0);
    return +d === +today;
  });
  const bookedThisWeek = leads.filter((l) => l.stage === "booked" &&
    Date.now() - new Date(l.updatedAt).getTime() < 7 * 86400_000).length;
  const newToday = leads.filter((l) => new Date(l.createdAt) >= today).length;
  const neverCalled = leads.filter((l) =>
    new Date(l.createdAt) >= today && !calls.some((c) => c.leadId === l.id)).length;

  // ------- Funnel
  const funnel = funnelMetrics(leads);

  // ------- Agent table
  const agentRows = useMemo(() => tcms.map((t) => {
    const myLeads = leads.filter((l) => l.assignedTcmId === t.id);
    const myCalls = calls.filter((c) => myLeads.some((l) => l.id === c.leadId));
    const myVisits = tours.filter((tour) => tour.tcmId === t.id);
    const booked = myLeads.filter((l) => l.stage === "booked");
    const conv = myLeads.length === 0 ? 0 : Math.round((booked.length / myLeads.length) * 100);
    const touchesPerLead = myLeads.length === 0 ? 0
      : (myCalls.length / myLeads.length).toFixed(1);
    const myBookedDays = booked.length === 0 ? 0 : Math.round(booked.reduce((acc, l) => {
      return acc + (new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime()) / 86400_000;
    }, 0) / booked.length);
    return {
      id: t.id, name: t.name, zone: t.zone,
      leads: myLeads.length, touches: touchesPerLead,
      visits: myVisits.length, booked: booked.length, conv, days: myBookedDays,
    };
  }).sort((a, b) => b.conv - a.conv), [tcms, leads, calls, tours]);

  // ------- Red flags
  const redFlags = useMemo(() => {
    const flags: { kind: string; lead: typeof leads[0]; detail: string; severity: "high" | "medium" }[] = [];
    leads.forEach((l) => {
      const lastActivity = activities.filter((a) => a.leadId === l.id).sort((a, b) => +new Date(b.ts) - +new Date(a.ts))[0];
      const daysIdle = lastActivity
        ? (Date.now() - new Date(lastActivity.ts).getTime()) / 86400_000
        : (Date.now() - new Date(l.createdAt).getTime()) / 86400_000;
      if (daysIdle >= 7 && l.stage !== "booked" && l.stage !== "dropped") {
        flags.push({ kind: "untouched-7d", lead: l, detail: `${Math.round(daysIdle)}d idle`, severity: "high" });
      }
      const lastVisit = tours.filter((t) => t.leadId === l.id && t.status === "completed")
        .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0];
      if (lastVisit) {
        const hours = (Date.now() - new Date(lastVisit.scheduledAt).getTime()) / 3600_000;
        const hasFollowup = activities.some((a) => a.leadId === l.id && +new Date(a.ts) > +new Date(lastVisit.scheduledAt) + 3600_000);
        if (hours >= 48 && !hasFollowup && l.stage !== "booked") {
          flags.push({ kind: "post-visit-silent", lead: l, detail: `${Math.round(hours)}h since visit`, severity: "high" });
        }
      }
      const moveIn = new Date(l.moveInDate);
      if (moveIn.getTime() < Date.now() && l.stage !== "booked" && l.stage !== "dropped") {
        flags.push({ kind: "move-in-passed", lead: l, detail: `move-in ${format(moveIn, "MMM d")}`, severity: "high" });
      }
    });
    return flags.slice(0, 12);
  }, [leads, activities, tours]);

  const objBreakdown = topObjections(objections);
  const velocity = avgStageVelocity(leads);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold">Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">Numbers only. No lead cards. {format(new Date(), "EEEE, MMM d")}</p>
      </div>

      {/* Today's pulse */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={Phone} label="Calls today" value={callsToday.length} />
        <Stat icon={Activity} label="Visits today" value={visitsToday.length} />
        <Stat icon={Trophy} label="Booked this week" value={bookedThisWeek} accent="success" />
        <Stat icon={Users} label="New today" value={newToday} />
        <Stat icon={AlertTriangle} label="Never called" value={neverCalled} accent={neverCalled > 0 ? "danger" : undefined} />
      </div>

      {/* Conversion Intelligence Engine */}
      <ConversionIntelligence />

      {/* Funnel */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Funnel · where leads drop</h2>
          <span className="text-xs text-muted-foreground">avg booking velocity {velocity}d</span>
        </div>
        <div className="space-y-1.5">
          {funnel.map((row, i) => {
            const next = funnel[i + 1];
            if (!next) return null;
            const isLow = row.conversionToNext < 35;
            const isCrit = row.conversionToNext < 20;
            return (
              <div key={row.stage} className="flex items-center gap-2 text-sm">
                <span className="w-32 capitalize">{row.stage.replace("-", " ")}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="w-32 capitalize text-muted-foreground">{next.stage.replace("-", " ")}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isCrit ? "bg-destructive" : isLow ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${row.conversionToNext}%` }}
                  />
                </div>
                <span className={`w-16 text-right text-xs font-mono ${isCrit ? "text-destructive font-bold" : isLow ? "text-warning" : "text-success"}`}>
                  {row.conversionToNext}%
                </span>
                {isCrit && <Badge variant="destructive" className="text-[10px]">CRITICAL</Badge>}
                {!isCrit && isLow && <Badge variant="outline" className="text-[10px] border-warning text-warning">LOW</Badge>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Agent comparison */}
      <Card className="p-4 space-y-3">
        <h2 className="font-display text-lg font-semibold">Agent comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">Agent</th>
                <th className="text-left">Zone</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Touches/lead</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Booked</th>
                <th className="text-right">Conv %</th>
                <th className="text-right">Avg days</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{r.name}</td>
                  <td className="text-muted-foreground">{r.zone}</td>
                  <td className="text-right">{r.leads}</td>
                  <td className="text-right">{r.touches}</td>
                  <td className="text-right">{r.visits}</td>
                  <td className="text-right">{r.booked}</td>
                  <td className={`text-right font-semibold ${r.conv >= 25 ? "text-success" : r.conv >= 15 ? "text-warning" : "text-destructive"}`}>
                    {r.conv}%
                  </td>
                  <td className="text-right text-muted-foreground">{r.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Red flags */}
        <Card className="p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Red flags · act now
          </h2>
          {redFlags.length === 0 && <p className="text-xs text-muted-foreground">All clear.</p>}
          {redFlags.map((f, i) => {
            const tcm = tcms.find((t) => t.id === f.lead.assignedTcmId);
            return (
              <div key={i} className="flex items-center justify-between text-xs border-b border-border/50 py-1.5">
                <div>
                  <div className="font-medium">{f.lead.name}</div>
                  <div className="text-muted-foreground text-[10px]">{tcm?.name ?? "-"} · {f.detail}</div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{f.kind.replace(/-/g, " ")}</Badge>
              </div>
            );
          })}
        </Card>

        {/* Objection breakdown */}
        <Card className="p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" /> Top blockers this period
          </h2>
          {objBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No objections logged yet. Start capturing on every "Answered" call.</p>}
          {objBreakdown.map((o) => (
            <div key={o.code} className="flex items-center gap-2 text-sm">
              <span className="w-32">{OBJECTION_LABELS[o.code] ?? o.code}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-destructive" style={{ width: `${o.pct}%` }} />
              </div>
              <span className="w-12 text-right text-xs font-mono">{o.pct}%</span>
              <span className="w-8 text-right text-[10px] text-muted-foreground">{o.count}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Commitments */}
      {commitments.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold">Lead commitments tracker</h2>
          {commitments.slice(0, 8).map((c) => {
            const lead = leads.find((l) => l.id === c.leadId);
            const overdue = new Date(c.decisionBy).getTime() < Date.now() && c.status === "pending";
            return (
              <div key={c.id} className={`flex items-center justify-between text-xs border-b border-border/50 py-1.5 ${overdue ? "text-destructive" : ""}`}>
                <div>
                  <div className="font-medium">{lead?.name ?? "-"}</div>
                  <div className="text-muted-foreground italic">"{c.exactWords}"</div>
                </div>
                <div className="text-right">
                  <div>{format(new Date(c.decisionBy), "MMM d")}</div>
                  <div className="text-[10px] capitalize">{c.status}{overdue && " · OVERDUE"}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Coaching notes */}
      {coachingNotes.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold">Coaching notes (private)</h2>
          {coachingNotes.slice(0, 5).map((n) => {
            const lead = leads.find((l) => l.id === n.leadId);
            return (
              <div key={n.id} className="text-xs border-l-2 border-accent pl-2 py-1">
                <div className="font-medium">{lead?.name ?? "-"}</div>
                <div className="text-muted-foreground">{n.text}</div>
                <div className="text-[10px] text-muted-foreground">{format(new Date(n.ts), "MMM d, p")}</div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon: Icon, label, value, accent,
}: {
  icon: typeof Phone;
  label: string;
  value: number | string;
  accent?: "success" | "danger";
}) {
  const tone =
    accent === "success" ? "text-success border-success/30 bg-success/5"
    : accent === "danger" ? "text-destructive border-destructive/30 bg-destructive/5"
    : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}
