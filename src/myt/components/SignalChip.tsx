import { InventorySignal } from '@/myt/lib/types';
import { cn } from '@/lib/utils';

const signalConfig: Record<InventorySignal, { label: string; emoji: string; cls: string }> = {
  hot: { label: 'Hot', emoji: '🔥', cls: 'bg-danger/15 text-danger border-danger/30' },
  balanced: { label: 'Balanced', emoji: '⚖️', cls: 'bg-role-hr/15 text-role-hr border-role-hr/30' },
  cold: { label: 'Cold', emoji: '❄️', cls: 'bg-primary/10 text-primary border-primary/30' },
};

export function SignalChip({ signal, className }: { signal: InventorySignal; className?: string }) {
  const c = signalConfig[signal];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide',
      c.cls, className
    )}>
      <span>{c.emoji}</span>{c.label}
    </span>
  );
}
