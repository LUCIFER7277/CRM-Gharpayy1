import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { ConfidenceBar, IntentChip, StageBadge } from "@/components/atoms";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Flame,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Telescope,
  Moon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import type { Lead, LeadStage } from "@/lib/types";
import { fmtTourScheduleLabel, isTodayIST } from "@/lib/crm10x/dates";
import type { ResolvedLocation } from "@/lib/lead-helpers";
import { useMountedNow } from "@/hooks/use-now";
import { useUserMap } from "@/hooks/useUserMap";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  daysSince,
  formatArea,
  formatBudget,
  formatAssignee,
  formatMoveInLabel,
  resolveBestLeadName,
  resolveLeadLocation,
} from "@/lib/lead-helpers";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads - Gharpayy" },
      {
        name: "description",
        content: "Every lead, ranked by deal probability, one click into the control panel.",
      },
    ],
  }),
  component: LeadsPage,
});

// ─── Stage max-day timers (matches old CRM) ──────────────────────
const STAGE_MAX_DAYS: Record<string, number> = {
  new: 1,
  contacted: 2,
  "tour-scheduled": 2,
  "tour-done": 2,
  negotiation: 5,
  "quote-sent": 3,
  "not-responding-3d": 3,
  "not-responding-7d": 7,
};

type BandKey = "fire" | "stuck" | "active" | "future" | "dormant" | "closed";

interface BandConfig {
  label: string;
  subtitle: string;
  icon: React.ElementType;
  color: string; // text colour token
  bg: string; // header bg token
  ring: string; // border/ring token
  defaultOpen: boolean;
}

const BANDS: Record<BandKey, BandConfig> = {
  fire: {
    label: "🔥 Urgent - Move-in ≤ 7 days",
    subtitle: "Close or lose this week.",
    icon: Flame,
    color: "text-destructive",
    bg: "bg-destructive/10",
    ring: "border-destructive/25",
    defaultOpen: true,
  },
  stuck: {
    label: "🚨 Stuck - Stage Expired",
    subtitle: "Days exceeded. Unblock today.",
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    ring: "border-warning/25",
    defaultOpen: true,
  },
  active: {
    label: "⚡ In Progress",
    subtitle: "Moving. Sorted by move-in date.",
    icon: TrendingUp,
    color: "text-success",
    bg: "bg-success/10",
    ring: "border-success/25",
    defaultOpen: true,
  },
  future: {
    label: "🔭 Future - Move-in 45+ Days",
    subtitle: "Qualified. Set a trigger.",
    icon: Telescope,
    color: "text-info",
    bg: "bg-info/10",
    ring: "border-info/25",
    defaultOpen: false,
  },
  dormant: {
    label: "😴 Dormant - 30+ Days Silent",
    subtitle: "Final attempt then mark lost.",
    icon: Moon,
    color: "text-muted-foreground",
    bg: "bg-muted/60",
    ring: "border-border",
    defaultOpen: false,
  },
  closed: {
    label: "✅ Closed",
    subtitle: "Booked or dropped.",
    icon: CheckCircle2,
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    ring: "border-border",
    defaultOpen: false,
  },
};

const BAND_ORDER: BandKey[] = ["fire", "stuck", "active", "future", "dormant", "closed"];

// ─── Helpers (shared pure logic in lead-helpers.ts) ──────────────
function getBand(l: Lead): BandKey {
  const closed = ["booked", "dropped"];
  if (closed.includes(l.stage)) return "closed";

  const moveInDays = daysUntil(l.moveInDate);
  if (moveInDays !== null && moveInDays >= 0 && moveInDays <= 7) return "fire";
  if (moveInDays !== null && moveInDays < 0) return "fire"; // missed move-in

  // Stuck: stage timer exceeded OR nextFollowUpAt overdue
  const maxDays = STAGE_MAX_DAYS[l.stage];
  const stageAgeDays = daysSince(l.updatedAt) ?? 0;
  if (maxDays && stageAgeDays > maxDays) return "stuck";
  if (l.nextFollowUpAt && (daysUntil(l.nextFollowUpAt) ?? 0) < 0) return "stuck";

  const lastUpdate = daysSince(l.updatedAt) ?? 0;
  if (lastUpdate > 30) return "dormant";
  if (moveInDays !== null && moveInDays > 45) return "future";

  return "active";
}

function getStuckReason(l: Lead): string {
  const maxDays = STAGE_MAX_DAYS[l.stage];
  const stageAgeDays = daysSince(l.updatedAt) ?? 0;
  if (maxDays && stageAgeDays > maxDays) {
    const over = stageAgeDays - maxDays;
    return `${over}d over limit in '${l.stage}'`;
  }
  const fup = l.nextFollowUpAt ? daysUntil(l.nextFollowUpAt) : null;
  if (fup !== null && fup < 0) return `Follow-up ${Math.abs(fup)}d overdue`;
  return "Stage expired";
}

