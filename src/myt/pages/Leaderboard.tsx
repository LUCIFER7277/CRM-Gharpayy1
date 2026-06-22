import { useAppState } from '@/myt/lib/app-context';
import { getMemberPerformance, zones } from '@/myt/lib/mock-data';
import { cn } from '@/lib/utils';
import { Trophy, Medal, Award } from 'lucide-react';
import { useState } from 'react';

export default function Leaderboard() {
  const { tours } = useAppState();
  const [roleFilter, setRoleFilter] = useState<'all' | 'flow-ops' | 'tcm'>('all');
  const [zoneFilter, setZoneFilter] = useState('');

  const memberPerf = getMemberPerformance(tours);

  const scored = memberPerf
    .filter(m => m.toursScheduled > 0)
    .filter(m => roleFilter === 'all' || m.role === roleFilter)
    .filter(m => !zoneFilter || m.zoneName.includes(zoneFilter))
    .map(m => {
      const score = Math.round(m.toursScheduled * (m.showUpRate / 100) * (m.drafts > 0 ? (m.drafts / m.toursCompleted) : 0) * 100) / 100;
      return { ...m, score };
    })
    .sort((a, b) => b.score - a.score);

  const selectClass = "h-8 bg-surface-2 border border-border rounded-md px-2 text-xs text-foreground";
  const rankIcons = [
    <Trophy className="h-5 w-5 text-role-hr" />,
    <Medal className="h-5 w-5 text-muted-foreground" />,
    <Award className="h-5 w-5 text-role-hr/60" />,
  ];

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Score = Tours × Show-Up% × Draft Rate</p>
        </div>
        <div className="flex gap-2">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className={selectClass}>
            <option value="all">All Roles</option>
            <option value="flow-ops">Flow Ops</option>
            <option value="tcm">TCM</option>
          </select>
          <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className={selectClass}>
            <option value="">All Zones</option>
            {zones.map(z => <option key={z.id} value={z.name.split(' - ')[1]}>{z.name.split(' - ')[1]}</option>)}
          </select>
        </div>
      </div>

      {/* Top 3 podium on mobile */}
      {scored.length >= 3 && (
        <div className="grid grid-cols-3 gap-2">
          {scored.slice(0, 3).map((m, i) => (
            <div key={m.memberId} className={cn(
              'glass-card p-3 text-center',
              i === 0 && 'border-role-hr/30 metric-glow-amber'
            )}>
              <div className="flex justify-center mb-1">{rankIcons[i]}</div>
              <p className="text-sm font-heading font-bold text-foreground truncate">{m.name.split(' ')[0]}</p>
              <p className="text-xs text-muted-foreground">{m.role === 'tcm' ? 'TCM' : 'Flow Ops'}</p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">{m.score.toFixed(1)}</p>
              <div className="flex justify-center gap-1 mt-1">
                <span className={cn(
                  'text-[9px] px-1 py-0.5 rounded',
                  m.showUpRate >= 70 ? 'bg-success/15 text-role-tcm' : 'bg-danger/15 text-danger'
                )}>{m.showUpRate}% show</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full leaderboard */}
      <div className="glass-card p-3 md:p-5">
        <div className="space-y-0">
          {scored.map((m, i) => (
            <div key={m.memberId} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                i < 3 ? 'bg-role-hr/15 text-role-hr' : 'bg-surface-2 text-muted-foreground'
              )}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.zoneName.split(' - ')[1]} · {m.role === 'tcm' ? 'TCM' : 'Flow Ops'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <div className="text-center hidden sm:block">
                  <p className="text-foreground font-medium">{m.toursScheduled}</p>
                  <p className="text-[9px] text-muted-foreground">tours</p>
                </div>
                <div className="text-center">
                  <p className={cn('font-medium', m.showUpRate >= 70 ? 'text-role-tcm' : m.showUpRate >= 50 ? 'text-role-hr' : 'text-danger')}>{m.showUpRate}%</p>
                  <p className="text-[9px] text-muted-foreground">show</p>
                </div>
                <div className="text-center">
                  <p className="text-role-hr font-medium">{m.drafts}</p>
                  <p className="text-[9px] text-muted-foreground">drafts</p>
                </div>
                <div className={cn(
                  'w-12 text-center py-1 rounded font-heading font-bold',
                  m.showUpRate >= 70 ? 'bg-success/10 text-role-tcm' : m.showUpRate < 50 ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-foreground'
                )}>
                  {m.score.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
          {scored.length === 0 && <p className="text-center text-muted-foreground text-xs py-6">No data</p>}
        </div>
      </div>
    </div>
  );
}
