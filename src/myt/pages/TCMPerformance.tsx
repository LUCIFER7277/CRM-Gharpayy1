import { useAppState } from '@/myt/lib/app-context';
import { MetricCard } from '@/myt/components/MetricCard';
import { CalendarCheck, TrendingUp, FileText } from 'lucide-react';

export default function TCMPerformance() {
  const { tours, currentMemberId } = useAppState();
  const myTours = currentMemberId
    ? tours.filter(t => t.assignedTo === currentMemberId)
    : tours.filter(t => t.assignedTo === 'm5' || t.assignedTo === 'm6');
  const completed = myTours.filter(t => t.status === 'completed').length;
  const showUps = myTours.filter(t => t.showUp === true).length;
  const drafts = myTours.filter(t => t.outcome === 'draft').length;

  const rows = [
    { label: 'Tours Assigned', value: myTours.length },
    { label: 'Tours Completed', value: completed },
    { label: 'No-Shows', value: myTours.filter(t => t.showUp === false).length, danger: true },
    { label: 'Pending Updates', value: myTours.filter(t => t.status === 'completed' && !t.outcome).length, warning: true },
    { label: 'Draft Conversion', value: completed > 0 ? `${Math.round((drafts / completed) * 100)}%` : '0%' },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">My Performance</h1>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricCard label="Total Tours" value={myTours.length} color="green" icon={<CalendarCheck className="h-4 w-4" />} />
        <MetricCard label="Completed" value={completed} color="green" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Show-Up %" value={myTours.length > 0 ? `${Math.round((showUps / myTours.length) * 100)}%` : '0%'} color="green" />
        <MetricCard label="Drafts" value={drafts} color="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Daily Summary</h3>
        <div className="space-y-0 text-sm">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between py-2.5 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground text-xs md:text-sm">{r.label}</span>
              <span className={`font-medium text-sm ${r.danger ? 'text-danger' : r.warning ? 'text-role-hr' : 'text-foreground'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
