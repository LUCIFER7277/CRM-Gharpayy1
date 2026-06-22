import { useAppState } from '@/myt/lib/app-context';
import { AlertTriangle, Clock, FileText } from 'lucide-react';

export function NotificationsPanel() {
  const { tours } = useAppState();
  const now = new Date();
  const currentHour = now.getHours();

  // Tours in next 2 hours not confirmed
  const unconfirmed = tours.filter(t => {
    const h = parseInt(t.tourTime.split(':')[0]);
    return h >= currentHour && h <= currentHour + 2 && t.status === 'scheduled';
  });

  // Drafts older than 3 days with no booking
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const staleDrafts = tours.filter(t => t.outcome === 'draft' && new Date(t.tourDate) < threeDaysAgo);

  // Completed tours with no outcome
  const noOutcome = tours.filter(t => t.status === 'completed' && !t.outcome);

  const totalAlerts = unconfirmed.length + staleDrafts.length + noOutcome.length;
  if (totalAlerts === 0) return null;

  return (
    <div className="glass-card p-3 md:p-4 border-warning/30 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="font-heading font-semibold text-xs text-warning">{totalAlerts} Alerts</h3>
      </div>

      {unconfirmed.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            <span className="text-primary font-medium">{unconfirmed.length}</span> tours in next 2hrs not confirmed
          </span>
        </div>
      )}

      {staleDrafts.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-role-hr mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            <span className="text-role-hr font-medium">{staleDrafts.length}</span> drafts &gt;3 days without agreement
          </span>
        </div>
      )}

      {noOutcome.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-danger mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            <span className="text-danger font-medium">{noOutcome.length}</span> completed tours missing outcome
          </span>
        </div>
      )}
    </div>
  );
}
