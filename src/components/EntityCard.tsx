// Single card primitive - every card across the app extends this.
// One way to do things: same padding, same hover, same status placement.

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface EntityCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;          // top-right chip
  meta?: ReactNode;            // 2nd row, key/value strip
  body?: ReactNode;            // optional descriptive content
  primaryAction?: ReactNode;   // bottom-right
  secondaryActions?: ReactNode;
  onClick?: () => void;
  href?: string;
  accent?: 'default' | 'hot' | 'warning' | 'danger' | 'success' | 'info';
  className?: string;
  dense?: boolean;
  testId?: string;
}

const accentBorder: Record<NonNullable<EntityCardProps['accent']>, string> = {
  default: 'border-border',
  hot: 'border-accent/40',
  warning: 'border-warning/40',
  danger: 'border-destructive/40',
  success: 'border-success/40',
  info: 'border-info/40',
};

export function EntityCard({
  title, subtitle, status, meta, body,
  primaryAction, secondaryActions, onClick, href,
  accent = 'default', className, dense, testId,
}: EntityCardProps) {
  const Wrap: any = href ? 'a' : onClick ? 'button' : 'div';
  const wrapProps = href ? { href } : onClick ? { type: 'button', onClick } : {};
  return (
    <Wrap
      {...wrapProps}
      data-testid={testId}
      className={cn(
        'block w-full text-left rounded-xl border bg-card transition-all',
        'hover:border-accent/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        accentBorder[accent],
        dense ? 'p-2.5' : 'p-3',
        (onClick || href) && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</div>}
        </div>
        {status && <div className="shrink-0">{status}</div>}
      </div>
      {meta && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">{meta}</div>}
      {body && <div className="mt-2 text-xs text-foreground/85">{body}</div>}
      {(primaryAction || secondaryActions) && (
        <div className="mt-3 flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </Wrap>
  );
}

export function EntityMeta({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="uppercase tracking-wider text-[9px] text-muted-foreground/80">{label}</span>
      <span className={cn('text-foreground/90', mono && 'font-mono')}>{value}</span>
    </span>
  );
}
