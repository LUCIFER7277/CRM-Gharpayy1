import { useState } from 'react';
import { useNavigate } from '@/shims/react-router-dom';
import { useAppState } from '@/myt/lib/app-context';
import { MetricCard } from '@/myt/components/MetricCard';
import { CalendarCheck, Phone, TrendingUp, FileText, Target, CalendarPlus, Sparkles } from 'lucide-react';
import { CycleData } from '@/myt/lib/types';
import { cn, formatTime12h } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LeadControlPanel } from '@/myt/components/LeadControlPanel';
import { GlueFeed } from '@/components/GlueFeed';
import { CoachInline } from '@/components/CoachInline';
import { buildAreaOperatingRows, bestInventoryFits, detectAreaZone, recommendedTcm } from '@/myt/lib/inventory-intelligence';
import { zones, teamMembers } from '@/myt/lib/mock-data';

const CYCLE_TARGETS = { chatsClosed: 30, mytLeads: 10, toursScheduled: 4, sameDayConfirmed: 2 };

export default function FlowOpsDashboard() {
  const { tours, leads, rooms, blocks, bookings, currentMemberId } = useAppState();
  const navigate = useNavigate();
  const myMember = currentMemberId ? teamMembers.find((m) => m.id === currentMemberId) : null;
  const myZone = zones.find((z) => z.id === myMember?.zoneId) ?? zones[0];
  const operatingRows = buildAreaOperatingRows({ leads, tours, rooms, blocks, bookings });
  const ownedRow = operatingRows.find((r) => r.zoneId === myZone?.id) ?? operatingRows[0];
  const areaLeads = leads.filter((l) => detectAreaZone(l.area).id === ownedRow.zoneId).slice(0, 5);
  const myTours = currentMemberId
    ? tours.filter(t => t.scheduledBy === currentMemberId)
    : tours.filter(t => t.scheduledBy === 'm1');
  const completed = myTours.filter(t => t.status === 'completed').length;
  const showUps = myTours.filter(t => t.showUp === true).length;
  const drafts = myTours.filter(t => t.outcome === 'draft').length;
  const pending = myTours.filter(t => t.status === 'scheduled').length;

  const [cycles, setCycles] = useState<CycleData[]>([
    { cycleNumber: 1, chatsClosed: 0, mytLeads: 0, toursScheduled: 0, sameDayConfirmed: 0 },
    { cycleNumber: 2, chatsClosed: 0, mytLeads: 0, toursScheduled: 0, sameDayConfirmed: 0 },
    { cycleNumber: 3, chatsClosed: 0, mytLeads: 0, toursScheduled: 0, sameDayConfirmed: 0 },
    { cycleNumber: 4, chatsClosed: 0, mytLeads: 0, toursScheduled: 0, sameDayConfirmed: 0 },
  ]);
  const [activeCycle, setActiveCycle] = useState(0);

  const updateCycle = (field: keyof CycleData, delta: number) => {
    setCycles(prev => prev.map((c, i) =>
      i === activeCycle ? { ...c, [field]: Math.max(0, (c[field] as number) + delta) } : c
    ));
  };

  const dailyTotals = cycles.reduce((acc, c) => ({
    chatsClosed: acc.chatsClosed + c.chatsClosed,
    mytLeads: acc.mytLeads + c.mytLeads,
    toursScheduled: acc.toursScheduled + c.toursScheduled,
    sameDayConfirmed: acc.sameDayConfirmed + c.sameDayConfirmed,
  }), { chatsClosed: 0, mytLeads: 0, toursScheduled: 0, sameDayConfirmed: 0 });

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <CoachInline page="flow-ops" />
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Flow Ops Dashboard</h1>
          <p className="text-xs text-muted-foreground">Your scheduling performance · click any tour to open the command panel</p>
        </div>
        <Button size="sm" onClick={() => navigate('/myt/schedule')} className="gap-1.5">
          <CalendarPlus className="h-4 w-4" /> Schedule Tour
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricCard label="My Tours" value={myTours.length} color="blue" icon={<CalendarCheck className="h-4 w-4" />} />
        <MetricCard label="Pending" value={pending} color="amber" icon={<Phone className="h-4 w-4" />} />
        <MetricCard label="Show-Ups" value={showUps} color="green" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Drafts" value={drafts} color="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="glass-card p-3 md:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground">My Area Goal · {ownedRow.area}</h3>
            <p className="text-xs text-muted-foreground">{ownedRow.nextAction}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">{ownedRow.availableBeds} beds · {ownedRow.toursToday} Tours today</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {areaLeads.map((lead) => {
            const fit = bestInventoryFits({ areaText: lead.area, budget: lead.budget, rooms, blocks, limit: 1 })[0];
            const tcm = fit ? recommendedTcm(tours, fit.zoneId) : null;
            return (
              <div key={lead.id} className="rounded-lg border border-border bg-surface-2/40 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{lead.name} · ₹{lead.budget.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{fit?.propertyName ?? 'No live fit'} · TCM {tcm?.name ?? 'Auto'}</div>
                </div>
                <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => navigate('/myt/schedule', { state: { lead, inventoryFit: fit } })}>Schedule Tour</Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cycle Tracker */}
      <div className="glass-card p-3 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-semibold text-xs md:text-sm text-foreground">90-Min Cycle Tracker</h3>
        </div>

        {/* Cycle tabs */}
        <div className="flex gap-1 mb-4">
          {cycles.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveCycle(i)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeCycle === i ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'
              )}
            >
              G{i + 1}
            </button>
          ))}
        </div>

        {/* Current cycle counters */}
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: 'chatsClosed' as const, label: 'Chats Closed', target: CYCLE_TARGETS.chatsClosed },
            { key: 'mytLeads' as const, label: 'MYT Leads', target: CYCLE_TARGETS.mytLeads },
            { key: 'toursScheduled' as const, label: 'Tours Scheduled', target: CYCLE_TARGETS.toursScheduled },
            { key: 'sameDayConfirmed' as const, label: 'Same-Day', target: CYCLE_TARGETS.sameDayConfirmed },
          ]).map(item => {
            const val = cycles[activeCycle][item.key] as number;
            const pct = Math.min(100, Math.round((val / item.target) * 100));
            return (
              <div key={item.key} className="bg-surface-2/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground">{val}/{item.target}</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => updateCycle(item.key, -1)} className="h-7 w-7 p-0 text-xs">−</Button>
                  <span className="text-lg font-heading font-bold text-foreground w-8 text-center">{val}</span>
                  <Button size="sm" variant="ghost" onClick={() => updateCycle(item.key, 1)} className="h-7 w-7 p-0 text-xs">+</Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily totals */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-1">Daily Totals (All 4 Cycles)</p>
          <div className="flex gap-3 text-xs">
            <span className="text-foreground"><strong>{dailyTotals.chatsClosed}</strong>/120 chats</span>
            <span className="text-foreground"><strong>{dailyTotals.mytLeads}</strong>/40 MYT</span>
            <span className="text-foreground"><strong>{dailyTotals.toursScheduled}</strong>/16 tours</span>
            <span className="text-foreground"><strong>{dailyTotals.sameDayConfirmed}</strong>/8 same-day</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Tours I Scheduled</h3>
        <div className="space-y-2">
          {myTours.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No tours yet - hit "Schedule Tour" above to add one.</p>
          )}
          {myTours.map(t => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-surface-2/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">{t.leadName}</span>
                  <span className="text-muted-foreground text-xs">{t.propertyName}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t.area} · {t.tourDate} {formatTime12h(t.tourTime)} · TCM {t.assignedToName}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-success/15 text-success' : t.status === 'confirmed' ? 'bg-tcm/15 text-role-tcm' : 'bg-primary/15 text-primary'}`}>
                  {t.status}
                </span>
                <LeadControlPanel
                  subject={{ kind: 'tour', tour: t }}
                  trigger={
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                      <Sparkles className="h-3 w-3" /> Open
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <GlueFeed limit={20} title="Closed-loop activity · Flow Ops" />
    </div>
  );
}
