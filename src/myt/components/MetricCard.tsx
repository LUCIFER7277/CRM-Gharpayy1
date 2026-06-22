import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
  icon?: React.ReactNode;
}

const glowMap = {
  blue: 'metric-glow-blue border-flow-ops/20',
  green: 'metric-glow-green border-tcm/20',
  amber: 'metric-glow-amber border-hr/20',
  red: 'border-danger/20',
};

const textMap = {
  blue: 'text-role-flow',
  green: 'text-role-tcm',
  amber: 'text-role-hr',
  red: 'text-danger',
};

export function MetricCard({ label, value, subtext, color = 'blue', icon }: MetricCardProps) {
  return (
    <div className={cn('glass-card p-3 md:p-4 animate-slide-up', glowMap[color])}>
      <div className="flex items-center justify-between mb-1 md:mb-2">
        <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
        {icon && <span className={cn('opacity-60 hidden sm:block', textMap[color])}>{icon}</span>}
      </div>
      <div className={cn('text-xl md:text-2xl font-heading font-bold', textMap[color])}>{value}</div>
      {subtext && <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );
}