function getMoveInLabel(iso: string | null | undefined): string {
  return formatMoveInLabel(iso);
}

// ─── Page ────────────────────────────────────────────────────────
function LeadsPage() {
  const { leads = [], tours = [], properties = [], selectLead, tcms = [] } = useApp();
  const [, mounted] = useMountedNow();
  const userMap = useUserMap();

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [dateAddedFilter, setDateAddedFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  const memberName = (id: string) => userMap.get(id)?.name || id;

  const addedByOptions = useMemo(() => (Array.from(new Set(leads.map((l) => l.createdBy || "system"))) as string[]).sort(), [leads]);
  const zoneOptions = useMemo(() => (Array.from(new Set(tcms.map(t => t.zone))) as string[]).sort(), [tcms]);
  const [openBands, setOpenBands] = useState<Record<BandKey, boolean>>(
    Object.fromEntries(BAND_ORDER.map((k) => [k, BANDS[k].defaultOpen])) as Record<
      BandKey,
      boolean
    >,
  );

  const toggleBand = (band: BandKey) => setOpenBands((prev) => ({ ...prev, [band]: !prev[band] }));

  // Filter
  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const leadName = l.name || "";
      const leadPhone = l.phone || "";
      if (q && !leadName.toLowerCase().includes(q.toLowerCase()) && !leadPhone.includes(q))
        return false;
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (memberFilter !== "all" && (l.createdBy || "system") !== memberFilter) return false;
      
      if (zoneFilter !== "all") {
        const tcm = tcms.find(t => t.id === l.assignedTcmId);
        if (tcm?.zone !== zoneFilter) return false;
      }

      if (dateAddedFilter !== "all" && l.createdAt) {
        const d = new Date(l.createdAt);
        if (!isNaN(d.getTime())) {
          if (dateAddedFilter === "today" && !isToday(d)) return false;
          if (dateAddedFilter === "yesterday" && !isYesterday(d)) return false;
          if (dateAddedFilter === "this-week" && !isThisWeek(d)) return false;
          if (dateAddedFilter === "this-month" && !isThisMonth(d)) return false;
        } else {
          return false;
        }
      }
      return true;
    });
  }, [leads, q, stageFilter, memberFilter, zoneFilter, dateAddedFilter, tcms]);

  // Today's stats
  const todayLeads = useMemo(() => leads.filter((l) => isTodayIST(l.createdAt)), [leads]);
  const todaySummaryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    todayLeads.forEach(l => {
      const by = l.createdBy || "system";
      counts.set(by, (counts.get(by) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [todayLeads]);

  // Group into bands
  const grouped = useMemo(() => {
    const groups: Record<BandKey, Lead[]> = {
      fire: [],
      stuck: [],
      active: [],
      future: [],
      dormant: [],
      closed: [],
    };
    for (const l of filtered) groups[getBand(l)].push(l);
    // Sort each band by move-in date ascending (nulls last), then leadId as tiebreaker
    for (const band of BAND_ORDER) {
      groups[band].sort((a, b) => {
        const da = a.moveInDate ? new Date(a.moveInDate).getTime() : Infinity;
        const db = b.moveInDate ? new Date(b.moveInDate).getTime() : Infinity;
        return da - db || a.id.localeCompare(b.id);
      });
    }
    return groups;
  }, [filtered]);

  const totalLeads = leads.length;
  const shownLeads = filtered.length;

  const locationMap = useMemo(() => {
    const map = new Map<string, ResolvedLocation>();
    for (const l of filtered) {
      map.set(l.id, resolveLeadLocation(l, tours, properties));
    }
    return map;
  }, [filtered, tours, properties]);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Leads</h1>
            <span className="text-sm text-muted-foreground">
              {shownLeads} of {totalLeads}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone…"
              className="h-9 w-52 text-sm"
            />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(
                  [
                    "new",
                    "contacted",
                    "tour-scheduled",
                    "tour-done",
                    "negotiation",
                    "booked",
                    "dropped",
                    "not-responding-3d",
                    "not-responding-7d",
                  ] as LeadStage[]
                ).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateAddedFilter} onValueChange={setDateAddedFilter}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="Date Added" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Added By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {addedByOptions.map(m => <SelectItem key={m} value={m}>{memberName(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zoneOptions.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Today's Summary */}
        {todayLeads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button 
              onClick={() => { setMemberFilter("all"); setDateAddedFilter("today"); }}
              className="rounded-lg border border-border bg-accent/5 p-3 flex flex-col justify-center text-left hover:bg-accent/10 transition-colors"
            >
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Total Today</div>
              <div className="text-2xl font-semibold text-foreground">{todayLeads.length}</div>
            </button>
            {todaySummaryCounts.slice(0, 5).map(([id, count]) => (
              <button 
                key={id} 
                onClick={() => { setMemberFilter(id); setDateAddedFilter("today"); }}
                className="rounded-lg border border-border bg-card p-3 flex flex-col justify-center text-left hover:bg-muted/50 transition-colors"
              >
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate mb-1 w-full" title={memberName(id)}>
                  {memberName(id)}
                </div>
                <div className="text-xl font-semibold">{count}</div>
              </button>
            ))}
          </div>
        )}

        {/* Band sections */}
        {BAND_ORDER.map((band) => {
          const items = grouped[band];
          if (items.length === 0) return null;
          const cfg = BANDS[band];
          const isOpen = openBands[band];

          return (
            <section
              key={band}
              id={`band-${band}`}
              className={cn("rounded-xl border overflow-hidden", cfg.ring)}
            >
              {/* Section header */}
              <button
                onClick={() => toggleBand(band)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  cfg.bg,
                )}
              >
                <cfg.icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</div>
                  <div className="text-[11px] text-muted-foreground">{cfg.subtitle}</div>
                </div>
                <span
                  className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded-full border",
                    cfg.ring,
                    cfg.color,
                  )}
                >
                  {items.length}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Column headers */}
              {isOpen && (
                <>
                  <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-t border-b border-border bg-muted/20">
                    <div className="col-span-3">Lead · phone</div>
                    <div className="col-span-1">Stage</div>
                    <div className="col-span-2">Created · by</div>
                    <div className="col-span-2">Intent · score</div>
                    <div className="col-span-1">Area · budget</div>
                    <div className="col-span-2">Move-in · assigned</div>
                    <div className="col-span-1 text-right">Updated</div>
                  </div>

                  <div className="divide-y divide-border bg-card">
                    {items.map((l) => {
                      const assigneeName = l.assignedTcmId
                        ? (userMap.get(l.assignedTcmId)?.name ?? null)
                        : null;
                      const moveInLabel = getMoveInLabel(l.moveInDate);
                      const stuckReason = band === "stuck" ? getStuckReason(l) : null;
                      const isFire = band === "fire";
                      const daysToMoveIn = daysUntil(l.moveInDate);
                      const loc = locationMap.get(l.id);

                      return (
                        <button
                          key={l.id}
                          onClick={() => selectLead(l.id)}
                          className="w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors group"
                        >
                          {/* Lead name + phone */}
                          <div className="col-span-3 min-w-0 pr-2">
                            <div className="font-medium text-sm truncate">
                              {resolveBestLeadName(l)}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {l.phone} · {l.source || "Unknown"}
                            </div>
                            {stuckReason && (
                              <div className="text-[10px] text-warning mt-0.5">{stuckReason}</div>
                            )}
                          </div>

                          {/* Stage */}
                          <div className="col-span-1">
                            <StageBadge stage={l.stage} />
                          </div>

                          {/* Created */}
                          <div className="col-span-2 text-xs">
                            <div>{l.createdAt ? fmtTourScheduleLabel(l.createdAt) : "-"}</div>
                            <div className="text-muted-foreground truncate">{memberName(l.createdBy || "system")}</div>
                          </div>

                          {/* Intent + confidence */}
                          <div className="col-span-2 flex items-center gap-2">
                            <IntentChip intent={l.intent} />
                            <ConfidenceBar value={l.confidence} />
                          </div>

                          {/* Area + budget */}
                          <div className="col-span-1 text-xs pr-1">
                            <div className="truncate">{loc?.area ?? formatArea(l)}</div>
                            <div className="text-muted-foreground">{formatBudget(l.budget)}</div>
                          </div>

                          {/* Move-in + assigned */}
                          <div className="col-span-2 text-xs">
                            <div
                              className={cn(
                                "font-medium",
                                isFire && daysToMoveIn !== null && daysToMoveIn <= 3
                                  ? "text-destructive"
                                  : isFire
                                    ? "text-warning"
                                    : "text-foreground",
                              )}
                            >
                              {moveInLabel}
                            </div>
                            <div className="text-muted-foreground truncate">
                              {formatAssignee(l.assignedTcmId, assigneeName)}
                            </div>
                          </div>

                          {/* Updated */}
                          <div className="col-span-1 text-right text-[11px] text-muted-foreground">
                            {mounted && l.updatedAt
                              ? formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true })
                              : "-"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {q || stageFilter !== "all"
              ? "No leads match your filters. Try a different search or stage."
              : "No leads yet. New leads will appear here once assigned."}
          </div>
        )}
      </div>
    </AppShell>
  );
}
