import { useAppState } from '@/myt/lib/app-context';
import { zones } from '@/myt/lib/mock-data';
import { useOrgMembers } from '@/hooks/useOrgDirectory';
import { CalendarCheck, MapPin, User } from 'lucide-react';

export function TopHeader() {
  const { tours, currentRole, currentMemberId, setCurrentMemberId, globalZoneFilter, setGlobalZoneFilter } = useAppState();
  const { members } = useOrgMembers();

  const today = new Date().toISOString().split('T')[0];
  const todayTours = tours.filter(t => t.tourDate === today);
  const relevantMembers = currentRole === 'hr' ? [] : members;

  const selectClass = "h-8 bg-surface-2 border border-border rounded-md px-2 text-xs text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-2.5 bg-card/60 backdrop-blur-sm border-b border-border">
      <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
        {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>

      <div className="flex items-center gap-1.5 text-xs">
        <CalendarCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-foreground font-medium">{todayTours.length}</span>
        <span className="text-muted-foreground">tours today</span>
      </div>

      <div className="flex-1" />

      {/* Zone filter */}
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={globalZoneFilter || ''}
          onChange={e => setGlobalZoneFilter(e.target.value || null)}
          className={selectClass}
        >
          <option value="">All Zones</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name.split(' - ')[1]}</option>)}
        </select>
      </div>

      {/* Who Am I (for Flow Ops / TCM) */}
      {currentRole !== 'hr' && (
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={currentMemberId || ''}
            onChange={e => setCurrentMemberId(e.target.value || null)}
            className={selectClass}
          >
            <option value="">Select Member</option>
            {relevantMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
