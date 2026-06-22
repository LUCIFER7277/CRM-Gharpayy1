import { useMemo } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { zones } from '@/myt/lib/mock-data';
import { TrendingUp, AlertTriangle, Target, Zap, Crosshair } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { GlueFeed } from '@/components/GlueFeed';
import { buildAreaOperatingRows } from '@/myt/lib/inventory-intelligence';

export default function WarRoom() {
  const { tours, leads, rooms, blocks, bookings } = useAppState();

  const data = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    // Today expected vs actual revenue
    const todayBookings = bookings.filter(b => b.createdAt.startsWith(today));
    const actualRevenue = todayBookings.reduce((s, b) => s + b.rentValue, 0);

    const activeBlocksValue = blocks
      .filter(b => b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now())
      .reduce((s, b) => {
        const room = rooms.find(r => r.id === b.roomId);
        return s + (room?.currentPrice ?? 12000) * (b.intent === 'hard' ? 0.7 : 0.3);
      }, 0);

    const todayPipelineTours = tours.filter(t => t.tourDate === today && t.status !== 'cancelled');
    const pipelineValue = todayPipelineTours.reduce((s, t) => {
      const weight = t.intent === 'hard' ? 0.5 : t.intent === 'medium' ? 0.25 : 0.08;
      return s + t.budget * weight;
    }, 0);
    const expectedRevenue = Math.round(actualRevenue + activeBlocksValue + pipelineValue);

    // 7-day forecast curve
    const forecast: { day: string; expected: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const dayTours = tours.filter(t => t.tourDate === dStr);
      const value = dayTours.reduce((s, t) => {
        const w = t.intent === 'hard' ? 0.5 : t.intent === 'medium' ? 0.25 : 0.08;
        return s + t.budget * w;
      }, 0);
      forecast.push({ day: d.toLocaleDateString('en', { weekday: 'short' }), expected: Math.round(value / 1000) });
    }

    // Conversion rate by zone
    const zoneConv = zones.map(z => {
      const zoneTours = tours.filter(t => t.zoneId === z.id && t.status === 'completed');
      const closed = zoneTours.filter(t => t.outcome === 'booked' || t.outcome === 'token-paid' || t.tokenPaid).length;
      const rate = zoneTours.length > 0 ? Math.round((closed / zoneTours.length) * 100) : 0;
      return { zone: z.area.split(' ')[0], rate };
    });

    // Top leak point: largest funnel drop in $ value
    const scheduledCount = tours.length;
    const showedCount = tours.filter(t => t.showUp === true).length;
    const completedCount = tours.filter(t => t.status === 'completed').length;
    const bookedCount = tours.filter(t => t.outcome === 'booked' || t.tokenPaid).length;

    const avgRent = tours.reduce((s, t) => s + t.budget, 0) / Math.max(1, tours.length);
    const noShowLoss = (scheduledCount - showedCount) * avgRent * 0.3;
    const showButNoCloseLoss = (showedCount - bookedCount) * avgRent * 0.5;
    const leakPoint = noShowLoss > showButNoCloseLoss
      ? { stage: 'Show-ups', value: noShowLoss, fix: 'Push pre-tour reminders 2h before slot' }
      : { stage: 'Show → Book', value: showButNoCloseLoss, fix: 'Reassign hard leads to top-converting TCMs' };

    // Immediate action lever
    const hardUnclaimed = leads.filter(l => !l.claimedBy && l.status === 'qualified').length;
    const action = hardUnclaimed > 0
      ? { text: `Reassign ${hardUnclaimed} hard leads from queue → top TCMs`, link: '/marketplace' }
      : leakPoint.stage === 'Show-ups'
        ? { text: 'Send urgency nudges to next 2h slots', link: '/tcm/actions' }
        : { text: 'Review hot properties for pricing changes', link: '/properties' };

    // Gap vs target (₹40L weekly target stub)
    const weeklyTarget = 4000000;
    const weekRevenue = bookings
      .filter(b => Date.now() - new Date(b.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000)
      .reduce((s, b) => s + b.rentValue, 0);
    const gap = Math.max(0, weeklyTarget - weekRevenue);

    const operatingRows = buildAreaOperatingRows({ leads, tours, rooms, blocks, bookings });
    return { expectedRevenue, actualRevenue, forecast, zoneConv, leakPoint, action, gap, weekRevenue, weeklyTarget, operatingRows };
  }, [tours, leads, rooms, blocks, bookings]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-2">
        <Crosshair className="h-5 w-5 text-role-hr" />
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Founder War Room</h1>
      </div>

      {/* Gap alert */}
      {data.gap > 0 && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">
              ₹{(data.gap/100000).toFixed(1)}L behind 7-day target
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Booked ₹{(data.weekRevenue/100000).toFixed(1)}L of ₹{(data.weeklyTarget/100000).toFixed(0)}L
          </span>
        </div>
      )}

      {/* 5 tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Tile 1 - Today expected vs actual */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Target className="h-3.5 w-3.5" /> Today: Expected vs Actual
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">₹{(data.expectedRevenue/1000).toFixed(0)}k</div>
              <div className="text-[10px] text-muted-foreground">Expected (pipeline + holds)</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-role-tcm tabular-nums">₹{(data.actualRevenue/1000).toFixed(0)}k</div>
              <div className="text-[10px] text-muted-foreground">Actual booked</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-role-tcm transition-all"
              style={{ width: `${Math.min(100, (data.actualRevenue / Math.max(1, data.expectedRevenue)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Tile 2 - 7-day forecast */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="h-3.5 w-3.5" /> Next 7-Day Revenue (₹k)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data.forecast}>
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="expected" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tile 3 - Conversion by zone */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Zap className="h-3.5 w-3.5" /> Conversion Rate by Zone
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.zoneConv}>
              <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={28} unit="%" />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {data.zoneConv.map((d, i) => (
                  <Cell key={i} fill={d.rate >= 60 ? 'hsl(var(--tcm))' : d.rate >= 35 ? 'hsl(var(--hr))' : 'hsl(var(--danger))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tile 4 - Top leak point */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" /> Top Leak Point
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">{data.leakPoint.stage}</div>
            <div className="text-2xl font-bold text-danger tabular-nums">−₹{(data.leakPoint.value/1000).toFixed(0)}k</div>
            <div className="text-[11px] text-muted-foreground mt-1">{data.leakPoint.fix}</div>
          </div>
        </div>
      </div>

      {/* Tile 5 - Immediate action */}
      <a
        href={data.action.link}
        className="block rounded-xl border-2 border-primary bg-primary/10 hover:bg-primary/15 transition-colors p-4"
      >
        <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">Immediate Action Lever</div>
        <div className="text-base md:text-lg font-bold text-foreground mt-1">{data.action.text} →</div>
      </a>
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Area operating table</div>
            <h2 className="font-heading text-base font-semibold text-foreground">Supply × Flow Ops × TCM command</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">Push only where inventory can convert.</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {data.operatingRows.map((row) => (
            <div key={row.zoneId} className="rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm text-foreground">{row.area}</div>
                <span className="text-[10px] rounded-full bg-primary/10 px-2 py-0.5 text-primary">{row.signal}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
                <Mini label="Leads" value={row.leads} />
                <Mini label="Beds" value={row.availableBeds} />
                <Mini label="Tours" value={row.toursToday} />
                <Mini label="TCM cap" value={row.tcmCapacity} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{row.nextAction}</div>
            </div>
          ))}
        </div>
      </div>
      <GlueFeed limit={25} title="Closed-loop activity · War Room" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div><div className="font-bold tabular-nums text-foreground">{value}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}
