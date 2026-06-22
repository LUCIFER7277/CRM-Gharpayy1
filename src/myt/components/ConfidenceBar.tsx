import { Intent } from '@/myt/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  score: number;
  intent: Intent;
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceBar({ score, intent, className, showLabel = true }: Props) {
  const fill =
    intent === 'hard'
      ? 'bg-role-tcm'
      : intent === 'medium'
      ? 'bg-role-hr'
      : 'bg-muted-foreground';

  const label =
    intent === 'hard' ? 'HARD' : intent === 'medium' ? 'MEDIUM' : 'SOFT';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', fill)}
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[10px] font-mono font-semibold tabular-nums text-foreground shrink-0 w-16 text-right">
          {score}% · {label}
        </span>
      )}
    </div>
  );
}
