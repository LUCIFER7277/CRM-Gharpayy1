import { type ReactNode, useState, useEffect } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { api } from '@/lib/api/client';
import { useApp } from '@/lib/store';
import { useAuthUser } from '@/lib/auth-store';
import { useOrgMembers } from '@/hooks/useOrgDirectory';
import { formatTime12h, cn } from '@/lib/utils';
import { Tour, TourStatus, TourOutcome } from '@/myt/lib/types';
import { CalendarDays, CheckCircle2, Clock3, Eye, FileText, MapPin, UserRound, Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function AllTours() {
  const { selectLead, leads } = useApp();
  const authUser = useAuthUser(s => s.user);
  const { members } = useOrgMembers();
  const [statusFilter, setStatusFilter] = useState<TourStatus | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<TourOutcome | 'all'>('all');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fetchedTours, setFetchedTours] = useState<Tour[]>([]);

  useEffect(() => {
    api.tours.list({ startDate, endDate }).then(res => {
      setFetchedTours(res.items);
    }).catch(err => {
      console.error("Failed to fetch tours:", err);
    });
  }, [startDate, endDate]);

  // Deduplicate tours to only show the latest tour per lead
  const latestToursMap = new Map<string, Tour>();
  fetchedTours.forEach(t => {
    if (!t.leadId) {
      latestToursMap.set(t.id, t);
      return;
    }
    const existing = latestToursMap.get(t.leadId);
    if (!existing) {
      latestToursMap.set(t.leadId, t);
    } else {
      const existingTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : new Date(`${existing.tourDate}T${existing.tourTime || "00:00"}`).getTime();
      const currentTs = t.updatedAt ? new Date(t.updatedAt).getTime() : new Date(`${t.tourDate}T${t.tourTime || "00:00"}`).getTime();
      if (currentTs > existingTs) {
        latestToursMap.set(t.leadId, t);
      }
    }
  });

  const visibleTours = Array.from(latestToursMap.values()).filter(t => {
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
    // super_admin sees all by default
    return true;
  });

  // Derived metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTours = visibleTours.filter(t => t.tourDate === todayStr);
  const doneTodayTours = todayTours.filter(t => t.status === 'completed');
  const postTourPendingTours = visibleTours.filter(t => t.status === 'completed' && !t.outcome);

  const counts = {
    all: visibleTours.length,
    scheduled: visibleTours.filter(t => t.status === 'scheduled').length,
    confirmed: visibleTours.filter(t => t.status === 'confirmed').length,
    completed: visibleTours.filter(t => t.status === 'completed').length,
    cancelled: visibleTours.filter(t => t.status === 'cancelled').length,
    noShow: visibleTours.filter(t => t.status === 'no-show').length,
  };

  const filtered = visibleTours.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (outcomeFilter !== 'all' && t.outcome !== outcomeFilter) return false;
    return true;
  }).sort((a, b) => {
    const aTs = new Date(`${a.tourDate}T${a.tourTime || "00:00"}`).getTime();
    const bTs = new Date(`${b.tourDate}T${b.tourTime || "00:00"}`).getTime();
    return bTs - aTs;
  });

  return (
    <div className="space-y-6 animate-slide-up bg-background pb-8">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">My Tours</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={counts.all} label="Total" />
        <MetricCard value={todayTours.length} label="Today" />
        <MetricCard value={doneTodayTours.length} label="Done today" />
        <MetricCard value={postTourPendingTours.length} label="Post-tour pending" />
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap gap-2">
          <TabPill label={`All (${counts.all})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <TabPill label={`Scheduled (${counts.scheduled})`} active={statusFilter === 'scheduled'} onClick={() => setStatusFilter('scheduled')} />
          <TabPill label={`Confirmed (${counts.confirmed})`} active={statusFilter === 'confirmed'} onClick={() => setStatusFilter('confirmed')} />
          <TabPill label={`Done (${counts.completed})`} active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} />
          <TabPill label={`Cancelled (${counts.cancelled})`} active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
          <TabPill label={`No-show (${counts.noShow})`} active={statusFilter === 'no-show'} onClick={() => setStatusFilter('no-show')} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatePicker date={startDate} setDate={setStartDate} label="Start Date" />
          <span className="text-muted-foreground text-sm font-medium px-1">to</span>
          <DatePicker date={endDate} setDate={setEndDate} label="End Date" />

          <Select value={outcomeFilter ?? 'all'} onValueChange={(v) => setOutcomeFilter(v === 'all' ? 'all' : v as TourOutcome)}>
            <SelectTrigger className="w-[145px] rounded-full bg-surface-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground border-transparent border focus:ring-1 focus:ring-primary/30 h-[32px] text-sm font-medium">
              <SelectValue placeholder="All Outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="token-paid">Token Paid</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="not-interested">Not Interested</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No tours in this category
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

function MetricCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/50 p-4 flex flex-col items-center justify-center space-y-1 shadow-sm">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[13px] text-muted-foreground">{label}</div>
    </div>
  );
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        active 
          ? "bg-[#f97316] text-white hover:bg-[#ea580c]" 
          : "bg-surface-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function DatePicker({ date, setDate, label }: { date: string; setDate: (d: string) => void; label: string }) {
  const d = date ? new Date(`${date}T00:00:00`) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 w-[135px] rounded-full bg-surface-2 hover:bg-accent/50 border-transparent border focus:ring-1 focus:ring-primary/30 h-[32px] px-3 text-sm font-medium outline-none text-left transition-colors",
            !date ? "text-muted-foreground" : "text-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
          {date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <span>{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={d}
          onSelect={(day) => {
            if (day) {
              const yyyy = day.getFullYear();
              const mm = String(day.getMonth() + 1).padStart(2, '0');
              const dd = String(day.getDate()).padStart(2, '0');
              setDate(`${yyyy}-${mm}-${dd}`);
            } else {
              setDate("");
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
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
          value={capitalizeWords((tour.tourType || "physical").replace("-", " "))}
          hint={`Confirmation: ${capitalizeWords(tour.confirmationStrength || "none")}`}
        />
        <InfoTile
          icon={<FileText className="h-4 w-4" />}
          label="Latest Notes"
          value={tour.remarks?.trim() ? tour.remarks : "No remarks added yet"}
          hint={tour.showUp === null ? "Show-up not marked yet." : tour.showUp ? "Lead marked as showed up." : "Lead marked as no-show."}
        />
      </div>

      {tour.qualification?.keyConcern ? (
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

function StatusPill({ status }: { status?: TourStatus | null }) {
  if (!status) return null;
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

function OutcomePill({ outcome }: { outcome?: TourOutcome | null }) {
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

function capitalizeWords(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}
