import { useMemo, useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { teamMembers, zones } from '@/myt/lib/mock-data';
import { cn, formatTime12h } from '@/lib/utils';
import { Tour } from '@/myt/lib/types';
import { intentBg } from '@/myt/lib/confidence';
import { Building2, Video, Briefcase } from 'lucide-react';

const HOURS = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

function getWeekDays(): { iso: string; day: string; date: string }[] {
  const out: { iso: string; day: string; date: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().split('T')[0],
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      date: d.getDate().toString().padStart(2, '0'),
    });
  }
  return out;
}

const tourIcon = (t: Tour['tourType']) =>
  t === 'virtual' ? <Video className="h-2.5 w-2.5" /> :
  t === 'pre-book-pitch' ? <Briefcase className="h-2.5 w-2.5" /> :
  <Building2 className="h-2.5 w-2.5" />;

export default function TourCalendar() {
  const { tours, currentMemberId, globalZoneFilter } = useAppState();
  const [tcmFilter, setTcmFilter] = useState<string>(currentMemberId ?? 'all');
  const [hoveredTour, setHoveredTour] = useState<Tour | null>(null);

  const tcms = teamMembers.filter(m => m.role === 'tcm');
  const days = useMemo(getWeekDays, []);

  const filtered = useMemo(() => tours.filter(t => {
    if (tcmFilter !== 'all' && t.assignedTo !== tcmFilter) return false;
    if (globalZoneFilter && t.zoneId !== globalZoneFilter) return false;
    if (t.status === 'cancelled') return false;
    return true;
  }), [tours, tcmFilter, globalZoneFilter]);

  const slotMap = useMemo(() => {
    const map: Record<string, Tour[]> = {};
    filtered.forEach(t => {
      const hour = t.tourTime.split(':')[0] + ':00';
      const key = `${t.tourDate}_${hour}`;
      (map[key] = map[key] ?? []).push(t);
    });
    return map;
  }, [filtered]);

  const intentColor = (intent: Tour['intent']) =>
    intent === 'hard' ? 'bg-role-tcm/30 border-role-tcm hover:bg-role-tcm/50'
    : intent === 'medium' ? 'bg-role-hr/30 border-role-hr hover:bg-role-hr/50'
    : 'bg-muted/40 border-muted-foreground/30 hover:bg-muted/60';

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Tour Calendar</h1>
          <p className="text-xs text-muted-foreground">7-day slot availability - color = intent</p>
        </div>
        <select
          value={tcmFilter}
          onChange={e => setTcmFilter(e.target.value)}
          className="h-9 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground"
        >
          <option value="all">All TCMs</option>
          {tcms.map(m => {
            const z = zones.find(z => z.id === m.zoneId);
            return <option key={m.id} value={m.id}>{m.name} · {z?.area}</option>;
          })}
        </select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-role-tcm/30 border border-role-tcm" /> Hard</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-role-hr/30 border border-role-hr" /> Medium</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted/40 border border-muted-foreground/30" /> Soft</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface-2 border border-border" /> Open</span>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block glass-card p-3 overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, minmax(120px, 1fr))' }}>
          <div />
          {days.map(d => (
            <div key={d.iso} className="text-center pb-2 border-b border-border">
              <div className="text-[10px] uppercase text-muted-foreground">{d.day}</div>
              <div className="text-sm font-bold text-foreground">{d.date}</div>
            </div>
          ))}

          {HOURS.map(h => (
            <div key={h} className="contents">
              <div className="text-[10px] text-muted-foreground py-1.5 pr-2 text-right border-r border-border">{formatTime12h(h)}</div>
              {days.map(d => {
                const items = slotMap[`${d.iso}_${h}`] ?? [];
                return (
                  <div key={d.iso + h} className="border-b border-r border-border/30 p-1 min-h-[40px] space-y-0.5">
                    {items.map(t => (
                      <div
                        key={t.id}
                        onMouseEnter={() => setHoveredTour(t)}
                        onMouseLeave={() => setHoveredTour(null)}
                        className={cn(
                          'text-[10px] px-1.5 py-1 rounded border cursor-pointer transition-colors flex items-center gap-1',
                          intentColor(t.intent)
                        )}
                      >
                        {tourIcon(t.tourType)}
                        <span className="truncate text-foreground font-medium">{t.leadName.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hoveredTour && (
        <div className={cn('hidden md:block fixed bottom-4 right-4 z-50 glass-card p-3 max-w-xs border', intentBg[hoveredTour.intent])}>
          <div className="text-sm font-semibold text-foreground">{hoveredTour.leadName}</div>
          <div className="text-xs text-muted-foreground">{hoveredTour.propertyName} · {formatTime12h(hoveredTour.tourTime)}</div>
          <div className="text-xs mt-1">{hoveredTour.confidenceScore}% · {hoveredTour.confidenceReason.join(' · ')}</div>
        </div>
      )}

      {/* Mobile: day-by-day stack */}
      <div className="md:hidden space-y-3">
        {days.map(d => {
          const dayTours = filtered.filter(t => t.tourDate === d.iso).sort((a,b) => a.tourTime.localeCompare(b.tourTime));
          return (
            <div key={d.iso} className="glass-card p-3">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm font-bold text-foreground">{d.day} {d.date}</span>
                <span className="text-[10px] text-muted-foreground">· {dayTours.length} tours</span>
              </div>
              {dayTours.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tours scheduled</p>
              ) : (
                <div className="space-y-1.5">
                  {dayTours.map(t => (
                    <div key={t.id} className={cn('flex items-center gap-2 px-2 py-1.5 rounded border', intentColor(t.intent))}>
                      <span className="text-[10px] font-mono text-foreground tabular-nums w-14">{formatTime12h(t.tourTime)}</span>
                      {tourIcon(t.tourType)}
                      <span className="text-xs font-medium text-foreground truncate flex-1">{t.leadName}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{t.confidenceScore}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
