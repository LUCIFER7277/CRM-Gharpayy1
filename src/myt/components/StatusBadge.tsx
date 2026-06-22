import { cn } from '@/lib/utils';
import { TourStatus, TourOutcome } from '@/myt/lib/types';

const statusStyles: Record<TourStatus, string> = {
  scheduled: 'bg-primary/15 text-primary',
  confirmed: 'bg-tcm/15 text-role-tcm',
  completed: 'bg-success/15 text-success',
  'no-show': 'bg-danger/15 text-danger',
  cancelled: 'bg-muted text-muted-foreground',
};

const outcomeStyles: Record<string, string> = {
  draft: 'bg-hr/15 text-role-hr',
  'follow-up': 'bg-primary/15 text-primary',
  rejected: 'bg-danger/15 text-danger',
};

export function StatusBadge({ status }: { status: TourStatus }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', statusStyles[status])}>
      {status.replace('-', ' ')}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: TourOutcome }) {
  if (!outcome) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', outcomeStyles[outcome])}>
      {outcome.replace('-', ' ')}
    </span>
  );
}
