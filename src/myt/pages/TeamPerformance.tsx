import { useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { getMemberPerformance, zones } from '@/myt/lib/mock-data';
import { DateRangeToggle } from '@/myt/components/DateRangeToggle';
import { StatusBadge, OutcomeBadge } from '@/myt/components/StatusBadge';
import { DateRange, MemberPerformance } from '@/myt/lib/types';
import { cn, formatTime12h } from '@/lib/utils';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export default function TeamPerformance() {
  const { tours } = useAppState();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof MemberPerformance>('showUpRate');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterZone, setFilterZone] = useState<string>('all');

  const memberPerf = getMemberPerformance(tours);
  const filtered = filterZone === 'all' ? memberPerf : memberPerf.filter(m => m.zoneName.includes(filterZone));
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
    return 0;
  });

  const memberTours = selectedMember ? tours.filter(t => t.assignedTo === selectedMember || t.scheduledBy === selectedMember) : [];

  const handleSort = (key: keyof MemberPerformance) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ field }: { field: keyof MemberPerformance }) => {
    if (sortKey !== field) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Team Performance</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterZone}
            onChange={e => setFilterZone(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
          >
            <option value="all">All Zones</option>
            {zones.map(z => <option key={z.id} value={z.area}>{z.area}</option>)}
          </select>
          <DateRangeToggle value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {sorted.map(m => (
          <div
            key={m.memberId}
            onClick={() => setSelectedMember(m.memberId === selectedMember ? null : m.memberId)}
            className="glass-card p-3 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-foreground text-sm">{m.name}</span>
                <span className={cn('ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full', m.role === 'flow-ops' ? 'bg-flow-ops/15 text-role-flow' : 'bg-tcm/15 text-role-tcm')}>
                  {m.role === 'flow-ops' ? 'FO' : 'TCM'}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.zoneName.split(' - ')[1]}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Tours</p>
                <p className="text-sm font-medium text-foreground">{m.toursScheduled}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Done</p>
                <p className="text-sm font-medium text-foreground">{m.toursCompleted}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Show%</p>
                <p className={cn('text-sm font-medium', m.showUpRate >= 70 ? 'text-role-tcm' : m.showUpRate >= 50 ? 'text-role-hr' : 'text-danger')}>{m.showUpRate}%</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Drafts</p>
                <p className="text-sm font-medium text-role-hr">{m.drafts}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground bg-surface-2/50">
                <th className="text-left py-3 px-4 font-medium">Name</th>
                <th className="text-left py-3 px-2 font-medium">Role</th>
                <th className="text-left py-3 px-2 font-medium">Zone</th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('leadsAdded')}>Leads <SortIcon field="leadsAdded" /></th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('toursScheduled')}>Tours <SortIcon field="toursScheduled" /></th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('toursCompleted')}>Done <SortIcon field="toursCompleted" /></th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('showUpRate')}>Show% <SortIcon field="showUpRate" /></th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('drafts')}>Drafts <SortIcon field="drafts" /></th>
                <th className="text-center py-3 px-2 font-medium cursor-pointer" onClick={() => handleSort('sameDayRate')}>Same-Day% <SortIcon field="sameDayRate" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr
                  key={m.memberId}
                  className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedMember(m.memberId === selectedMember ? null : m.memberId)}
                >
                  <td className="py-2.5 px-4 font-medium text-foreground">{m.name}</td>
                  <td className="py-2.5 px-2">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', m.role === 'flow-ops' ? 'bg-flow-ops/15 text-role-flow' : 'bg-tcm/15 text-role-tcm')}>
                      {m.role === 'flow-ops' ? 'Flow Ops' : 'TCM'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground text-xs">{m.zoneName.split(' - ')[1]}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{m.leadsAdded}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{m.toursScheduled}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{m.toursCompleted}</td>
                  <td className={cn('py-2.5 px-2 text-center font-medium', m.showUpRate >= 70 ? 'text-role-tcm' : m.showUpRate >= 50 ? 'text-role-hr' : 'text-danger')}>{m.showUpRate}%</td>
                  <td className="py-2.5 px-2 text-center text-role-hr font-medium">{m.drafts}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{m.sameDayRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Tour History */}
      {selectedMember && (
        <div className="glass-card p-3 md:p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm text-foreground">
              {sorted.find(m => m.memberId === selectedMember)?.name} - History
            </h3>
            <button onClick={() => setSelectedMember(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 md:hidden">
            {memberTours.map(t => (
              <div key={t.id} className="bg-surface-2/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{t.leadName}</span>
                  <span className="text-muted-foreground">{t.tourDate} {formatTime12h(t.tourTime)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.propertyName}</p>
                <div className="flex gap-2">
                  <StatusBadge status={t.status} />
                  <OutcomeBadge outcome={t.outcome} />
                </div>
              </div>
            ))}
            {memberTours.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No tours found</p>}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Time</th>
                  <th className="text-left py-2 font-medium">Lead</th>
                  <th className="text-left py-2 font-medium">Property</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Outcome</th>
                  <th className="text-left py-2 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {memberTours.map(t => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2 text-muted-foreground">{t.tourDate}</td>
                    <td className="py-2 text-muted-foreground">{formatTime12h(t.tourTime)}</td>
                    <td className="py-2 text-foreground">{t.leadName}</td>
                    <td className="py-2 text-muted-foreground">{t.propertyName}</td>
                    <td className="py-2"><StatusBadge status={t.status} /></td>
                    <td className="py-2"><OutcomeBadge outcome={t.outcome} /></td>
                    <td className="py-2 text-muted-foreground text-xs">{t.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
