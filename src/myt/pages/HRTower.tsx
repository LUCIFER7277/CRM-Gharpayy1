import { useState, useEffect } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { MetricCard } from '@/myt/components/MetricCard';
import { HourlyHeatmap } from '@/myt/components/HourlyHeatmap';
import { DateRangeToggle } from '@/myt/components/DateRangeToggle';
import { NotificationsPanel } from '@/myt/components/NotificationsPanel';
import { StatusBadge, OutcomeBadge } from '@/myt/components/StatusBadge';
import { getZonePerformance, filterToursByDateRange } from '@/myt/lib/mock-data';
import { DateRange } from '@/myt/lib/types';
import { CalendarCheck, Users, TrendingUp, FileText, AlertTriangle, Building } from 'lucide-react';
import { cn, formatTime12h } from '@/lib/utils';
import { GlueFeed } from '@/components/GlueFeed';
import { CoachInline } from '@/components/CoachInline';

export default function HRTower() {
  const { tours, globalZoneFilter } = useAppState();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  let filtered = filterToursByDateRange(tours, dateRange);
  if (globalZoneFilter) filtered = filtered.filter(t => t.zoneId === globalZoneFilter);

  const total = filtered.length;
  const completed = filtered.filter(t => t.status === 'completed').length;
  const showUps = filtered.filter(t => t.showUp === true).length;
  const showUpRate = total > 0 ? Math.round((showUps / total) * 100) : 0;
  const noShows = filtered.filter(t => t.showUp === false).length;
  const drafts = filtered.filter(t => t.outcome === 'draft').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const sameDayTours = filtered.filter(t => t.tourDate === todayStr).length;
  const sameDayRate = total > 0 ? Math.round((sameDayTours / total) * 100) : 0;
  const draftRate = completed > 0 ? Math.round((drafts / completed) * 100) : 0;

  const zonePerf = getZonePerformance(filtered);

  const propertyMap = new Map<string, { tours: number; showUps: number; drafts: number }>();
  filtered.forEach(t => {
    const p = propertyMap.get(t.propertyName) || { tours: 0, showUps: 0, drafts: 0 };
    p.tours++;
    if (t.showUp) p.showUps++;
    if (t.outcome === 'draft') p.drafts++;
    propertyMap.set(t.propertyName, p);
  });
  const propertyPerf = Array.from(propertyMap.entries())
    .map(([name, d]) => ({ name, ...d, conversion: d.tours > 0 ? Math.round((d.drafts / d.tours) * 100) : 0 }))
    .sort((a, b) => b.drafts - a.drafts);

  const noUpdates = filtered.filter(t => t.status === 'completed' && !t.outcome);
  const highNoShow = noShows > total * 0.3;

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <CoachInline page="hr" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">HR Control Tower</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Real-time performance tracking</p>
        </div>
        <DateRangeToggle value={dateRange} onChange={setDateRange} />
      </div>

      {/* Notifications */}
      <NotificationsPanel />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        <MetricCard label="Scheduled" value={total} color="blue" icon={<CalendarCheck className="h-4 w-4" />} />
        <MetricCard label="Completed" value={completed} color="green" icon={<Users className="h-4 w-4" />} />
        <MetricCard label="Show-Up %" value={`${showUpRate}%`} color={showUpRate >= 70 ? 'green' : 'red'} icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Same-Day %" value={`${sameDayRate}%`} color="amber" />
        <MetricCard label="Draft %" value={`${draftRate}%`} color="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      {(noUpdates.length > 0 || highNoShow) && (
        <div className="glass-card p-3 md:p-4 border-danger/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <h3 className="font-heading font-semibold text-xs md:text-sm text-danger">Red Flags</h3>
          </div>
          <div className="space-y-1 text-xs md:text-sm text-muted-foreground">
            {noUpdates.length > 0 && <p><span className="text-danger font-medium">{noUpdates.length}</span> tours with no outcome update</p>}
            {highNoShow && <p><span className="text-danger font-medium">{noShows}</span> no-shows ({Math.round((noShows / total) * 100)}%)</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <HourlyHeatmap />
        <div className="glass-card p-3 md:p-5">
          <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Zone Performance</h3>
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
            <table className="w-full text-xs md:text-sm min-w-[340px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Zone</th>
                  <th className="text-center py-2 font-medium">Tours</th>
                  <th className="text-center py-2 font-medium">Done</th>
                  <th className="text-center py-2 font-medium">Show%</th>
                  <th className="text-center py-2 font-medium">Drafts</th>
                </tr>
              </thead>
              <tbody>
                {zonePerf.map(z => (
                  <tr key={z.zoneId} className="border-b border-border/50">
                    <td className="py-2 font-medium text-foreground">{z.zoneName.split(' - ')[1]}</td>
                    <td className="text-center text-muted-foreground">{z.toursScheduled}</td>
                    <td className="text-center text-muted-foreground">{z.toursCompleted}</td>
                    <td className={cn('text-center font-medium', z.showUpRate >= 70 ? 'text-role-tcm' : z.showUpRate >= 50 ? 'text-role-hr' : 'text-danger')}>{z.showUpRate}%</td>
                    <td className="text-center text-role-hr font-medium">{z.drafts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="glass-card p-3 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading font-semibold text-xs md:text-sm text-foreground">Property Performance</h3>
        </div>
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <table className="w-full text-xs md:text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Property</th>
                <th className="text-center py-2 font-medium">Tours</th>
                <th className="text-center py-2 font-medium">Show-Ups</th>
                <th className="text-center py-2 font-medium">Drafts</th>
                <th className="text-center py-2 font-medium">Conv%</th>
              </tr>
            </thead>
            <tbody>
              {propertyPerf.map(p => (
                <tr key={p.name} className="border-b border-border/50">
                  <td className="py-2 font-medium text-foreground">{p.name}</td>
                  <td className="text-center text-muted-foreground">{p.tours}</td>
                  <td className="text-center text-muted-foreground">{p.showUps}</td>
                  <td className="text-center text-role-hr font-medium">{p.drafts}</td>
                  <td className={cn('text-center font-medium', p.conversion >= 30 ? 'text-role-tcm' : 'text-muted-foreground')}>{p.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Live Activity</h3>
        <div className="md:hidden space-y-2">
          {filtered.slice(0, 10).map(t => (
            <div key={t.id} className="bg-surface-2/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground text-sm">{t.leadName}</span>
                <span className="text-xs text-muted-foreground">{formatTime12h(t.tourTime)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.propertyName} · {t.assignedToName}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <OutcomeBadge outcome={t.outcome} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Time</th>
                <th className="text-left py-2 font-medium">Lead</th>
                <th className="text-left py-2 font-medium">Property</th>
                <th className="text-left py-2 font-medium">TCM</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-left py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-2 text-muted-foreground">{formatTime12h(t.tourTime)}</td>
                  <td className="py-2 font-medium text-foreground">{t.leadName}</td>
                  <td className="py-2 text-muted-foreground">{t.propertyName}</td>
                  <td className="py-2 text-muted-foreground">{t.assignedToName}</td>
                  <td className="py-2"><StatusBadge status={t.status} /></td>
                  <td className="py-2"><OutcomeBadge outcome={t.outcome} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <GlueFeed limit={30} title="Closed-loop activity · HR" />
    </div>
  );
}
