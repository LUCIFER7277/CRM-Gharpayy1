import { Property, PropertyScores } from '@/myt/lib/types';
import { SignalChip } from './SignalChip';
import { MapPin, Wallet, TrendingUp, Zap, Target, Lock, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  property: Property;
  scores: PropertyScores;
  onClick?: () => void;
}

const scoreColor = (s: number) =>
  s >= 70 ? 'text-role-tcm' : s >= 45 ? 'text-role-hr' : 'text-danger';

const scoreBg = (s: number) =>
  s >= 70 ? 'bg-role-tcm' : s >= 45 ? 'bg-role-hr' : 'bg-danger';

export function PropertyCard({ property: p, scores: s, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-3 space-y-2.5 hover:border-accent/50 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground text-sm truncate">{p.name}</span>
            <SignalChip signal={s.signal} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.area}</span>
            <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />₹{(p.basePrice/1000).toFixed(0)}k</span>
          </div>
        </div>
      </div>

      {/* Three scores */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreTile icon={<TrendingUp className="h-3 w-3" />} label="Demand" value={s.demandScore} />
        <ScoreTile icon={<Target className="h-3 w-3" />} label="Conv" value={s.conversionScore} />
        <ScoreTile icon={<Zap className="h-3 w-3" />} label="Velocity" value={s.velocityScore} />
      </div>

      {/* Inventory bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Beds</span>
          <span className="tabular-nums">
            <span className="text-foreground font-medium">{s.bedsAvailable}</span> open · {s.bedsBlocked} blocked · {s.bedsOccupied}/{s.bedsTotal}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden flex">
          <div className="bg-role-tcm" style={{ width: `${(s.bedsOccupied / Math.max(1, s.bedsTotal)) * 100}%` }} />
          <div className="bg-role-hr" style={{ width: `${(s.bedsBlocked / Math.max(1, s.bedsTotal)) * 100}%` }} />
        </div>
      </div>

      {/* Revenue */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
        <span className="text-muted-foreground">This week</span>
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className="text-role-tcm font-semibold">+₹{(s.revenueWeek/1000).toFixed(0)}k</span>
          {s.missedRevenue > 0 && (
            <span className="text-danger">−₹{(s.missedRevenue/1000).toFixed(0)}k</span>
          )}
        </div>
      </div>

      {/* Top action */}
      {s.suggestedActions.length > 0 && (
        <div className="text-[10px] text-primary bg-primary/5 border border-primary/20 rounded px-2 py-1 leading-snug">
          💡 {s.suggestedActions[0]}
        </div>
      )}

      {/* Active blocks indicator */}
      {s.bedsBlocked > 0 && (
        <div className="text-[10px] text-role-hr flex items-center gap-1">
          <Lock className="h-3 w-3" />{s.bedsBlocked} bed{s.bedsBlocked > 1 ? 's' : ''} held
        </div>
      )}
    </button>
  );
}

function ScoreTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-3 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={cn('text-base font-bold tabular-nums', scoreColor(value))}>{value}</span>
        <span className="text-[9px] text-muted-foreground">/100</span>
      </div>
      <div className="h-0.5 rounded-full bg-surface-2 overflow-hidden mt-0.5">
        <div className={cn('h-full', scoreBg(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
