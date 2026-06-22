import { useAppState } from '@/myt/lib/app-context';
import { TourCard } from '@/myt/components/TourCard';
import { Tour } from '@/myt/lib/types';

const intentRank: Record<Tour['intent'], number> = { hard: 0, medium: 1, soft: 2 };

export default function TCMActions() {
  const { tours, setTours, currentMemberId } = useAppState();
  const myTours = currentMemberId
    ? tours.filter(t => t.assignedTo === currentMemberId)
    : tours.filter(t => t.assignedTo === 'm5' || t.assignedTo === 'm6');

  const sortByIntent = (list: Tour[]) =>
    [...list].sort((a, b) => intentRank[a.intent] - intentRank[b.intent] || a.tourTime.localeCompare(b.tourTime));

  const toConfirm = sortByIntent(myTours.filter(t => t.status === 'scheduled'));
  const missed = sortByIntent(myTours.filter(t => t.status === 'no-show'));
  const needsOutcome = sortByIntent(myTours.filter(t => t.status === 'completed' && !t.outcome));
  const draftPush = sortByIntent(myTours.filter(t => t.outcome === 'draft'));

  const updateTour = (id: string, updates: Partial<Tour>) => {
    setTours(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const total = toConfirm.length + missed.length + needsOutcome.length + draftPush.length;

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Action Queue</h1>
        <p className="text-xs text-muted-foreground">Hard intent surfaced first - fight for the highest-conversion tours</p>
      </div>

      <Section title="📞 Confirm Attendance" count={toConfirm.length} color="text-primary">
        {toConfirm.map(t => <TourCard key={t.id} tour={t} onUpdate={updateTour} variant="compact" />)}
      </Section>

      <Section title="❌ Missed - Follow Up" count={missed.length} color="text-danger">
        {missed.map(t => <TourCard key={t.id} tour={t} onUpdate={updateTour} variant="compact" />)}
      </Section>

      <Section title="📝 Update Outcome" count={needsOutcome.length} color="text-role-hr">
        {needsOutcome.map(t => <TourCard key={t.id} tour={t} onUpdate={updateTour} variant="compact" />)}
      </Section>

      <Section title="📄 Push Draft Agreement" count={draftPush.length} color="text-role-hr">
        {draftPush.map(t => <TourCard key={t.id} tour={t} onUpdate={updateTour} variant="compact" />)}
      </Section>

      {total === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">All caught up! 🎉</div>
      )}
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="glass-card p-3 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className={`font-heading font-semibold text-xs md:text-sm ${color}`}>{title}</h3>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">{children}</div>
    </div>
  );
}
