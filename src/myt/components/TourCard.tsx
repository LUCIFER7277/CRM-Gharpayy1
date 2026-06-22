import { Tour, TourOutcome, WhyLost } from '@/myt/lib/types';
import { ConfidenceBar } from './ConfidenceBar';
import { StatusBadge } from './StatusBadge';
import { Phone, Video, Building2, MapPin, Wallet, Calendar, Briefcase, Flame, Package, IndianRupee, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn, formatTime12h } from '@/lib/utils';
import { intentBg, confirmationLabel } from '@/myt/lib/confidence';
import { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { LeadControlPanel } from './LeadControlPanel';

interface Props {
  tour: Tour;
  onUpdate?: (id: string, updates: Partial<Tour>) => void;
  variant?: 'full' | 'compact';
}

const tourTypeIcon = (t: Tour['tourType']) =>
  t === 'virtual' ? <Video className="h-3.5 w-3.5" /> :
  t === 'pre-book-pitch' ? <Briefcase className="h-3.5 w-3.5" /> :
  <Building2 className="h-3.5 w-3.5" />;

const tourTypeLabel: Record<Tour['tourType'], string> = {
  physical: 'Physical',
  virtual: 'Virtual',
  'pre-book-pitch': 'Pre-book',
};

export function TourCard({ tour: t, onUpdate, variant = 'full' }: Props) {
  const [showOutcome, setShowOutcome] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [whyLost, setWhyLost] = useState<WhyLost>(null);

  const setOutcome = (outcome: TourOutcome, extra: Partial<Tour> = {}) => {
    onUpdate?.(t.id, { outcome, remarks, whyLost, ...extra });
    setShowOutcome(false);
  };

  return (
    <div className={cn(
      'rounded-xl border bg-card p-3 space-y-2.5 transition-all hover:border-accent/50 hover:shadow-sm',
      t.intent === 'hard' && 'border-accent/40',
      t.intent === 'medium' && 'border-warning/30',
      t.intent === 'soft' && 'border-border',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground text-sm truncate">{t.leadName}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide', intentBg[t.intent])}>
              {t.intent}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <a href={`tel:${t.phone}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
              <Phone className="h-3 w-3" />{t.phone}
            </a>
            <span className="text-[10px] text-muted-foreground capitalize">· {t.bookingSource}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">{tourTypeLabel[t.tourType]}</div>
          <div className="flex items-center gap-1 justify-end text-foreground text-xs font-medium mt-0.5">
            {tourTypeIcon(t.tourType)}
            <span>{formatTime12h(t.tourTime)}</span>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <ConfidenceBar score={t.confidenceScore} intent={t.intent} />

      {/* Reason */}
      {t.confidenceReason.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t.confidenceReason.join(' · ')}
        </p>
      )}

      {/* Context strip */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Wallet className="h-3 w-3 shrink-0" />
          <span className="truncate">₹{(t.budget/1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate">Move {t.qualification.moveInDate.slice(5)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{t.area}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{t.propertyName}</span>
        </div>
      </div>

      {t.qualification.keyConcern && variant === 'full' && (
        <div className="text-[10px] text-amber-foreground/80 bg-amber/10 border border-amber/20 rounded px-2 py-1">
          ⚠ {t.qualification.keyConcern}
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={t.status} />
          <span className="text-[10px] text-muted-foreground">{confirmationLabel[t.confirmationStrength]}</span>
        </div>

        {/* Actions */}
        {onUpdate && (
          <div className="flex gap-1 items-center">
            <LeadControlPanel
              subject={{ kind: 'tour', tour: t }}
              trigger={
                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 gap-1">
                  <Sparkles className="h-3 w-3" /> Open
                </Button>
              }
            />
            {t.status === 'scheduled' && (
              <Button size="sm" onClick={() => onUpdate(t.id, { status: 'confirmed' })} className="h-7 text-[11px] px-2.5">
                Confirm
              </Button>
            )}
            {t.status === 'confirmed' && (
              <>
                <Button size="sm" onClick={() => onUpdate(t.id, { status: 'completed', showUp: true })} className="h-7 text-[11px] px-2.5">
                  Show
                </Button>
                <Button size="sm" variant="outline" onClick={() => onUpdate(t.id, { status: 'no-show', showUp: false })} className="h-7 text-[11px] px-2 text-danger border-danger/30">
                  No-Show
                </Button>
              </>
            )}
            {t.status === 'completed' && !t.outcome && (
              <Button size="sm" variant="outline" onClick={() => setShowOutcome(s => !s)} className="h-7 text-[11px] px-2.5">
                Update
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Scarcity / Decision Compression actions */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
        <ScarcityButton
          icon={<Flame className="h-3 w-3" />}
          label="Urgency"
          onClick={() => {
            const msg = encodeURIComponent(
              `Hi ${t.leadName}, only 2 beds left in your range at ${t.propertyName}. 3 others viewing today. Hold expires in 4h. Reply YES to confirm.`
            );
            window.open(`https://wa.me/${t.phone.replace(/[^\d]/g, '')}?text=${msg}`, '_blank');
            toast.success('Urgency nudge prepared');
          }}
        />
        <ScarcityButton
          icon={<Package className="h-3 w-3" />}
          label="Pack"
          onClick={() => {
            const msg = encodeURIComponent(
              `Hi ${t.leadName}, here's your pre-tour pack for ${t.propertyName}:\n\n📸 Photos: gharpayy.com/p/${t.propertyId ?? 'demo'}\n🍽 Today's menu: gharpayy.com/menu\n🛡 Safety video: gharpayy.com/safety\n\nSee you at ${formatTime12h(t.tourTime)}!`
            );
            window.open(`https://wa.me/${t.phone.replace(/[^\d]/g, '')}?text=${msg}`, '_blank');
            toast.success('Content pack ready');
          }}
        />
        <ScarcityButton
          icon={<IndianRupee className="h-3 w-3" />}
          label="Token"
          onClick={() => {
            const link = `gharpayy.com/pay/${t.id}`;
            const msg = encodeURIComponent(
              `Lock your bed at ${t.propertyName} with ₹2,000 token. Refundable. Pay here: ${link}`
            );
            window.open(`https://wa.me/${t.phone.replace(/[^\d]/g, '')}?text=${msg}`, '_blank');
            toast.success('Payment link sent');
          }}
        />
      </div>

      {/* Outcome panel */}
      {showOutcome && onUpdate && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Remarks - objections, feedback…"
            className="bg-surface-3 border-border text-xs h-14 resize-none"
          />
          <select
            value={whyLost ?? ''}
            onChange={e => setWhyLost((e.target.value || null) as WhyLost)}
            className="w-full h-8 bg-surface-3 border border-border rounded-md px-2 text-xs text-foreground"
          >
            <option value="">Why lost? (if applicable)</option>
            <option value="price">Price</option>
            <option value="location">Location</option>
            <option value="food">Food</option>
            <option value="delay">Delay in decision</option>
            <option value="comparing">Comparing options</option>
            <option value="other">Other</option>
          </select>
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" onClick={() => setOutcome('booked', { tokenPaid: true })} className="h-7 text-[10px] px-2 bg-role-tcm text-background hover:bg-role-tcm/90">✅ Booked</Button>
            <Button size="sm" onClick={() => setOutcome('token-paid', { tokenPaid: true })} className="h-7 text-[10px] px-2 bg-role-tcm/80 text-background hover:bg-role-tcm/70">💰 Token</Button>
            <Button size="sm" onClick={() => setOutcome('draft')} variant="outline" className="h-7 text-[10px] px-2 text-role-hr border-role-hr/30">📄 Draft</Button>
            <Button size="sm" onClick={() => setOutcome('follow-up')} variant="outline" className="h-7 text-[10px] px-2">🔁 Follow-up</Button>
            <Button size="sm" onClick={() => setOutcome('not-interested')} variant="outline" className="h-7 text-[10px] px-2 text-danger border-danger/30">❌ Lost</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScarcityButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 h-6 rounded-md bg-surface-3 hover:bg-primary/15 hover:text-primary text-muted-foreground text-[10px] font-medium uppercase tracking-wide transition-colors"
    >
      {icon}{label}
    </button>
  );
}
