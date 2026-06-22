import { Activity } from 'lucide-react';

interface GlueFeedProps {
  limit?: number;
  title?: string;
}

export function GlueFeed({ limit: _limit, title }: GlueFeedProps = {}) {
  return (
    <div className="space-y-2 p-4">
      {title && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      )}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" />
        <span>Activity feed unavailable</span>
      </div>
    </div>
  );
}
