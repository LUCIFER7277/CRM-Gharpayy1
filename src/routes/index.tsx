import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp, computePropertyMetrics } from "@/lib/store";
import { KpiCard } from "@/components/atoms";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarPlus, Flame, Building2, Zap, Sun, TrendingUp, Sparkles, IndianRupee, Activity, CheckCircle2, LineChart } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { useMountedNow } from "@/hooks/use-now";
import { buildDoNextQueue, liveConfidence, intentFor } from "@/lib/engine";
import { scanRevivals } from "@/lib/revival";
import { QuickActionRow } from "@/components/QuickActionRow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard - Gharpayy" },
      { name: "description", content: "Live command center: leads, tours, follow-ups, deal probability and inventory pressure." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { leads, tours, followUps, properties, role, currentTcmId, selectLead, bookings, handoffs, activities } = useApp();
  const [now, mounted] = useMountedNow();

  const filterTcm = role === "tcm" ? currentTcmId : undefined;
  const metrics = useMemo(() => computePropertyMetrics(properties, leads, tours), [properties, leads, tours]);
  const queue = useMemo(
    () => buildDoNextQueue(leads, tours, followUps, now, filterTcm),
    [leads, tours, followUps, now, filterTcm],
  );
  const revivals = useMemo(
    () => scanRevivals(leads, properties, tours, now),
    [leads, properties, tours, now],
  );
  
  const hasRevivals = revivals.length > 0;
  const row3ColSpan = hasRevivals ? "lg:col-span-4" : "lg:col-span-6";

  // Live, decayed view of every lead
  const liveLeads = useMemo(
    () => leads.map((l) => ({ ...l, confidence: liveConfidence(l, tours, now), intent: intentFor(liveConfidence(l, tours, now)) })),
    [leads, tours, now],
  );
  
  const hotItems = useMemo(() => {
    const seen = new Set<string>();
    return queue
      .filter((a) => {
        const lead = leads.find((l) => l.id === a.leadId);
        if (!lead || lead.stage === "booked" || lead.stage === "dropped") return false;
        const conf = liveConfidence(lead, tours, now);
        return intentFor(conf) === "hot";
      })
      .filter((a) => {
        if (seen.has(a.leadId)) return false;
        seen.add(a.leadId);
        return true;
      });
  }, [queue, leads, tours, now]);
  const incompleteTours = tours.filter((t) => t.status === "completed" && !t.postTour.filledAt);
  const todayTours = tours.filter((t) => t.status === "scheduled" && sameDay(+new Date(t.scheduledAt), now));
  const booked = tours.filter((t) => t.decision === "booked").length;
  const conversion = tours.length ? Math.round((booked / tours.length) * 100) : 0;
  const overdueFu = followUps.filter((f) => !f.done && +new Date(f.dueAt) < now).length;
  const monthlyRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const unreadHandoffs = handoffs.filter((h) => !h.read && h.to === role).length;

  const chartData = useMemo(() => {
    const data = [];
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    for (let i = 14; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = +d;
      const dayEnd = dayStart + 24 * 3600_000;
      
      const dayLeads = leads.filter(l => +new Date(l.createdAt) >= dayStart && +new Date(l.createdAt) < dayEnd).length;
      const dayTours = tours.filter(t => +new Date(t.createdAt) >= dayStart && +new Date(t.createdAt) < dayEnd).length;
      
      data.push({
        name: format(d, "MMM d"),
        Leads: dayLeads,
        Tours: dayTours,
      });
    }
    return data;
  }, [leads, tours, now]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Arena Infrastructure</h1>
            <p className="text-sm text-muted-foreground">
              Every lead, every tour, every follow-up - one operating layer. <span className="text-accent font-mono">live</span>
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono min-h-[1em]">
            {mounted ? format(new Date(now), "EEEE, MMM d · h:mm a") : "\u00a0"}
          </div>
        </header>

        {unreadHandoffs > 0 && (
          <Link to="/handoffs" className="block rounded-xl border border-info/30 bg-info/5 p-3 hover:bg-info/10 transition-colors">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-info" />
              <div className="flex-1 text-sm">
                <span className="font-semibold">{unreadHandoffs} unread handoff{unreadHandoffs > 1 ? "s" : ""}</span>
                <span className="text-muted-foreground"> from {role === "tcm" ? "Flow Ops" : "TCM team"}</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-info" />
            </div>
          </Link>
        )}

        {/* Post-tour enforcement banner */}
        {incompleteTours.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <div className="font-semibold text-destructive text-sm">
                {incompleteTours.length} post-tour update{incompleteTours.length > 1 ? "s" : ""} missing
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Auto-escalation triggers at 6h. Click any name to fill the form now.
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {incompleteTours.map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId);
                  if (!lead) return null;
                  const hrs = Math.round((now - +new Date(t.scheduledAt)) / 36e5);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectLead(lead.id)}
                      className="text-[11px] rounded-md border border-destructive/30 bg-card px-2 py-0.5 hover:bg-destructive/10 transition-colors inline-flex items-center gap-1"
                    >
                      {lead.name} <span className="font-mono text-destructive min-w-[2ch] inline-block text-right">{mounted ? `${hrs}h` : '…'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bento Dashboard Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          
          {/* Main KPIs (Col Span 12) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-12 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard label="Active leads" value={liveLeads.filter((l) => l.stage !== "booked" && l.stage !== "dropped").length} sub={`${hotItems.length} hot · live score`} />
            <KpiCard label="Today's tours" value={todayTours.length} sub="Scheduled" tone="accent" />
            <KpiCard label="Overdue follow-ups" value={overdueFu} sub={`${incompleteTours.length} post-tour pending`} tone={overdueFu || incompleteTours.length ? "destructive" : "default"} />
            <KpiCard label="Conversion rate" value={`${conversion}%`} sub={`${booked} booked total`} tone="success" />
            <KpiCard label="MRR closed" value={`₹${(monthlyRevenue / 1000).toFixed(0)}k`} sub={`${bookings.length} booking${bookings.length === 1 ? "" : "s"}`} tone="success" />
          </div>

          {/* Activity Graph - col span 8 */}
          <div className="col-span-1 md:col-span-2 lg:col-span-8 h-[350px] flex flex-col">
            <Card title="Volume Statistics" icon={LineChart}>
              <div className="h-full w-full min-h-[250px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="Leads" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
                    <Area type="monotone" dataKey="Tours" stroke="hsl(var(--accent))" strokeWidth={2} fillOpacity={1} fill="url(#colorTours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Do this next - col span 4 */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4 h-full flex flex-col">
            <section className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
              <header className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-semibold">Do this next</h2>
                  <span className="text-[10px] text-muted-foreground font-mono">{queue.length} ranked</span>
                </div>
                <Link to="/today" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
                  <Sun className="h-3 w-3" /> Today view <ArrowUpRight className="h-3 w-3" />
                </Link>
              </header>
              <div className="flex-1 overflow-y-auto scrollbar-none min-h-[220px] max-h-[350px]">
                {queue.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Inbox zero. Nothing pending right now.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {queue.slice(0, 10).map((a) => {
                      const lead = leads.find((l) => l.id === a.leadId);
                      if (!lead) return null;
                      return (
                        <QuickActionRow
                          key={`${a.leadId}-${a.kind}`}
                          lead={lead}
                          reason={a.reason}
                          compact={true}
                          accent={a.kind === "post-tour-overdue" || a.kind === "first-response" || a.kind === "follow-up-overdue" ? "destructive" : a.kind === "no-follow-up" ? "warning" : "accent"}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Hot pipeline */}
          <div className={`col-span-1 ${row3ColSpan} self-start`}>
            <Card title="Hot pipeline" icon={Flame} accent action={<Link to="/leads" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">All leads <ArrowUpRight className="h-3 w-3" /></Link>}>
              <div className="flex flex-col h-full -mx-3 min-h-[200px] max-h-[350px] overflow-y-auto scrollbar-none">
                <div className="divide-y divide-border">
                  {hotItems.slice(0, 10).map((a) => {
                    const lead = leads.find((l) => l.id === a.leadId);
                    if (!lead) return null;
                    return (
                      <QuickActionRow key={a.leadId} lead={lead} reason={a.reason} accent="accent" compact={true} />
                    );
                  })}
                  {hotItems.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No hot leads right now.</div>}
                </div>
              </div>
            </Card>
          </div>

          {/* Today's tours */}
          <div className={`col-span-1 ${row3ColSpan} self-start`}>
            <Card title="Today's tours" icon={CalendarPlus} action={<Link to="/tours" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">All tours <ArrowUpRight className="h-3 w-3" /></Link>}>
              <div className="space-y-2 min-h-[200px] max-h-[350px] overflow-y-auto scrollbar-none">
                {todayTours.slice(0, 10).map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId);
                  const prop = properties.find((p) => p.id === t.propertyId);
                  if (!lead) return null;
                  const minsTo = (+new Date(t.scheduledAt) - now) / 60_000;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectLead(lead.id)}
                      className="w-full text-left rounded-lg border border-border bg-card hover:border-accent/40 transition-colors p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{lead.name}</span>
                        <span className={`text-xs font-mono ${mounted && minsTo < 60 && minsTo > 0 ? "text-accent" : "text-muted-foreground"}`}>
                          {mounted ? (minsTo > 0 ? `in ${formatMins(minsTo)}` : `${formatMins(-minsTo)} ago`) : "\u00a0"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{prop?.name} · {format(new Date(t.scheduledAt), "p")}</div>
                    </button>
                  );
                })}
                {todayTours.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No tours scheduled today.</div>}
              </div>
            </Card>
          </div>

          {/* Revival opportunities */}
          {hasRevivals && (
            <div className="col-span-1 md:col-span-2 lg:col-span-4 h-full flex flex-col">
              <section className="rounded-xl border border-info/30 bg-info/5 overflow-hidden h-full flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 border-b border-info/20">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-info" />
                    <h2 className="font-display text-sm font-semibold">Revival queue</h2>
                    <span className="text-[10px] text-muted-foreground font-mono">{revivals.length} candidate{revivals.length === 1 ? "" : "s"}</span>
                  </div>
                  <Link to="/revival" className="text-xs font-medium text-info hover:text-info/80 transition-colors inline-flex items-center gap-1">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </header>
                <div className="divide-y divide-info/10 flex-1 overflow-y-auto scrollbar-none min-h-[150px] max-h-[300px]">
                  {revivals.slice(0, 10).map((r) => {
                    const lead = leads.find((l) => l.id === r.leadId);
                    if (!lead) return null;
                    return (
                      <button
                        key={r.leadId}
                        onClick={() => selectLead(lead.id)}
                        className="w-full text-left px-4 py-3 hover:bg-info/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{lead.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{r.reason}</div>
                        </div>
                        <span className="text-[10px] font-mono text-info shrink-0">score {r.score}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* Inventory pressure - col span 12 */}
          <div className="col-span-1 md:col-span-2 lg:col-span-12 h-full flex flex-col">
            <Card title="Inventory pressure" icon={Building2} action={<Link to="/inventory" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">All properties <ArrowUpRight className="h-3 w-3" /></Link>}>
              <div className="divide-y divide-border -mx-3 min-h-[150px] max-h-[350px] overflow-y-auto scrollbar-none lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
                {metrics.slice(0, 10).map((m) => {
                  const demand = Number.isNaN(m.demandScore) ? "-" : m.demandScore;
                  const conv = Number.isNaN(m.conversionPct) ? 0 : m.conversionPct;
                  const pressure = Number.isNaN(m.pressureScore) ? 0 : m.pressureScore;
                  
                  let statusColor = "muted-foreground";
                  let StatusIcon = Building2;
                  if (m.signal === "high-demand-low-conv") { statusColor = "destructive"; StatusIcon = AlertTriangle; }
                  else if (m.signal === "low-demand-high-vacancy") { statusColor = "warning"; StatusIcon = Activity; }
                  else if (m.signal === "high-conv-low-supply") { statusColor = "success"; StatusIcon = CheckCircle2; }
                  else { statusColor = "primary"; StatusIcon = Building2; }
                  
                  return (
                    <div key={m.property.id} className={`group flex items-center justify-between gap-4 px-3 py-2.5 border-l-2 border-transparent hover:border-${statusColor} hover:bg-${statusColor}/5 transition-colors`}>
                      
                      {/* Name & Location (Left) */}
                      <div className="w-[180px] shrink-0 min-w-0 flex items-center gap-3">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-md shrink-0 bg-${statusColor}/10 text-${statusColor}`}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{m.property.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{m.property.area}</div>
                        </div>
                      </div>

                      {/* Signal Badge */}
                      <div className="w-[120px] shrink-0 hidden md:block">
                        <SignalChip signal={m.signal} />
                      </div>
                      
                      {/* Stats Inline */}
                      <div className="flex-1 hidden lg:flex items-center gap-6 justify-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Demand</span>
                          <span className="text-xs font-mono">{demand}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Conv %</span>
                          <span className="text-xs font-mono">{conv}%</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Vacant</span>
                          <span className="text-xs font-mono text-accent">{m.property.vacantBeds}/{m.property.totalBeds}</span>
                        </div>
                      </div>

                      {/* Pressure Bar (Right) */}
                      <div className="w-[100px] shrink-0 flex flex-col items-end gap-1">
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {pressure}/100
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${pressure}%` }} />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </AppShell>
  );
}

function Card({
  title, icon: Icon, action, accent, children,
}: {
  title: string; icon: typeof Flame; action?: React.ReactNode; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          <h2 className="font-display text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-3 flex-1 overflow-y-auto scrollbar-none">{children}</div>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function SignalChip({ signal }: { signal: ReturnType<typeof computePropertyMetrics>[number]["signal"] }) {
  const map = {
    "high-demand-low-conv": { label: "Pricing issue", cls: "bg-destructive/10 text-destructive border-destructive/30" },
    "low-demand-high-vacancy": { label: "Push marketing", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    "high-conv-low-supply": { label: "Expand", cls: "bg-success/10 text-success border-success/30" },
    "balanced": { label: "Balanced", cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const cfg = map[signal];
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function sameDay(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatMins(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(m < 600 ? 1 : 0)}h`;
}
