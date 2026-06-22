import { useEffect, useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

const STORAGE_KEY = 'gharpayy.onboarding.completed.v1';

const STEPS = [
  {
    title: 'Welcome to Gharpayy Arena Infrastructure',
    body: 'One operating layer for HR, Flow Ops, TCM, and Owners. Every action triggers the next - no module works in isolation.',
    cta: { label: 'Show me the rhythm', to: '/help' },
  },
  {
    title: '1. Owners update rooms by 11 AM',
    body: 'Daily Truth: 9:30 AM open · 10:30 AM warning · 11 AM auto-lock. Unverified rooms vanish from sellable supply.',
    cta: { label: 'Open Owner Portal', to: '/owner' },
  },
  {
    title: '2. Flow Ops activates new rooms in 2 hours',
    body: 'Every new room must get 5 pitches or 2 qualified matches. Stale rooms surface in War Room.',
    cta: { label: 'Open Flow Ops', to: '/myt/flow-ops' },
  },
  {
    title: '3. TCM runs visits + files report in 15 min',
    body: 'Each visit ties to a specific room ID. Post-visit form captures objection → feeds owner insights.',
    cta: { label: 'Open TCM Desk', to: '/myt/tcm' },
  },
  {
    title: '4. HR sees compliance · Owners see effort',
    body: 'Closed loop: owner update → team task → reflected back to owner. No blind selling, no stale supply.',
    cta: { label: 'View dashboard', to: '/' },
  },
];

export function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setOpen(true);
  }, []);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-xs font-mono text-muted-foreground">Step {step + 1} / {STEPS.length}</span>
          </div>
          <button onClick={close} aria-label="Skip walkthrough" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <h2 className="font-display text-lg font-semibold">{s.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={close}>Skip</Button>
          <div className="flex items-center gap-2">
            <Link to={s.cta.to as any} onClick={close} className="text-xs text-accent inline-flex items-center gap-1">
              {s.cta.label} <ArrowRight className="h-3 w-3" />
            </Link>
            <Button size="sm" onClick={() => last ? close() : setStep(step + 1)}>
              {last ? 'Got it' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
