import { useState, useEffect } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { useAuthUser } from '@/lib/auth-store';
import { MetricCard } from '@/myt/components/MetricCard';
import { TourCard } from '@/myt/components/TourCard';
import { CalendarCheck, TrendingUp, FileText, Target } from 'lucide-react';
import { Tour } from '@/myt/lib/types';
import { GlueFeed } from '@/components/GlueFeed';
import { CoachInline } from '@/components/CoachInline';
import { bestInventoryFits, availableBedsForProperty, supplyHubProperties } from '@/myt/lib/inventory-intelligence';

const intentRank: Record<Tour['intent'], number> = { hard: 0, medium: 1, soft: 2 };

export default function TCMDashboard() {
  const { tours, setTours, currentMemberId, rooms, blocks } = useAppState();
  const authUser = useAuthUser((s) => s.user);
  const actorId = currentMemberId || (authUser?.role === "tcm" ? authUser.id : null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const myTours = (actorId
    ? tours.filter((t) => t.assignedTo === actorId)
    : []
  ).filter((t) => t.tourDate === today);

  // Sort: hard first, then by time
  const sortedTours = [...myTours].sort((a, b) => {
    const r = intentRank[a.intent] - intentRank[b.intent];
    return r !== 0 ? r : a.tourTime.localeCompare(b.tourTime);
  });

  const completed = myTours.filter(t => t.status === 'completed').length;
  const showUps = myTours.filter(t => t.showUp === true).length;
  const drafts = myTours.filter(t => t.outcome === 'draft' || t.outcome === 'booked').length;
  const dailyTarget = 10;
  const targetPct = Math.min(100, Math.round((myTours.length / dailyTarget) * 100));

  const updateTour = (tourId: string, updates: Partial<Tour>) => {
    setTours(prev => prev.map(t => t.id === tourId ? { ...t, ...updates } : t));
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <CoachInline page="tcm" />
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Today's Tours</h1>
        <p className="text-xs text-muted-foreground">
          {actorId ? 'Sorted by intent - fight for hard ones first' : 'Sign in as a TCM to see your tours'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricCard label="My Tours" value={myTours.length} color="green" icon={<CalendarCheck className="h-4 w-4" />} />
        <MetricCard label="Completed" value={completed} color="green" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Show-Up %" value={myTours.length > 0 ? `${Math.round((showUps / myTours.length) * 100)}%` : '0%'} color={showUps / Math.max(1, myTours.length) >= 0.7 ? 'green' : 'red'} />
        <MetricCard label="Bookings" value={drafts} color="amber" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="glass-card p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground">Property Win Cards</h3>
            <p className="text-xs text-muted-foreground">Close using the room that matches area, budget and live availability.</p>
          </div>
          <span className="text-[10px] rounded-full bg-role-tcm/10 px-2 py-1 text-role-tcm">TCM goal: close every Tour</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {sortedTours.slice(0, 3).map((tour) => {
            const fit = bestInventoryFits({ areaText: tour.area, budget: tour.budget, rooms, blocks, limit: 1 })[0];
            const prop = supplyHubProperties.find((p) => p.name === tour.propertyName) ?? (fit ? supplyHubProperties.find((p) => p.id === fit.propertyId) : undefined);
            const inv = prop ? availableBedsForProperty(prop.id, rooms, blocks) : null;
            return (
              <div key={tour.id} className="rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="text-sm font-semibold truncate">{tour.leadName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{prop?.name ?? tour.propertyName} · {inv?.beds ?? fit?.availableBeds ?? 0} beds live</div>
                <div className="mt-2 text-[11px] text-foreground/80">Pitch: {fit?.reason ?? 'Use best available room and protect price objection.'}</div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                  <span>Confirm arrival</span><span>Show best room</span><span>Handle objection</span><span>Mark outcome</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily target */}
      <div className="glass-card p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Daily Target</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-foreground">{myTours.length} / {dailyTarget}</span>
        </div>
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${targetPct}%` }} />
        </div>
      </div>

      {sortedTours.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">No tours today</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {sortedTours.map(t => (
            <TourCard key={t.id} tour={t} onUpdate={updateTour} />
          ))}
        </div>
      )}
      <GlueFeed limit={20} title="Closed-loop activity · TCM" />
    </div>
  );
}
