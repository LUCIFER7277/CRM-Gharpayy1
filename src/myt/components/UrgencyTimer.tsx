import { useEffect, useState } from 'react';
import { timeLeft } from '@/myt/lib/blocks';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export function UrgencyTimer({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const t = timeLeft(expiresAt);
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-mono font-medium tabular-nums',
      t.expired ? 'text-muted-foreground' : t.mins <= 30 ? 'text-danger animate-pulse' : t.mins <= 90 ? 'text-role-hr' : 'text-foreground',
      className
    )}>
      <Clock className="h-3 w-3" />
      {t.label}
    </span>
  );
}
