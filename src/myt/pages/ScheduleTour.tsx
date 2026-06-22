import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock3, Eye, FileText, MapPin, MessageSquare, PencilLine, UserRound } from "lucide-react";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTime12h } from "@/lib/utils";
import { useAppState } from "@/myt/lib/app-context";
import type { Tour, TourOutcome, TourStatus } from "@/myt/lib/types";

type FilterTab = "all" | "assigned" | "scheduled";

const STATUS_OPTIONS: TourStatus[] = ["scheduled", "confirmed", "completed", "no-show", "cancelled"];
const OUTCOME_OPTIONS: Array<{ value: TourOutcome; label: string }> = [
  { value: null, label: "No outcome yet" },
  { value: "booked", label: "Booked" },
  { value: "token-paid", label: "Token paid" },
  { value: "draft", label: "Draft" },
  { value: "follow-up", label: "Follow-up" },
  { value: "rejected", label: "Rejected" },
  { value: "not-interested", label: "Not interested" },
];

export default function ScheduleTour() {
  const { tours, setTours, currentMemberId } = useAppState();
  const { role, currentTcmId, rescheduleTour, completeTour, cancelTour, updatePostTour, updateTourDetails } = useApp();
  const [tab, setTab] = useState<FilterTab>("all");

  // Use currentMemberId as primary identifier (set for all logged-in users)
  // Fall back to currentTcmId only if currentMemberId is not available (shouldn't happen normally)
  const actorId = currentMemberId || (role === "tcm" ? currentTcmId : null);

  const visibleTours = useMemo(() => {
    if (!actorId) return [];
    const mine = tours.filter((tour) => tour.scheduledBy === actorId || tour.assignedTo === actorId);
    const scoped = mine.filter((tour) => {
      if (tab === "assigned") return tour.assignedTo === actorId;
      if (tab === "scheduled") return tour.scheduledBy === actorId;
      return true;
    });
    const deduped = Array.from(new Map(scoped.map((tour) => [tour.id, tour])).values());
    return deduped.sort((a, b) => {
      const aTs = new Date(`${a.tourDate}T${a.tourTime || "00:00"}`).getTime();
      const bTs = new Date(`${b.tourDate}T${b.tourTime || "00:00"}`).getTime();
      return bTs - aTs;
    });
  }, [actorId, tab, tours]);

  const counts = useMemo(() => {
    if (!actorId) return { all: 0, assigned: 0, scheduled: 0 };
    const dedupedTours = Array.from(new Map(tours.map(t => [t.id, t])).values());
    return {
      all: dedupedTours.filter((tour) => tour.scheduledBy === actorId || tour.assignedTo === actorId).length,
      assigned: dedupedTours.filter((tour) => tour.assignedTo === actorId).length,
      scheduled: dedupedTours.filter((tour) => tour.scheduledBy === actorId).length,
    };
  }, [actorId, tours]);

  const buildScheduledAt = (tourDate: string, tourTime: string) => {
    const value = `${tourDate}T${tourTime || "00:00"}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const handleReschedule = (tourId: string, tourDate: string, tourTime: string) => {
    const scheduledAt = buildScheduledAt(tourDate, tourTime);
    if (!scheduledAt) return;
    updateTour(tourId, { tourDate, tourTime });
    rescheduleTour(tourId, scheduledAt);
  };

  const handleStatusChange = (tourId: string, status: TourStatus) => {
    updateTour(tourId, { status });
    if (status === "completed") completeTour(tourId);
    else if (status === "cancelled") cancelTour(tourId);
    else if (status === "no-show") {
      updateTour(tourId, { status: "no-show", showUp: false });
      void updateTourDetails(tourId, { status: "no-show", showUp: false });
    } else {
      void updateTourDetails(tourId, { status });
    }
  };

  const handleUpdateDetails = (tourId: string, updates: Partial<Tour>) => {
    updateTour(tourId, updates);
    useApp.getState().updateTourDetails(tourId, updates);
  };

  const handleOutcomeChange = (tourId: string, outcome: TourOutcome) => {
    updateTour(tourId, { outcome });
    updatePostTour(tourId, { outcome });
  };

  const updateTour = (tourId: string, updates: Partial<Tour>) => {
    if (updates.remarks !== undefined) {
      updatePostTour(tourId, { objectionNote: updates.remarks });
    }
    setTours((prev) => prev.map((tour) => (tour.id === tourId ? { ...tour, ...updates } : tour)));
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Schedule workspace</span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Scheduled Tours</h1>
          <p className="text-sm text-muted-foreground">
            Track tours you scheduled and tours assigned to you. Assigned members can update progress here.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{counts.all} tours</Badge>
          <Badge variant="outline">{counts.assigned} assigned to you</Badge>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ["all", "All tours", counts.all],
          ["assigned", "Assigned to me", counts.assigned],
          ["scheduled", "Scheduled by me", counts.scheduled],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              tab === value
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{label}</span>
            <span className="text-[10px] font-mono">({count})</span>
          </button>
        ))}
      </div>

      {!actorId ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          We could not detect the active member for this page.
        </div>
      ) : visibleTours.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No tours match this view yet.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleTours.map((tour) => (
            <TourScheduleCard
              key={tour.id}
              actorId={actorId}
              tour={tour}
              onReschedule={handleReschedule}
              onStatusChange={handleStatusChange}
              onOutcomeChange={handleOutcomeChange}
              onUpdate={updateTour}
              onUpdateDetails={handleUpdateDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TourScheduleCard({
  actorId,
  tour,
  onReschedule,
  onStatusChange,
  onOutcomeChange,
  onUpdate,
  onUpdateDetails,
}: {
  actorId: string;
  tour: Tour;
  onReschedule: (tourId: string, tourDate: string, tourTime: string) => void;
  onStatusChange: (tourId: string, status: TourStatus) => void;
  onOutcomeChange: (tourId: string, outcome: TourOutcome) => void;
  onUpdate: (tourId: string, updates: Partial<Tour>) => void;
  onUpdateDetails: (tourId: string, updates: Partial<Tour>) => void;
}) {
  const canEdit = tour.assignedTo === actorId;
  const isSchedulerOnly = tour.scheduledBy === actorId && !canEdit;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
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
          {canEdit ? (
            <Badge className="bg-success/10 text-success hover:bg-success/10">
              <PencilLine className="h-3 w-3 mr-1" /> You can edit this tour
            </Badge>
          ) : (
            <Badge variant="outline">
              <Eye className="h-3 w-3 mr-1" /> Read-only tracker
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Progress"
          value={progressLabel(tour)}
          hint={canEdit ? "Update this as the tour moves forward." : "Follow the assignee's updates here."}
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

      {isSchedulerOnly ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          You scheduled this tour for {tour.assignedToName}. This page is read-only for you, but you can monitor the status, notes, and outcome here as the assignee updates it.
        </div>
      ) : null}

      {canEdit ? (
        <EditableTourPanel
          tour={tour}
          onReschedule={onReschedule}
          onStatusChange={onStatusChange}
          onOutcomeChange={onOutcomeChange}
          onUpdate={onUpdate}
          onUpdateDetails={onUpdateDetails}
        />
      ) : null}
    </section>
  );
}

function EditableTourPanel({
  tour,
  onReschedule,
  onStatusChange,
  onOutcomeChange,
  onUpdate,
  onUpdateDetails,
}: {
  tour: Tour;
  onReschedule: (tourId: string, tourDate: string, tourTime: string) => void;
  onStatusChange: (tourId: string, status: TourStatus) => void;
  onOutcomeChange: (tourId: string, outcome: TourOutcome) => void;
  onUpdate: (tourId: string, updates: Partial<Tour>) => void;
  onUpdateDetails: (tourId: string, updates: Partial<Tour>) => void;
}) {
  const [localDate, setLocalDate] = useState(tour.tourDate);
  const [localTime, setLocalTime] = useState(tour.tourTime);
  const [localStatus, setLocalStatus] = useState<TourStatus>(tour.status);
  const [localShowUp, setLocalShowUp] = useState(tour.showUp);
  const [localOutcome, setLocalOutcome] = useState<TourOutcome>(tour.outcome);
  const [localPropName, setLocalPropName] = useState(tour.propertyName);
  const [localRemarks, setLocalRemarks] = useState(tour.remarks);

  // Keep local state synced if tour updates from elsewhere
  useEffect(() => {
    setLocalDate(tour.tourDate);
    setLocalTime(tour.tourTime);
    setLocalStatus(tour.status);
    setLocalShowUp(tour.showUp);
    setLocalOutcome(tour.outcome);
    setLocalPropName(tour.propertyName);
    setLocalRemarks(tour.remarks);
  }, [tour.tourDate, tour.tourTime, tour.status, tour.showUp, tour.outcome, tour.propertyName, tour.remarks]);

  const handleSave = () => {
    let updatedCount = 0;

    if (localDate !== tour.tourDate || localTime !== tour.tourTime) {
      onReschedule(tour.id, localDate, localTime);
      updatedCount++;
    }

    if (localStatus !== tour.status) {
      onStatusChange(tour.id, localStatus);
      updatedCount++;
    }

    if (localOutcome !== tour.outcome) {
      onOutcomeChange(tour.id, localOutcome);
      updatedCount++;
    }

    const detailsUpdates: Partial<Tour> = {};
    if (localPropName !== tour.propertyName) {
      detailsUpdates.customPropertyName = localPropName;
      detailsUpdates.propertyName = localPropName;
    }
    if (localShowUp !== tour.showUp) {
      detailsUpdates.showUp = localShowUp;
    }
    
    if (Object.keys(detailsUpdates).length > 0) {
      onUpdateDetails(tour.id, detailsUpdates);
      updatedCount++;
    }

    const genericUpdates: Partial<Tour> = {};
    if (localRemarks !== tour.remarks) genericUpdates.remarks = localRemarks;

    if (Object.keys(genericUpdates).length > 0) {
      onUpdate(tour.id, genericUpdates);
      updatedCount++;
    }

    if (updatedCount > 0) {
      toast.success("Tour details updated");
    } else {
      toast("No changes to save");
    }
  };

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="h-4 w-4 text-accent" />
        Tour controls
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`tour-date-${tour.id}`}>Tour date</Label>
          <Input
            id={`tour-date-${tour.id}`}
            type="date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tour-time-${tour.id}`}>Tour time</Label>
          <Input
            id={`tour-time-${tour.id}`}
            type="time"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tour-status-${tour.id}`}>Status</Label>
          <select
            id={`tour-status-${tour.id}`}
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value as TourStatus)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {capitalizeWords(status.replace("-", " "))}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tour-showup-${tour.id}`}>Show-up</Label>
          <select
            id={`tour-showup-${tour.id}`}
            value={localShowUp === true ? "yes" : localShowUp === false ? "no" : "pending"}
            onChange={(e) => setLocalShowUp(e.target.value === "yes" ? true : e.target.value === "no" ? false : null)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="yes">Showed up</option>
            <option value="no">No-show</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tour-outcome-${tour.id}`}>Outcome</Label>
          <select
            id={`tour-outcome-${tour.id}`}
            value={localOutcome ?? "none"}
            onChange={(e) => setLocalOutcome(e.target.value === "none" ? null : e.target.value as TourOutcome)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {OUTCOME_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? "none"}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tour-property-${tour.id}`}>Property</Label>
          <Input
            id={`tour-property-${tour.id}`}
            value={localPropName}
            onChange={(e) => setLocalPropName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`tour-remarks-${tour.id}`}>Progress notes</Label>
        <Textarea
          id={`tour-remarks-${tour.id}`}
          value={localRemarks}
          onChange={(e) => setLocalRemarks(e.target.value)}
          placeholder="Add tour progress, lead feedback, delays, follow-up notes..."
          className="min-h-[110px]"
        />
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Save changes
        </button>
      </div>
    </div>
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

function normalizeStatusUpdate(status: TourStatus, tour: Tour): Partial<Tour> {
  if (status === "confirmed") return { status, showUp: null };
  if (status === "completed") return { status, showUp: true };
  if (status === "no-show") return { status, showUp: false, outcome: tour.outcome === "booked" ? null : tour.outcome };
  if (status === "cancelled") return { status, showUp: null };
  return { status };
}

function normalizeOutcomeUpdate(value: string, tour: Tour): Partial<Tour> {
  const outcome = (value === "none" ? null : value) as TourOutcome;
  if (!outcome) return { outcome: null, tokenPaid: false };
  if (outcome === "booked" || outcome === "token-paid") {
    return { outcome, tokenPaid: true, status: tour.status === "scheduled" ? "completed" : tour.status, showUp: tour.showUp ?? true };
  }
  return { outcome, tokenPaid: false };
}

function showUpValue(showUp: boolean | null): "pending" | "yes" | "no" {
  if (showUp === true) return "yes";
  if (showUp === false) return "no";
  return "pending";
}

function parseShowUpValue(value: string): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}
