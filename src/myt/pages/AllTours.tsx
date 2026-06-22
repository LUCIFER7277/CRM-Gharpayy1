import { type ReactNode, useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { useApp } from '@/lib/store';
import { useAuthUser } from '@/lib/auth-store';
import { useOrgMembers } from '@/hooks/useOrgDirectory';
import { formatTime12h, cn } from '@/lib/utils';
import { Tour, TourStatus, TourOutcome } from '@/myt/lib/types';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CheckCircle2, Clock3, Eye, FileText, MapPin, UserRound } from 'lucide-react';

export default function AllTours() {
  const { tours } = useAppState();
  const { selectLead, leads } = useApp();
  const authUser = useAuthUser(s => s.user);
  const { members } = useOrgMembers();
  const [statusFilter, setStatusFilter] = useState<TourStatus | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<TourOutcome | 'all'>('all');

  const filtered = tours.filter(t => {
    // Role-based visibility
    if (authUser?.role === 'admin') {
      const myMemberIds = members
        .filter(m => m.adminId === authUser.id || m.managerId === authUser.id)
        .map(m => m.id);
      
      const visibleLeadIds = new Set(leads.map(l => l.id));
      
      const isVisible = t.assignedTo === authUser.id || 
                        t.scheduledBy === authUser.id ||
                        myMemberIds.includes(t.assignedTo) ||
                        myMemberIds.includes(t.scheduledBy) ||
                        (t.leadId && visibleLeadIds.has(t.leadId));
      
      if (!isVisible) return false;
    }
    // super_admin sees all by default (no filter applied)
    
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (outcomeFilter !== 'all' && t.outcome !== outcomeFilter) return false;
    return true;
  }).sort((a, b) => {
    const aTs = new Date(`${a.tourDate}T${a.tourTime || "00:00"}`).getTime();
    const bTs = new Date(`${b.tourDate}T${b.tourTime || "00:00"}`).getTime();
    return bTs - aTs;
  });

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">All Tours</h1>

      <div className="flex gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30">
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="no-show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={outcomeFilter ?? 'all'} onChange={e => setOutcomeFilter(e.target.value === 'all' ? 'all' : e.target.value as TourOutcome)} className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30">
          <option value="all">All Outcomes</option>
          <option value="booked">Booked</option>
          <option value="token-paid">Token Paid</option>
          <option value="draft">Draft</option>
          <option value="follow-up">Follow-up</option>
          <option value="rejected">Rejected</option>
          <option value="not-interested">Not Interested</option>
        </select>
      </div>

      {/* Tour Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No tours found matching your filters.
          </div>
        ) : (
          filtered.map(t => (
            <TourAdminCard key={t.id} tour={t} onOpenLead={() => selectLead(t.leadId || t.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function TourAdminCard({ tour, onOpenLead }: { tour: Tour; onOpenLead: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4 transition-all hover:border-accent/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{tour.leadName}</h2>
            <StatusPill status={tour.status} />
            <OutcomePill outcome={tour.outcome} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {tour.propertyName}</span>
            <span>{tour.area}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {tour.tourDate} · {formatTime12h(tour.tourTime)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> Assigned to {tour.assignedToName}</span>
            <span>Scheduled by {tour.scheduledByName}</span>
            <span>Lead source: {tour.bookingSource}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={onOpenLead}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> View detail
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Progress"
          value={progressLabel(tour)}
          hint="Current operational state of this visit"
        />
        <InfoTile
          icon={<CalendarDays className="h-4 w-4" />}
          label="Tour Mode"
          value={capitalizeWords(tour.tourType.replace("-", " "))}
          hint={`Confirmation: ${capitalizeWords(tour.confirmationStrength)}`}
        />
        <InfoTile
          icon={<FileText className="h-4 w-4" />}
          label="Latest Notes"
          value={tour.remarks?.trim() ? tour.remarks : "No remarks added yet"}
          hint={tour.showUp === null ? "Show-up not marked yet." : tour.showUp ? "Lead marked as showed up." : "Lead marked as no-show."}
        />
      </div>

      {tour.qualification.keyConcern ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          Key concern: {tour.qualification.keyConcern}
        </div>
      ) : null}
    </section>
  );
}

function InfoTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function StatusPill({ status }: { status: TourStatus }) {
  const tone =
    status === "completed" ? "bg-success/10 text-success" :
    status === "confirmed" ? "bg-info/10 text-info" :
    status === "no-show" ? "bg-destructive/10 text-destructive" :
    status === "cancelled" ? "bg-muted text-muted-foreground" :
    "bg-warning/10 text-warning";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {capitalizeWords(status.replace("-", " "))}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: TourOutcome }) {
  if (!outcome) {
    return <span className="text-xs text-muted-foreground">No outcome yet</span>;
  }
  const tone =
    outcome === "booked" || outcome === "token-paid" ? "bg-success/10 text-success" :
    outcome === "follow-up" || outcome === "draft" ? "bg-info/10 text-info" :
    "bg-destructive/10 text-destructive";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {capitalizeWords(outcome.replace("-", " "))}
    </span>
  );
}

function progressLabel(tour: Tour): string {
  if (tour.status === "completed" && tour.outcome) return `Completed · ${capitalizeWords(tour.outcome.replace("-", " "))}`;
  if (tour.status === "completed") return "Completed · awaiting outcome";
  if (tour.status === "confirmed") return "Confirmed with lead";
  if (tour.status === "no-show") return "Lead marked as no-show";
  if (tour.status === "cancelled") return "Tour cancelled";
  return "Scheduled and pending confirmation";
}

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}
