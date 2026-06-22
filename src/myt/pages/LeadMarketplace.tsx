import { useMemo } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { Lead } from '@/myt/lib/types';
import { budgetPowerScore, conversionProbability, leadIntent, urgencyExpiry, zoneMedianBudget } from '@/myt/lib/scoring';
import { UrgencyTimer } from '@/myt/components/UrgencyTimer';
import { zones, teamMembers } from '@/myt/lib/mock-data';
import { Phone, Wallet, MapPin, Calendar, Zap, TrendingUp, Hand, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { intentBg } from '@/myt/lib/confidence';
import { toast } from 'sonner';
import { useNavigate } from '@/shims/react-router-dom';
import { LeadControlPanel } from '@/myt/components/LeadControlPanel';

interface Enriched {
  lead: Lead;
  intent: 'hard' | 'medium' | 'soft';
  budgetPower: number;
  conversionProb: number;
  expiresAt: string;
}

export default function LeadMarketplace() {
  const { leads, setLeads, currentRole, currentMemberId, globalZoneFilter } = useAppState();
  const navigate = useNavigate();

  const enriched: Enriched[] = useMemo(() => {
    return leads
      .filter(l => l.status !== 'dead' && l.status !== 'tour-scheduled')
      .filter(l => !globalZoneFilter || zones.find(z => z.id === globalZoneFilter)?.area === l.area)
      .map(l => {
        const median = zoneMedianBudget(leads, l.area);
        const intent = leadIntent(l);
        const bp = l.budgetPowerScore ?? budgetPowerScore(l.budget, median);
        const cp = l.conversionProbability ?? conversionProbability(bp, intent, undefined);
        const exp = l.urgencyExpiresAt ?? urgencyExpiry(intent, l.createdAt);
        return { lead: l, intent, budgetPower: bp, conversionProb: cp, expiresAt: exp };
      })
      .sort((a, b) => b.conversionProb - a.conversionProb);
  }, [leads, globalZoneFilter]);

  const claimLead = (leadId: string) => {
    if (currentRole !== 'tcm' || !currentMemberId) {
      toast.error('Pick yourself in the header to claim leads');
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, claimedBy: currentMemberId, status: 'qualified' } : l));
    const member = teamMembers.find(m => m.id === currentMemberId);
    toast.success(`Claimed - go schedule the tour now`, {
      description: `${member?.name} owns this lead`,
    });
  };

  const scheduleFromLead = (l: Lead) => {
    navigate('/myt/schedule');
    toast.info(`Pre-fill: ${l.name} · ₹${l.budget} · ${l.area}`);
  };

  const summary = {
    hard: enriched.filter(e => e.intent === 'hard').length,
    medium: enriched.filter(e => e.intent === 'medium').length,
    soft: enriched.filter(e => e.intent === 'soft').length,
    avgProb: enriched.length ? Math.round(enriched.reduce((s, e) => s + e.conversionProb, 0) / enriched.length) : 0,
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-role-hr" />
          Lead Marketplace
        </h1>
        <p className="text-xs text-muted-foreground">
          {currentRole === 'tcm'
            ? 'Live unassigned leads - claim before they expire'
            : 'Watch demand flow through the funnel in real time'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Hard" value={summary.hard} accent="green" />
        <Stat label="Medium" value={summary.medium} accent="amber" />
        <Stat label="Soft" value={summary.soft} />
        <Stat label="Avg Conv %" value={`${summary.avgProb}%`} accent="primary" />
      </div>

      <div className="space-y-2">
        {enriched.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">No live leads right now. New ones surface as Flow Ops adds them.</div>
        )}
        {enriched.map(e => (
          <div
            key={e.lead.id}
            className={cn(
              'rounded-xl border p-3 space-y-2 transition-all',
              e.intent === 'hard' && 'border-role-tcm/30 bg-role-tcm/5',
              e.intent === 'medium' && 'border-role-hr/20 bg-role-hr/5',
              e.intent === 'soft' && 'border-border bg-surface-2/40',
              e.lead.claimedBy && 'opacity-60'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{e.lead.name}</span>
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase', intentBg[e.intent])}>
                    {e.intent}
                  </span>
                  {e.lead.claimedBy && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Claimed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                  <a href={`tel:${e.lead.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{e.lead.phone}</a>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.lead.area}</span>
                  <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />₹{(e.lead.budget/1000).toFixed(0)}k</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Move {e.lead.moveInDate.slice(5)}</span>
                </div>
              </div>
              <UrgencyTimer expiresAt={e.expiresAt} />
            </div>

            {/* Score strip */}
            <div className="grid grid-cols-2 gap-2">
              <ScoreInline label="Budget power" value={e.budgetPower} icon={<Wallet className="h-3 w-3" />} />
              <ScoreInline label="Conversion prob" value={e.conversionProb} icon={<TrendingUp className="h-3 w-3" />} />
            </div>

            <div className="flex gap-2 pt-1">
              <LeadControlPanel
                subject={{ kind: 'lead', lead: e.lead }}
                trigger={
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                    <Sparkles className="h-3 w-3" /> Open
                  </Button>
                }
              />
              {currentRole === 'tcm' && !e.lead.claimedBy && (
                <Button size="sm" onClick={() => claimLead(e.lead.id)} className="h-8 text-xs flex-1">
                  <Hand className="h-3 w-3 mr-1" /> Claim
                </Button>
              )}
              {(currentRole === 'flow-ops' || (currentRole === 'tcm' && e.lead.claimedBy === currentMemberId)) && (
                <Button size="sm" variant="outline" onClick={() => scheduleFromLead(e.lead)} className="h-8 text-xs flex-1">
                  Schedule tour →
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: 'green' | 'amber' | 'primary' }) {
  return (
    <div className="glass-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'text-xl font-bold tabular-nums mt-0.5',
        accent === 'green' && 'text-role-tcm',
        accent === 'amber' && 'text-role-hr',
        accent === 'primary' && 'text-primary',
        !accent && 'text-foreground'
      )}>{value}</div>
    </div>
  );
}

function ScoreInline({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const color = value >= 70 ? 'bg-role-tcm' : value >= 45 ? 'bg-role-hr' : 'bg-danger';
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="font-mono tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-surface-3 mt-0.5 overflow-hidden">
        <div className={cn('h-full', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
