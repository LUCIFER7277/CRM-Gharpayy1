import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type MouseEvent } from "react";
import { cn, formatTime12h, localDateISO, tourTimeSlotsForDate } from "@/lib/utils";
import { PGS } from "@/property-genius/data/pgs";
import type { PG } from "@/types/entities";
import { LeadPropertyDossier } from "@/components/impact/LeadPropertyDossier";
import { ImpactHardActionsBar } from "@/components/impact/ImpactHardActionsBar";
import { ImpactApiHealthBanner } from "@/components/impact/ImpactApiHealthBanner";
import { ImpactManagerEscalations } from "@/components/impact/ImpactManagerEscalations";
import { ImpactStageMoveDialog } from "@/components/impact/ImpactStageMoveDialog";
import {
  ImpactFiltersPopover,
  ImpactFocusPopover,
  ImpactQueueMetaBar,
} from "@/components/impact/ImpactQueueHeaderControls";
import {
  COLUMNS,
  type ColumnKey,
  COLUMN_STAGE_TARGET,
  type ImpactEnriched,
} from "@/components/impact/impact-queue-types";
import {
  type QueueChipFilter,
  type ViewMode,
  CHIP_LABELS,
  readStoredView,
  writeStoredView,
  initialChipFilter,
  readOverdueHomeEnabled,
  writeOverdueHomeEnabled,
  markDigestSentToday,
} from "@/lib/crm10x/impact-queue-prefs";
import { isQuoteStale } from "@/lib/crm10x/impact-quote-stale";
import { useDossierReadiness } from "@/lib/crm10x/dossier-readiness";
import { useLeadsSync } from "@/lib/leads-sync";
import { leadHasValidProperty, pickBestPropertyForLead } from "@/lib/crm10x/fix-lead-properties";
import { useAuthUser } from "@/lib/auth-store";
import { useImpactQueueKeyboard } from "@/hooks/useImpactQueueKeyboard";
import { useImpactMorningDigest } from "@/hooks/useImpactMorningDigest";
import {
  memberDisplayName,
  memberOptionLabel,
  memberShortLabel,
  useActiveTcMs,
  useOrgMembers,
} from "@/hooks/useOrgDirectory";
import {
  classifyImpactPriority,
  IMPACT_PRIORITY_META,
  mapNbaToFocusAction,
  type LeadFocusAction,
} from "@/lib/crm10x/impact-hard-actions";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import {
  useQuotationsQuery,
  useSetQuotationStatus,
  formatINR,
  type Quotation,
} from "@/lib/crm10x/quotations";
import { useTcmContacts } from "@/lib/crm10x/tcm-contacts";
import { useLeadInterests, useToggleInterest } from "@/lib/crm10x/lead-interests";
import { useCRM10x } from "@/lib/crm10x/store";
import {
  useCheckin,
  useUpsertCheckin,
  usePatchCheckin,
  STAGE_LABEL,
  riskLevel,
  RISK_CLASS,
  RISK_LABEL,
  type CheckIn,
} from "@/lib/checkins/store";
import type { ActivityLog, Lead, Property, TCM, Tour } from "@/lib/types";
import {
  resolvePropertyById,
  searchPropertyCatalog,
  allCatalogProperties,
  type CatalogProperty,
} from "@/lib/crm10x/property-catalog";
import { searchPGs } from "@/property-genius/lib/search";
import { fmtTourScheduleLabel, isTodayIST } from "@/lib/crm10x/dates";
import {
  classifyTourBand,
  TOUR_BAND_META,
  TOUR_BAND_ORDER,
  tourTimeHint as buildTourTimeHint,
  type TourQueueBand,
} from "@/lib/crm10x/tour-queue-bands";
import {
  IMPACT_TEMPLATES,
  renderImpactTemplate,
  type ImpactScenario,
  type ImpactTpl,
  type ImpactTplCtx,
} from "@/lib/crm10x/impact-templates";
import {
  scoreLead,
  computeNBA,
  pressureColor,
  intentChip,
  type NextBestAction,
} from "@/lib/crm10x/impact-scoring";
import { QuotationBuilder } from "@/components/crm10x/QuotationBuilder";
import { SmartDossier } from "@/components/crm10x/SmartDossier";
import { CheckInPanel } from "@/components/checkins/CheckInPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { dispatch } from "@/lib/api/command-bus";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  FileText,
  LayoutGrid,
  ListOrdered,
  Phone,
  Plus,
  Search,
  Sparkles,
  Target,
  Timer,
  UserCheck,
  Wallet,
  Zap,
  Beaker,
  X,
  Heart,
  Star,
  Activity,
  Sunrise,
  MapPin,
  RotateCcw,
  KeyRound,
  ScrollText,
  Building2,
  Video,
  Briefcase,
  Info,
  MoreHorizontal,
  AlertTriangle,
  MessageSquareCode,
  ArchiveX,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";
import { useAuditLog } from "@/lib/crm10x/audit-log";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { LeadPasteParser } from "@/components/leads/LeadPasteParser";
import {
  hasCapturedLeadName,
  pickRelevantActiveTour,
  resolveBestLeadName,
  profileCompletionScore,
} from "@/lib/lead-helpers";

/* ================================================================== */
/*  Impact Queue — 10x                                                 */
/*  Priority Stack + Stage Board · Live counters · NBA per card        */
/*  Multi-variant templates · Negotiation playbook · Direct book       */
/* ================================================================== */

function todayISO() {
  return localDateISO();
}
const TOUR_TYPES = [
  { value: "physical", label: "Physical", icon: Building2 },
  { value: "virtual", label: "Virtual", icon: Video },
  { value: "pre-book-pitch", label: "Pre-book", icon: Briefcase },
] as const;
const TOUR_TYPE_LABELS = Object.fromEntries(
  TOUR_TYPES.map((item) => [item.value, item.label]),
) as Record<string, string>;
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();
  if (digits.startsWith("91") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return raw.trim().startsWith("+") ? raw.trim() : `+${digits}`;
}
function phonesMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "").slice(-10);
  const db = b.replace(/\D/g, "").slice(-10);
  return da.length >= 10 && da === db;
}

const COLUMN_HELP: Record<ColumnKey, string> = {
  inbox: "New/contacted leads without an active tour or quote appear here.",
  scheduled: "Tours that are scheduled and need confirmation or preparation.",
  onTour: "Tours happening today or currently in progress.",
  quoted: "Leads where a quote has been sent and payment/follow-up is pending.",
  booked: "Leads converted to booking.",
};

const COLUMN_HEADER_TONE: Record<ColumnKey, string> = {
  inbox: "border-info/35 bg-info/5 text-info",
  scheduled: "border-accent/35 bg-accent/5 text-accent",
  onTour: "border-warning/40 bg-warning/5 text-warning",
  quoted: "border-primary/35 bg-primary/5 text-primary",
  booked: "border-success/40 bg-success/5 text-success",
};
function isToday(iso: string) {
  return isTodayIST(iso);
}
function isThisWeek(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  const diff = (+n - +d) / 86_400_000;
  return diff >= 0 && diff <= 7;
}
function isThisMonth(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function fmtTime(iso: string) {
  const d = parseInstant(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
function fmtWhen(iso: string) {
  const d = parseInstant(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = parseInstant(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
function fmtRel(iso: string, nowMs: number) {
  const d = parseInstant(iso);
  if (!d) return "—";
  const ms = +d - nowMs;
  const m = Math.round(ms / 60000);
  if (Math.abs(m) < 60) return `${m > 0 ? "in " : ""}${Math.abs(m)}m${m < 0 ? " ago" : ""}`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return `${h > 0 ? "in " : ""}${Math.abs(h)}h${h < 0 ? " ago" : ""}`;
  return fmtWhen(iso);
}
function fmtActivityTime(iso: string) {
  const d = parseInstant(iso);
  if (!d) return "—";
  const now = Date.now();
  const diff = now - +d;
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes || 1} min ago`;
  if (d.toDateString() === new Date().toDateString()) return `Today ${fmtTime(iso)}`;
  return fmtWhen(iso);
}

function normalizeQueueLead(lead: Lead): Lead {
  return {
    ...lead,
    name: resolveBestLeadName(lead),
    phone: lead.phone?.trim() || "No phone",
    preferredArea: lead.preferredArea?.trim() || "Area TBD",
    moveInDate:
      lead.moveInDate && !Number.isNaN(new Date(lead.moveInDate).getTime())
        ? lead.moveInDate
        : new Date().toISOString(),
  };
}

function shouldShowInImpactQueue(lead: Lead, tours: Tour[], quotes: Quotation[]): boolean {
  if (lead.stage === "dropped") return false;
  if (!hasCapturedLeadName(lead)) return false;

  const leadTours = tours.filter((tour) => tour.leadId === lead.id);
  return true;
}

export function drawerTabForLeadFocusAction(action?: LeadFocusAction | null) {
  if (action === "quote") return "quote";
  if (action === "negotiate") return "negotiation";
  if (action === "schedule") return "tour";
  if (action === "checkin") return "checkin";
  return "impact";
}

export function useImpactStateForLead(leadInput?: Lead | null) {
  const tours = useApp((s) => s.tours);
  const opsProperties = useApp((s) => s.properties);
  const fallbackTcms = useApp((s) => s.tcms);
  const { tcms: activeTcms } = useActiveTcMs();
  const tcmOptions = activeTcms.length > 0 ? activeTcms : fallbackTcms;
  const { data: leadQuotes = [] } = useQuotationsQuery(leadInput?.id);

  return useMemo(() => {
    if (!leadInput) return null;
    const lead = normalizeQueueLead(leadInput);
    const leadTours = tours
      .filter((t) => t.leadId === lead.id)
      .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    const openTour = pickRelevantActiveTour(leadTours);
    const lastQuote = [...leadQuotes]
      .filter((q) => q.leadId === lead.id)
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];

    let column: ColumnKey = "inbox";
    if (lead.stage === "booked") column = "booked";
    else if (lead.stage === "quote-sent" || lead.stage === "negotiation") column = "quoted";
    else if (lastQuote && (lastQuote.status === "sent" || lastQuote.status === "paid"))
      column = "quoted";
    else if (openTour && isToday(openTour.scheduledAt)) column = "onTour";
    else if (
      openTour ||
      lead.stage === "tour-scheduled" ||
      lead.stage === "on-tour" ||
      lead.stage === "tour-done"
    )
      column = "scheduled";

    const nba = computeNBA(lead, openTour, lastQuote);
    const { score } = scoreLead(lead, openTour, lastQuote);
    const catalogProperty = openTour
      ? resolvePropertyById(openTour.propertyId, opsProperties)
      : undefined;
    const tcm = tcmOptions.find((candidate) => candidate.id === lead.assignedTcmId);

    return {
      lead,
      openTour,
      lastQuote,
      nba,
      score,
      column,
      catalogProperty,
      opsProperties,
      tcm,
      tcmOptions,
    };
  }, [leadInput, leadQuotes, opsProperties, tcmOptions, tours]);
}

async function copyText(text: string, label = "Copied — paste in WhatsApp") {
  try {
    await navigator.clipboard?.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed");
  }
}

const actionButtonClass =
  "transition-colors hover:bg-accent/10 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function isValidPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}

function parsePastedText(text: string): { name?: string; phone?: string; location?: string } {
  const phone = text.match(/\b[6-9]\d{9}\b/)?.[0];
  const words = text
    .replace(phone ?? "", "")
    .trim()
    .split(/\s+/);
  const locationKeywords = [
    "koramangala",
    "bellandur",
    "hsr",
    "whitefield",
    "indiranagar",
    "marathahalli",
    "btm",
    "hebbal",
    "electronic city",
    "jayanagar",
    "jp nagar",
    "yelahanka",
    "sarjapur",
    "bannerghatta",
  ];
  const location = words.find((w) => locationKeywords.some((k) => w.toLowerCase().includes(k)));
  const name = words
    .filter((w) => w !== location && !/\d/.test(w))
    .slice(0, 2)
    .join(" ");
  return {
    name: name || undefined,
    phone: phone || undefined,
    location: location || undefined,
  };
}

/* ------------------------------------------------------------------ */

export function ImpactQueue() {
  const { role, currentTcmId, tcms, leads, tours, properties, bookings } = useApp();
  const selectLead = useApp((s) => s.selectLead);
  const selectedLeadId = useApp((s) => s.selectedLeadId);
  const authUser = useAuthUser((s) => s.user);
  const canSelectTcmScope =
    authUser?.role === "super_admin" || authUser?.role === "manager" || authUser?.role === "admin";
  const selfScopeId = authUser?.id || currentTcmId;
  const { tcms: activeTcms } = useActiveTcMs();
  const { members: orgMembers } = useOrgMembers();
  const tcmOptions = useMemo(() => {
    const fromActive = activeTcms.map((t: any) => ({
      ...t,
      name: t.fullName ?? t.name,
      zones: t.zones ?? (t.zone ? [t.zone] : []),
    }));
    const fromDirectory = orgMembers
      .filter((m) => m.role === "member" || m.role === "tcm")
      .map((m: any) => ({
        ...m,
        name: m.fullName ?? m.name,
        zones: m.zones ?? [],
      }));
    const fromLegacy = tcms.map((t: any) => ({
      ...t,
      name: t.fullName ?? t.name,
      zones: t.zones ?? (t.zone ? [t.zone] : []),
    }));
    const byId = new Map<string, any>();
    [...fromActive, ...fromDirectory, ...fromLegacy].forEach((member) => {
      if (member?.id) byId.set(member.id, member);
    });
    return Array.from(byId.values()).sort((a, b) => tmName(a).localeCompare(tmName(b)));
  }, [activeTcms, orgMembers, tcms]);
  const memberScopeOptions = useMemo(() => {
    const normalize = (zones?: string[]) =>
      (zones ?? []).map((z) => String(z).trim().toLowerCase()).filter(Boolean);

    const myZones = new Set(normalize(authUser?.zones));
    const isAdminScoped = authUser?.role === "admin";

    const fromDirectory = orgMembers
      .filter((m) => m.role === "member" || m.role === "tcm")
      .filter((m) => {
        if (!isAdminScoped) return true;
        const memberZones = normalize(m.zones);
        const sameZone = memberZones.some((z) => myZones.has(z));
        const reportsToMe = Boolean(authUser?.id) && m.adminId === authUser.id;
        return sameZone || reportsToMe;
      })
      .map((m) => ({ id: m.id, name: m.name }));
    if (fromDirectory.length > 0) {
      return Array.from(new Map(fromDirectory.map((m) => [m.id, m])).values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }
    return tcmOptions
      .filter((t: any) => {
        if (!isAdminScoped) return true;
        const zones = normalize(Array.isArray(t.zones) ? t.zones : t.zone ? [t.zone] : []);
        return zones.some((z) => myZones.has(z));
      })
      .map((t: any) => ({
        id: t.id,
        name: t.fullName ?? t.name,
        zones: t.zones ?? (t.zone ? [t.zone] : []),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, tcmOptions, authUser?.role, authUser?.zones, authUser?.id]);
  const setLeadStage = useApp((s) => s.setLeadStage);
  const cancelTour = useApp((s) => s.cancelTour);
  const markTourStarted = useApp((s) => s.markTourStarted);
  const leadsSyncStatus = useLeadsSync((s) => s.status);
  const { data: quotes = [] } = useQuotationsQuery();

  const profiles = useCRM10x((s) => s.profiles);
  const allCalls = useCRM10x((s) => s.calls);
  const allObjections = useCRM10x((s) => s.objections);
  const [tcmFilter, setTcmFilter] = useState<string>(role === "tcm" ? currentTcmId : "all");
  const [query, setQuery] = useState("");
  const [chipFilter, setChipFilter] = useState<QueueChipFilter>(() => initialChipFilter(role));
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [needFilter, setNeedFilter] = useState<string>("all");
  const [actionRequiredFilter, setActionRequiredFilter] = useState<string[]>([]);
  const [qualificationFilter, setQualificationFilter] = useState<string[]>([]);
  const [moveInFilter, setMoveInFilter] = useState<string[]>([]);
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<string[]>([]);
  const [objectionsFilter, setObjectionsFilter] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);
  const [focusAction, setFocusAction] = useState<LeadFocusAction | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [digestOpen, setDigestOpen] = useState(false);
  const [overdueHome, setOverdueHome] = useState(readOverdueHomeEnabled);
  const [droppedSheetOpen, setDroppedSheetOpen] = useState(false);
  const [messageLabOpen, setMessageLabOpen] = useState(false);

  useEffect(() => {
    writeStoredView(view);
  }, [view]);

  useImpactMorningDigest(() => setDigestOpen(true));

  useEffect(() => {
    if (!canSelectTcmScope && selfScopeId && tcmFilter !== selfScopeId) {
      setTcmFilter(selfScopeId);
    }
  }, [canSelectTcmScope, selfScopeId, tcmFilter]);

  useEffect(() => {
    if (!canSelectTcmScope) return;
    if (tcmFilter === "all") return;
    if (!memberScopeOptions.some((m) => m.id === tcmFilter)) {
      setTcmFilter("all");
    }
  }, [canSelectTcmScope, memberScopeOptions, tcmFilter]);

  const [fixing, setFixing] = useState(false);
  const handleFixProperties = async () => {
    setFixing(true);
    const allLeads = useApp.getState().leads;
    const invalid = allLeads.filter((l) => !leadHasValidProperty(l));
    if (invalid.length === 0) {
      toast.success("All leads already have valid properties");
      setFixing(false);
      return;
    }
    let fixed = 0;
    for (const lead of invalid) {
      const { area } = pickBestPropertyForLead(lead);
      const result = await dispatch({
        _id: `c-${Math.random().toString(36).slice(2, 14)}`,
        type: "cmd.lead.update",
        issuedAt: new Date().toISOString(),
        payload: { leadId: lead.id, patch: { preferredArea: area } },
      });
      if (result.ok) fixed++;
    }
    toast.success(`Fixed ${fixed}/${invalid.length} leads — properties match Property Hub`);
    setFixing(false);
  };

  useEffect(() => {
    if (leads.length > 0 || leadsSyncStatus === "ready") setBooting(false);
  }, [leads.length, leadsSyncStatus]);

  useEffect(() => {
    if (leadsSyncStatus === "error") setBooting(false);
  }, [leadsSyncStatus]);

  useEffect(() => {
    const id = window.setTimeout(() => setBooting(false), 3000);
    return () => window.clearTimeout(id);
  }, []);

  /* --------- 10x live tick: re-rank every 60s --------- */
  // Start at 0 on SSR + first client render to avoid hydration mismatches.
  const [tick, setTick] = useState(0);
  const [lastRerank, setLastRerank] = useState<number>(0);
  useEffect(() => {
    setLastRerank(Date.now());
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setLastRerank(Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  /* --------- per-lead enrichment (NBA + score) --------- */
  type Enriched = {
    lead: Lead;
    openTour?: Tour;
    lastQuote?: Quotation;
    nba: NextBestAction;
    score: number;
    column: ColumnKey;
    tourBand?: TourQueueBand;
    tourTimeHint?: string;
  };

  const enriched: Enriched[] = useMemo(() => {
    const at = typeof window !== "undefined" ? Date.now() : 0;
    const inScope = (lead: Lead) => {
      if (tcmFilter === "all") return true;
      const assignedTo = (lead.assignedTcmId || lead.assigneeId || "").trim();
      if (assignedTo) return assignedTo === tcmFilter;
      return canSelectTcmScope;
    };
    const tFilter = (lead: Lead) =>
      inScope(lead) &&
      (!query.trim() ||
        lead.name.toLowerCase().includes(query.toLowerCase()) ||
        lead.phone.includes(query));

    return leads
      .filter((lead) => shouldShowInImpactQueue(lead, tours, quotes))
      .filter(tFilter)
      .map((rawLead) => {
        const lead = normalizeQueueLead(rawLead);
        const ts = tours
          .filter((t) => t.leadId === lead.id)
          .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
        const openTour = pickRelevantActiveTour(ts, at);
        const lastQuote = quotes
          .filter((q) => q.leadId === lead.id)
          .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];

        let column: ColumnKey = "inbox";
        if (lead.stage === "booked") column = "booked";
        else if (lead.stage === "quote-sent" || lead.stage === "negotiation") column = "quoted";
        else if (lastQuote && (lastQuote.status === "sent" || lastQuote.status === "paid"))
          column = "quoted";
        else if (openTour && isToday(openTour.scheduledAt)) column = "onTour";
        else if (
          openTour ||
          lead.stage === "tour-scheduled" ||
          lead.stage === "on-tour" ||
          lead.stage === "tour-done"
        )
          column = "scheduled";

        const nba = computeNBA(lead, openTour, lastQuote);
        const { score } = scoreLead(lead, openTour, lastQuote);
        const tourBand =
          column === "scheduled" || column === "onTour"
            ? classifyTourBand(column, openTour, lead, nba, at)
            : undefined;
        const tourTimeHint =
          openTour && (column === "scheduled" || column === "onTour")
            ? (buildTourTimeHint(openTour, at) ?? undefined)
            : undefined;
        return { lead, openTour, lastQuote, nba, score, column, tourBand, tourTimeHint };
      });
  }, [leads, tours, quotes, tcmFilter, query, tick, canSelectTcmScope]);

  /* Auto-promote tour-scheduled → on-tour when tour day is today (IST). */
  const autoPromotedRef = useRef(new Set<string>());
  useEffect(() => {
    const due = leads.filter((lead) => {
      if (lead.stage === "on-tour" || autoPromotedRef.current.has(lead.id)) return false;
      const openTour = tours.find(
        (t) => t.leadId === lead.id && (t.status === "scheduled" || t.status === "confirmed"),
      );
      return openTour && isTodayIST(openTour.scheduledAt);
    });
    for (const lead of due) {
      const tour = tours.find(
        (t) => t.leadId === lead.id && (t.status === "scheduled" || t.status === "confirmed"),
      );
      if (!tour) continue;
      autoPromotedRef.current.add(lead.id);
      void markTourStarted(tour.id).catch(() => {
        autoPromotedRef.current.delete(lead.id);
      });
    }
  }, [leads, tours, tick, markTourStarted]);

  /* --------- filter chips --------- */
  const uniqueAreas = useMemo(() => {
    const s = new Set<string>();
    for (const e of enriched) {
      if (e.lead.preferredArea) s.add(e.lead.preferredArea);
      if (e.lead.areas) e.lead.areas.forEach((a) => s.add(a));
    }
    return Array.from(s).filter(Boolean).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    const at = Date.now();
    return enriched.filter((e) => {
      if (chipFilter === "hot" && e.lead.intent !== "hot") return false;
      if (chipFilter === "warm" && e.lead.intent !== "warm") return false;
      if (chipFilter === "cold" && e.lead.intent !== "cold") return false;
      if (chipFilter === "overdue" && e.nba.pressure !== "escalate") return false;
      if (chipFilter === "tour-today" && !(e.openTour && isToday(e.openTour.scheduledAt)))
        return false;
      if (chipFilter === "quote-pending" && e.lastQuote?.status !== "sent") return false;
      if (e.lead.stage === "dropped") return false;

      if (
        areaFilter !== "all" &&
        e.lead.preferredArea?.toLowerCase() !== areaFilter.toLowerCase() &&
        !e.lead.areas?.map((a) => a.toLowerCase()).includes(areaFilter.toLowerCase())
      )
        return false;
      if (typeFilter !== "all" && e.lead.type?.toLowerCase() !== typeFilter.toLowerCase())
        return false;
      if (roomFilter !== "all" && e.lead.room?.toLowerCase() !== roomFilter.toLowerCase())
        return false;
      if (needFilter !== "all" && e.lead.need?.toLowerCase() !== needFilter.toLowerCase())
        return false;

      if (assignmentFilter.length > 0) {
        if (assignmentFilter.includes("assigned-to-me")) {
          const assignedTo = (e.lead.assignedTcmId || e.lead.assigneeId || "").trim();
          if (assignedTo !== selfScopeId) return false;
        }
      }

      if (actionRequiredFilter.length > 0) {
        let pass = false;
        if (actionRequiredFilter.includes("no-next-action")) {
          const hasTour = e.openTour && (e.openTour.status === "scheduled" || e.openTour.status === "confirmed");
          const hasQuote = e.lastQuote && e.lastQuote.status === "sent";
          const hasFollowup = e.lead.nextFollowUpAt && new Date(e.lead.nextFollowUpAt).getTime() > at;
          if (!hasTour && !hasQuote && !hasFollowup && e.lead.stage !== "booked") pass = true;
        }
        if (actionRequiredFilter.includes("no-activity-24h")) {
          const lastActivityMs = e.lead.lastContactAt ? new Date(e.lead.lastContactAt).getTime() : 0;
          if (at - lastActivityMs > 24 * 60 * 60 * 1000) pass = true;
        }
        if (actionRequiredFilter.includes("no-activity-48h")) {
          const lastActivityMs = e.lead.lastContactAt ? new Date(e.lead.lastContactAt).getTime() : 0;
          if (at - lastActivityMs > 48 * 60 * 60 * 1000) pass = true;
        }
        if (actionRequiredFilter.includes("never-called")) {
          const called = allCalls.some(c => c.leadId === e.lead.id);
          if (!called) pass = true;
        }
        if (!pass) return false;
      }

      if (qualificationFilter.length > 0) {
        let pass = false;
        const p = profiles[e.lead.id];
        const score = profileCompletionScore(p as any);
        if (qualificationFilter.includes("profile-complete") && score >= 80) pass = true;
        if (qualificationFilter.includes("profile-incomplete") && score < 80) pass = true;
        if (qualificationFilter.includes("budget-verified") && p?.verifiedBudget) pass = true;
        if (qualificationFilter.includes("budget-unverified") && !p?.verifiedBudget) pass = true;
        if (!pass) return false;
      }

      if (moveInFilter.length > 0) {
        let pass = false;
        if (e.lead.moveInDate) {
           const d = new Date(e.lead.moveInDate).getTime();
           if (!Number.isNaN(d)) {
             const days = (d - at) / (1000 * 60 * 60 * 24);
             if (moveInFilter.includes("movein-0-7") && days >= 0 && days <= 7) pass = true;
             if (moveInFilter.includes("movein-8-15") && days > 7 && days <= 15) pass = true;
             if (moveInFilter.includes("movein-16-30") && days > 15 && days <= 30) pass = true;
           }
        }
        if (!pass) return false;
      }

      if (propertyStatusFilter.length > 0) {
         let pass = false;
         const selType = (e.lead as any).qualification?.propertySelection?.type || (e.lead as any).propertySelection?.type;
         if (propertyStatusFilter.includes("property-selected") && selType === "hub") pass = true;
         if (propertyStatusFilter.includes("property-not-selected") && !selType) pass = true;
         if (propertyStatusFilter.includes("other-property") && selType === "other") pass = true;
         if (!pass) return false;
      }

      if (objectionsFilter.length > 0) {
         let pass = false;
         const leadObjections = allObjections.filter(o => o.leadId === e.lead.id);
         for (const reqCode of objectionsFilter) {
           if (reqCode === "other") {
             if (leadObjections.some(o => !["food-not-available", "price-too-high", "location-not-suitable", "room-too-small", "needs-family-approval"].includes(o.code))) pass = true;
           } else {
             if (leadObjections.some(o => o.code === reqCode)) pass = true;
           }
         }
         if (!pass) return false;
      }

      return true;
    });
  }, [enriched, chipFilter, areaFilter, typeFilter, roomFilter, needFilter, actionRequiredFilter, qualificationFilter, moveInFilter, propertyStatusFilter, objectionsFilter, assignmentFilter, allCalls, profiles, allObjections, selfScopeId]);

  const stackSorted = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.score - a.score);
    if (stageFilter === "all") return sorted;
    return sorted.filter((e) => e.column === stageFilter);
  }, [filtered, stageFilter]);

  const boardBuckets = useMemo(() => {
    const b: Record<ColumnKey, ImpactEnriched[]> = {
      inbox: [],
      scheduled: [],
      onTour: [],
      quoted: [],
      booked: [],
    };
    filtered.forEach((e) => b[e.column].push(e));
    const at = Date.now();
    (["scheduled", "onTour"] as const).forEach((key) => {
      b[key].sort((a, bb) => {
        const bandA = a.tourBand ?? classifyTourBand(key, a.openTour, a.lead, a.nba, at);
        const bandB = bb.tourBand ?? classifyTourBand(key, bb.openTour, bb.lead, bb.nba, at);
        const orderA = TOUR_BAND_ORDER.indexOf(bandA);
        const orderB = TOUR_BAND_ORDER.indexOf(bandB);
        if (orderA !== orderB) return orderA - orderB;
        const ta = a.openTour ? +new Date(a.openTour.scheduledAt) : Infinity;
        const tb = bb.openTour ? +new Date(bb.openTour.scheduledAt) : Infinity;
        return ta - tb;
      });
    });
    (["inbox", "quoted", "booked"] as ColumnKey[]).forEach((key) => {
      b[key].sort((a, bb) => bb.score - a.score);
    });
    return b;
  }, [filtered, tick]);

  /* --------- live counters --------- */
  const counters = useMemo(() => {
    const safeTours = tours ?? [];
    const safeQuotes = quotes ?? [];
    const safeBookings = bookings ?? [];
    const safeLeads = leads ?? [];

    const scopedTours =
      tcmFilter === "all" ? safeTours : safeTours.filter((t) => t.tcmId === tcmFilter);
    const scopedQuotes =
      tcmFilter === "all" ? safeQuotes : safeQuotes.filter((q) => q.tcmId === tcmFilter);
    const scopedBookings =
      tcmFilter === "all" ? safeBookings : safeBookings.filter((b) => b.tcmId === tcmFilter);
    const scopedLeads =
      tcmFilter === "all"
        ? safeLeads
        : safeLeads.filter((l) => {
            const assignedTo = (l.assignedTcmId || l.assigneeId || "").trim();
            if (assignedTo) return assignedTo === tcmFilter;
            return canSelectTcmScope;
          });

    const toursScheduledToday = scopedTours.filter((t) => isToday(t.scheduledAt)).length;
    const toursCompletedToday = scopedTours.filter(
      (t) => t.status === "completed" && isToday(t.updatedAt),
    ).length;
    const toursToday = toursScheduledToday + toursCompletedToday;
    const quotesToday = scopedQuotes.filter((q) => isToday(q.sentAt)).length;
    const bookingsMonth = scopedBookings.filter((b) => isThisMonth(b.ts)).length;
    const leadsToday = scopedLeads.filter((l) => isToday(l.createdAt)).length;

    return { toursToday, quotesToday, bookingsMonth, leadsToday };
  }, [tours, quotes, bookings, leads, tcmFilter, canSelectTcmScope]);

  const quotesToday = useMemo(() => {
    const scoped = tcmFilter === "all" ? quotes : quotes.filter((q) => q.tcmId === tcmFilter);
    return scoped
      .filter((q) => isToday(q.sentAt))
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
  }, [quotes, tcmFilter]);

  // Visible targets — tweak as the BBD target evolves.
  const targets = { leadsToday: 40, toursToday: 10, quotesToday: 10, bookingsMonth: 45 };
  const tone = (got: number, target: number) =>
    got >= target
      ? "text-success border-success/30 bg-success/10"
      : got >= target * 0.5
        ? "text-warning border-warning/30 bg-warning/10"
        : "text-danger border-danger/30 bg-danger/10";

  const escalations = stackSorted.filter((e) => e.nba.pressure === "escalate").length;

  const leadIdsOrdered = useMemo(() => stackSorted.map((e) => e.lead.id), [stackSorted]);

  useEffect(() => {
    if (!selectedLeadId || leadIdsOrdered.length <= 1) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable
      )
        return;
      const currentIndex = leadIdsOrdered.indexOf(selectedLeadId);
      if (currentIndex < 0) return;
      const nextIndex =
        event.key === "ArrowRight"
          ? Math.min(currentIndex + 1, leadIdsOrdered.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex === currentIndex) return;
      event.preventDefault();
      selectLead(leadIdsOrdered[nextIndex]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLeadId, leadIdsOrdered, selectLead]);

  const { focusLeadId: keyboardLeadId } = useImpactQueueKeyboard({
    leadIds: leadIdsOrdered,
    enabled: view === "stack" && !focusLeadId,
    onOpenLead: (id) => {
      setFocusLeadId(id);
      setFocusAction("auto");
    },
  });

  const unassignedLeads = useMemo(
    () => leads.filter((l) => !l.assignedTcmId?.trim()).length,
    [leads],
  );

  return (
    <div className="space-y-3">
      <ImpactApiHealthBanner />

      {/* ---------------- Command deck ---------------- */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Row 1: heading left | controls right */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-1">
          <h1 className="text-xl font-display font-bold shrink-0">Impact Queue</h1>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <TenXCommandBar
              lastRerank={lastRerank}
              escalations={escalations}
              counters={counters}
              targets={targets}
              stackSorted={stackSorted}
              tick={tick}
              digestOpen={digestOpen}
              onDigestOpenChange={setDigestOpen}
              onFocusLead={(leadId) => {
                setFocusLeadId(leadId);
                setFocusAction("auto");
              }}
            />
            <QuickAddLead
              defaultTcmId={tcmFilter !== "all" ? tcmFilter : currentTcmId}
              open={quickAddOpen}
              onOpenChange={setQuickAddOpen}
              tcmOptions={tcmOptions}
              onLeadSaved={() => {
                setChipFilter("all");
                setQuery("");
                setView("board");
              }}
            />
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className={`h-8 pl-7 text-[11px] w-48 sm:w-56 bg-background ${query.trim() ? "pr-7" : ""}`}
                placeholder="Search lead or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ImpactFiltersPopover
              filters={{
                chip: chipFilter,
                area: areaFilter,
                type: typeFilter,
                room: roomFilter,
                need: needFilter,
                actionRequired: actionRequiredFilter,
                qualification: qualificationFilter,
                moveIn: moveInFilter,
                propertyStatus: propertyStatusFilter,
                objections: objectionsFilter,
                assignment: assignmentFilter,
              }}
              uniqueAreas={uniqueAreas}
              onApply={(next) => {
                setChipFilter(next.chip);
                setAreaFilter(next.area);
                setTypeFilter(next.type);
                setRoomFilter(next.room);
                setNeedFilter(next.need);
                setActionRequiredFilter(next.actionRequired);
                setQualificationFilter(next.qualification);
                setMoveInFilter(next.moveIn);
                setPropertyStatusFilter(next.propertyStatus);
                setObjectionsFilter(next.objections);
                setAssignmentFilter(next.assignment);
              }}
              onOpenMessageLab={() => setMessageLabOpen(true)}
            />
            <ImpactFocusPopover
              tcmFilter={tcmFilter}
              tcmOptions={tcmOptions}
              onFilterArea={(area) => setAreaFilter(area)}
            />
            {!canSelectTcmScope ? (
              <div className="h-8 min-w-[8rem] rounded-md border border-border bg-background px-3 py-2 text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                {(() => {
                  const me = tcmOptions.find((t: any) => t.id === selfScopeId);
                  const name =
                    (me as any)?.fullName ?? (me as any)?.name ?? authUser?.fullName ?? "My queue";
                  const zone = (me as any)?.zones?.[0] ?? (me as any)?.zone ?? "";
                  return zone ? (
                    <>
                      <span>{name}</span>
                      <span className="text-muted-foreground font-normal">· {zone}</span>
                    </>
                  ) : (
                    name
                  );
                })()}
              </div>
            ) : (
              <Select value={tcmFilter} onValueChange={setTcmFilter}>
                <SelectTrigger className="h-8 text-[11px] w-40 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[11px]">
                    All Members
                  </SelectItem>
                  {memberScopeOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[11px]">
                      {memberOptionLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex rounded-md border border-border overflow-hidden bg-background">
              <button
                className={`h-8 px-2 text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1 ${view === "stack" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                onClick={() => setView("stack")}
              >
                <ListOrdered className="h-3 w-3" /> Stack
              </button>
              <button
                className={`h-8 px-2 text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1 ${view === "board" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                onClick={() => setView("board")}
              >
                <LayoutGrid className="h-3 w-3" /> Board
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: subtitle */}
        <div className="px-4 pb-2.5">
          <p className="text-[11px] text-muted-foreground">
            One Screen Conversion Engine (Lead → Booked)
          </p>
        </div>

        <div className="border-t border-border/70 px-3 py-2 bg-muted/10">
          <ImpactHardActionsBar
            enriched={stackSorted}
            onPickLead={(leadId, _name, action) => {
              selectLead(leadId, drawerTabForLeadFocusAction(action), action);
              setFocusLeadId(null);
              setFocusAction(null);
            }}
            onOpenDropped={() => setDroppedSheetOpen(true)}
          />
        </div>

        <ImpactQueueMetaBar leadCount={filtered.length} view={view} />
      </div>

      <MessageLabSheet
        open={messageLabOpen}
        onOpenChange={setMessageLabOpen}
        tcmOptions={tcmOptions}
      />

      {unassignedLeads > 0 && role !== "tcm" && (
        <div className="text-[11px] rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
          {unassignedLeads} lead{unassignedLeads === 1 ? "" : "s"} without an assigned TCM — assign
          in lead panel so Hard Actions route correctly.
        </div>
      )}

      {/* ---------------- 10x Command Bar ---------------- */}

      {(chipFilter !== "all" ||
        query.trim() ||
        areaFilter !== "all" ||
        typeFilter !== "all" ||
        roomFilter !== "all" ||
        needFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-muted-foreground">Showing:</span>
          {chipFilter !== "all" && (
            <Badge variant="outline" className="text-[10px]">
              {CHIP_LABELS[chipFilter]}
            </Badge>
          )}
          {areaFilter !== "all" && (
            <Badge variant="outline" className="text-[10px]">
              {areaFilter}
            </Badge>
          )}
          {typeFilter !== "all" && (
            <Badge variant="outline" className="text-[10px]">
              {typeFilter}
            </Badge>
          )}
          {roomFilter !== "all" && (
            <Badge variant="outline" className="text-[10px]">
              {roomFilter}
            </Badge>
          )}
          {needFilter !== "all" && (
            <Badge variant="outline" className="text-[10px]">
              {needFilter}
            </Badge>
          )}
          {query.trim() && (
            <Badge variant="outline" className="text-[10px]">
              “{query.trim()}”
            </Badge>
          )}
          <button
            type="button"
            className="text-accent font-semibold hover:underline"
            onClick={() => {
              setChipFilter("all");
              setAreaFilter("all");
              setTypeFilter("all");
              setRoomFilter("all");
              setNeedFilter("all");
              setQuery("");
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {booting && leads.length === 0 && leadsSyncStatus !== "error" && (
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-2 animate-pulse">
          <div className="text-xs font-medium text-muted-foreground">Loading your queue…</div>
          <div className="text-[10px] text-muted-foreground">
            Fetching leads and tours from server
          </div>
        </div>
      )}

      {/* ---------------- View ---------------- */}
      {!booting || leads.length > 0 ? (
        view === "stack" ? (
          <div className="space-y-2">
            {/* Stage filter bar — stack view only */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
                Stage
              </span>
              {(
                [
                  { key: "all", label: "All stages" },
                  { key: "inbox", label: "Inbox" },
                  { key: "scheduled", label: "Tour scheduled" },
                  { key: "onTour", label: "On tour" },
                  { key: "quoted", label: "Quote sent" },
                  { key: "booked", label: "Booked" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStageFilter(s.key)}
                  className={`h-6 rounded-full border px-2.5 text-[10px] font-semibold transition-colors ${
                    stageFilter === s.key
                      ? "bg-foreground text-background border-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {s.label}
                  {s.key !== "all" && (
                    <span className="ml-1 opacity-60">
                      {filtered.filter((e) => e.column === s.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {stackSorted.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-10 text-center text-xs text-muted-foreground space-y-2">
                <p>
                  {chipFilter !== "all" ||
                  query.trim() ||
                  areaFilter !== "all" ||
                  typeFilter !== "all" ||
                  roomFilter !== "all" ||
                  needFilter !== "all"
                    ? "No leads match your filters."
                    : "Queue clear. Add a lead or relax 🌱"}
                </p>
                {(chipFilter !== "all" ||
                  query.trim() ||
                  areaFilter !== "all" ||
                  typeFilter !== "all" ||
                  roomFilter !== "all" ||
                  needFilter !== "all") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      setChipFilter("all");
                      setAreaFilter("all");
                      setTypeFilter("all");
                      setRoomFilter("all");
                      setNeedFilter("all");
                      setQuery("");
                    }}
                  >
                    Show all leads
                  </Button>
                )}
              </div>
            )}
            {stackSorted.map((e, i) => (
              <LeadRow
                key={e.lead.id}
                rank={i + 1}
                enriched={e}
                tcms={tcms}
                tcmOptions={tcmOptions}
                properties={properties}
                autoOpen={focusLeadId === e.lead.id}
                focusAction={focusLeadId === e.lead.id ? focusAction : null}
                keyboardHighlight={keyboardLeadId === e.lead.id}
                onAutoOpenConsumed={() => {
                  setFocusLeadId(null);
                  setFocusAction(null);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto pb-1">
            <div className="grid grid-cols-5 gap-2 h-[calc(100vh-270px)] min-h-[430px] min-w-[720px]">
              {COLUMNS.map((c) => (
                <div
                  key={c.key}
                  className={`min-w-0 h-full overflow-hidden rounded-xl border-l-2 ${c.tint} border-t border-r border-b border-border bg-background shadow-sm`}
                >
                  <div
                    className={cn(
                      "flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3",
                      COLUMN_HEADER_TONE[c.key],
                    )}
                    title={COLUMN_HELP[c.key]}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background/80">
                        <c.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-foreground">
                          {c.label}
                        </div>
                        <div className="truncate text-[9px] text-muted-foreground">
                          {COLUMN_HELP[c.key]}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {boardBuckets[c.key].length}
                    </span>
                  </div>
                  <div className="h-[calc(100%-2.75rem)] overflow-y-auto overflow-x-hidden bg-muted/15 p-2">
                    {c.key === "inbox" &&
                      boardBuckets.inbox.length === 0 &&
                      chipFilter === "all" &&
                      query.trim() === "" && (
                        <div
                          className="mb-2 rounded-lg border border-dashed border-border bg-background/80 px-2 py-1.5 text-[10px] text-muted-foreground"
                          title="New/contacted leads without an active tour or quote appear here."
                        >
                          No unworked leads in this scope.
                        </div>
                      )}
                    <BoardColumnBody
                      columnKey={c.key}
                      items={boardBuckets[c.key]}
                      tcms={tcms}
                      tcmOptions={tcmOptions}
                      properties={properties}
                      nowMs={tick ? Date.now() : 0}
                      focusLeadId={focusLeadId}
                      focusAction={focusAction}
                      onFocusConsumed={() => {
                        setFocusLeadId(null);
                        setFocusAction(null);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}

      <DroppedLeadsSheet open={droppedSheetOpen} onOpenChange={setDroppedSheetOpen} />
    </div>
  );
}

/* ================================================================== */
/*  Atoms                                                              */
/* ================================================================== */

function Counter({
  label,
  got,
  target,
  tone,
  icon: Icon,
}: {
  label: string;
  got: number;
  target: number;
  tone: string;
  icon: typeof Calendar;
}) {
  void tone;
  return (
    <div className="min-w-0 flex-1 rounded-md bg-muted/35 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-display font-semibold leading-none">{got}</span>
            <span className="text-[10px] font-mono text-muted-foreground">/ {target}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const QUOTE_STATUS_TONE: Record<Quotation["status"], string> = {
  sent: "bg-accent/15 text-accent border-accent/30",
  paid: "bg-success/15 text-success border-success/30",
  "not-paid": "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function QuotesWeekCounter({
  quotes,
  leads,
  got,
  target,
  tone,
  onFocusLead,
}: {
  quotes: Quotation[];
  leads: Lead[];
  got: number;
  target: number;
  tone: string;
  onFocusLead: (leadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  void tone;
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-w-0 flex-1 rounded-md bg-muted/35 px-2.5 py-1.5 text-left transition hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              Quotes today
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-display font-semibold leading-none">{got}</span>
              <span className="text-[10px] font-mono text-muted-foreground">/ {target}</span>
            </div>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">View</span>
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">Quotes today</SheetTitle>
            <SheetDescription className="text-xs">
              {got} quotation{got !== 1 ? "s" : ""} sent today
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {quotes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                No quotes sent today yet.
              </p>
            ) : (
              quotes.map((q) => {
                const lead = leadById.get(q.leadId);
                const expired =
                  q.status === "sent" &&
                  (parseInstant(q.validUntilISO)?.getTime() ?? Infinity) < Date.now();
                const status = expired ? "expired" : q.status;
                return (
                  <div key={q.id} className="rounded-lg border border-border p-3 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{lead?.name ?? "Unknown lead"}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {q.propertyName} · {q.roomType}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${QUOTE_STATUS_TONE[status]}`}
                      >
                        {status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatINR(q.discountedPrice)}
                      <span className="line-through ml-1">{formatINR(q.actualRent)}</span>
                      {" · "}
                      {fmtDate(q.sentAt)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lead && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            onFocusLead(lead.id);
                            setOpen(false);
                            toast.success(`Opened ${lead.name}`);
                          }}
                        >
                          Find lead
                        </Button>
                      )}
                      {lead?.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => void copyText(q.message, "Quote copied")}
                        >
                          <ClipboardCopy className="h-3 w-3" /> Copy again
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] gap-1"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(q.message)
                            .then(() => toast.success("Copied"))
                        }
                      >
                        <ClipboardCopy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ================================================================== */
/*  Board column — action-queue bands for tour lanes                   */
/* ================================================================== */

function BoardColumnBody({
  columnKey,
  items,
  tcms,
  tcmOptions,
  properties,
  nowMs,
  focusLeadId,
  focusAction,
  onFocusConsumed,
}: {
  columnKey: ColumnKey;
  items: ImpactEnriched[];
  tcms: TCM[];
  tcmOptions: TCM[];
  properties: Property[];
  nowMs: number;
  focusLeadId: string | null;
  focusAction: LeadFocusAction | null;
  onFocusConsumed: () => void;
}) {
  const useBands = columnKey === "scheduled" || columnKey === "onTour";
  const [postTourOpen, setPostTourOpen] = useState(true);
  const postTourItems =
    columnKey === "scheduled" ? items.filter((item) => item.lead.stage === "tour-done") : [];
  const activeItems = postTourItems.length
    ? items.filter((item) => item.lead.stage !== "tour-done")
    : items;

  const grouped = useMemo(() => {
    const map: Record<TourQueueBand, ImpactEnriched[]> = {
      fire: [],
      confirm: [],
      soon: [],
      later: [],
    };
    if (!useBands) return map;
    const at = nowMs || Date.now();
    for (const e of activeItems) {
      const band =
        e.tourBand ??
        classifyTourBand(columnKey as "scheduled" | "onTour", e.openTour, e.lead, e.nba, at);
      map[band].push(e);
    }
    for (const band of TOUR_BAND_ORDER) {
      map[band].sort((a, b) => {
        const ta = a.openTour ? +new Date(a.openTour.scheduledAt) : Infinity;
        const tb = b.openTour ? +new Date(b.openTour.scheduledAt) : Infinity;
        return ta - tb;
      });
    }
    return map;
  }, [activeItems, columnKey, useBands, nowMs]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center px-2 py-8 text-center text-[10px] text-muted-foreground">
        <div className="rounded-full border border-border bg-background/80 px-3 py-1.5 shadow-sm">
          <div className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 opacity-60" />
            No leads in this stage yet
          </div>
        </div>
      </div>
    );
  }

  if (!useBands) {
    return (
      <div className="space-y-2">
        {activeItems.map((e) => (
          <LeadRow
            key={e.lead.id}
            enriched={e}
            tcms={tcms}
            tcmOptions={tcmOptions}
            properties={properties}
            compact
            autoOpen={focusLeadId === e.lead.id}
            focusAction={focusLeadId === e.lead.id ? focusAction : null}
            onAutoOpenConsumed={onFocusConsumed}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {postTourItems.length > 0 && (
        <Collapsible open={postTourOpen} onOpenChange={setPostTourOpen}>
          <section className="overflow-hidden rounded-md border border-success/35 bg-success/5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
              >
                <span>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-success">
                    Post-tour · {postTourItems.length}
                  </span>
                  <span className="block text-[8px] leading-tight text-success/80">
                    Fill outcome, objection, follow-up
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-success transition-transform",
                    postTourOpen && "rotate-90",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 border-t border-success/20 bg-card/70 p-1.5">
                {postTourItems.map((e) => (
                  <LeadRow
                    key={e.lead.id}
                    enriched={e}
                    tcms={tcms}
                    tcmOptions={tcmOptions}
                    properties={properties}
                    compact
                    autoOpen={focusLeadId === e.lead.id}
                    focusAction={focusLeadId === e.lead.id ? focusAction : null}
                    onAutoOpenConsumed={onFocusConsumed}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      )}
      {TOUR_BAND_ORDER.map((band) => {
        const list = grouped[band];
        if (list.length === 0) return null;
        const meta = TOUR_BAND_META[band];
        return (
          <section key={band} className={`rounded-md border ${meta.border} overflow-hidden`}>
            <div className={`px-2 py-1.5 ${meta.header}`}>
              <div className="text-[9px] uppercase tracking-wider font-bold">
                {meta.label} · {list.length}
              </div>
              <div className="text-[8px] font-normal normal-case opacity-90 leading-tight mt-0.5">
                {meta.desc}
              </div>
            </div>
            <div className="space-y-1.5 p-1.5 bg-card/60">
              {list.map((e) => (
                <LeadRow
                  key={e.lead.id}
                  enriched={e}
                  tcms={tcms}
                  tcmOptions={tcmOptions}
                  properties={properties}
                  compact
                  autoOpen={focusLeadId === e.lead.id}
                  focusAction={focusLeadId === e.lead.id ? focusAction : null}
                  onAutoOpenConsumed={onFocusConsumed}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Lead row — collapses to summary, expands to Command Mode           */
/* ================================================================== */

type EnrichedLite = {
  lead: Lead;
  openTour?: Tour;
  lastQuote?: Quotation;
  nba: NextBestAction;
  score: number;
  column: ColumnKey;
  tourBand?: TourQueueBand;
  tourTimeHint?: string;
};

function LeadRow({
  enriched,
  rank,
  tcms,
  tcmOptions,
  properties,
  compact,
  autoOpen,
  focusAction,
  onAutoOpenConsumed,
  keyboardHighlight,
}: {
  enriched: EnrichedLite;
  rank?: number;
  tcms: TCM[];
  tcmOptions: TCM[];
  properties: Property[];
  compact?: boolean;
  autoOpen?: boolean;
  focusAction?: LeadFocusAction | null;
  onAutoOpenConsumed?: () => void;
  keyboardHighlight?: boolean;
}) {
  const { lead, openTour, lastQuote, nba, column, tourTimeHint, tourBand } = enriched;
  const selectLead = useApp((s) => s.selectLead);
  const setLeadStage = useApp((s) => s.setLeadStage);
  const cancelTour = useApp((s) => s.cancelTour);
  const priority = classifyImpactPriority(enriched);
  const priorityMeta = IMPACT_PRIORITY_META[priority];
  const colMeta = COLUMNS.find((c) => c.key === column)!;
  const areaText = (lead.areas?.filter(Boolean).join(", ") || lead.preferredArea || "").trim();
  const blrText =
    lead.inBLR === true
      ? "In Bengaluru"
      : lead.inBLR === false
        ? "Out of Bengaluru"
        : "Bengaluru unknown";
  const assignedToMember = lead.assignedTcmId
    ? tcmOptions.find((item) => item.id === lead.assignedTcmId)
    : null;
  const assignedByMember = lead.createdBy
    ? tcmOptions.find((item) => item.id === lead.createdBy)
    : null;
  const assignedToName = lead.assignedTcmId
    ? assignedToMember
      ? memberShortLabel(assignedToMember)
      : lead.assignedTcmId.slice(-6)
    : "Unassigned";
  const assignedByName = lead.createdBy
    ? assignedByMember
      ? memberShortLabel(assignedByMember)
      : lead.createdBy.slice(-6)
    : "System";
  const openTourType = openTour?.tourType ?? "physical";
  const { data: interestedPropertyIds = [] } = useLeadInterests(lead.id);
  const allObjections = useCRM10x((s) => s.objections);
  const pickedProperty = useMemo(() => {
    const firstId = interestedPropertyIds[0];
    return firstId ? resolvePropertyById(firstId, properties) : undefined;
  }, [interestedPropertyIds, properties]);
  const latestObjection = useMemo(
    () =>
      allObjections
        .filter((item) => item.leadId === lead.id)
        .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))[0],
    [allObjections, lead.id],
  );

  useEffect(() => {
    if (autoOpen) {
      selectLead(lead.id, drawerTabForLeadFocusAction(focusAction), focusAction);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen, focusAction, lead.id, onAutoOpenConsumed, selectLead]);

  const staleQuote = isQuoteStale(lastQuote);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => selectLead(lead.id)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectLead(lead.id);
          }
        }}
        className={cn(
          "relative w-full cursor-pointer text-left rounded-md border bg-card hover:border-accent/60 hover:bg-muted/30 transition-colors px-3 py-2 pr-12 group",
          keyboardHighlight && "ring-2 ring-accent border-accent",
          staleQuote && "border-danger/40",
        )}
      >
        {rank !== undefined && (
          <div className="absolute left-3 top-2 w-7 h-7 rounded-md bg-muted text-[11px] font-mono font-semibold flex items-center justify-center group-hover:bg-accent/20">
            #{rank}
          </div>
        )}
        <div className={cn("min-w-0", rank !== undefined && "pl-9")}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${priorityMeta.dot}`}
              title={priorityMeta.hint}
            />
            <span className="text-xs font-semibold truncate">{lead.name}</span>
          </div>
          <div className="mt-1 grid gap-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 min-w-0">
              <Phone className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </span>
            {areaText && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{areaText}</span>
              </span>
            )}
            <span>{blrText}</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              Move-in: {fmtDate(lead.moveInDate)}
            </span>
            <span className="truncate">
              Assigned by {assignedByName} → {assignedToName}
            </span>
            {openTour && (
              <span className="text-[10px] font-semibold text-accent flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5 shrink-0" />
                Tour: {fmtTourScheduleLabel(openTour.scheduledAt)} ·{" "}
                {TOUR_TYPE_LABELS[openTourType] ?? openTourType}
              </span>
            )}
          </div>
          {(pickedProperty || latestObjection) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {pickedProperty && (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-success/10 text-success border-success/40"
                >
                  {pickedProperty.name}
                </Badge>
              )}
              {latestObjection && (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-warning/10 text-warning border-warning/40"
                >
                  Objection:{" "}
                  {latestObjection.code === "none"
                    ? "None"
                    : latestObjection.code.replace(/-/g, " ")}
                </Badge>
              )}
            </div>
          )}
          {staleQuote && (
            <Badge
              variant="outline"
              className="mt-1 text-[9px] border-danger/50 text-danger bg-danger/10"
            >
              Quote 24h+ · follow up
            </Badge>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  Lead Drawer — every action for one lead lives here                 */
/* ================================================================== */

const InterestedPropertiesPicker = LeadInterestedPropertiesPicker;

function LeadInterestedPropertiesPicker({ lead }: { lead: Lead }) {
  const properties = useApp((s) => s.properties);
  const { data: interests = [] } = useLeadInterests(lead.id);
  const { mutate: toggleInterest } = useToggleInterest();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const liked = interests
    .map((id) => resolvePropertyById(id, properties))
    .filter(Boolean) as CatalogProperty[];

  const list = useMemo(
    () =>
      searchPropertyCatalog(query, properties, { preferredArea: lead.preferredArea, limit: 16 }),
    [properties, query, lead.preferredArea],
  );

  const sortedList = useMemo(
    () =>
      [...list].sort((a, b) => {
        const af = interests.includes(a.id) ? 0 : 1;
        const bf = interests.includes(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        return (b.vacantBeds ?? 1) - (a.vacantBeds ?? 1);
      }),
    [list, interests],
  );

  return (
    <div className="rounded-lg border border-border bg-gradient-to-br from-card via-card to-accent/5 p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-danger" />
          <span className="text-[11px] uppercase tracking-wider font-semibold">
            Interested properties
          </span>
          <span className="text-[10px] text-muted-foreground">
            · pin 2–3 the lead is leaning toward
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] gap-1"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="h-3 w-3" /> {open ? "Close" : "Add"}
        </Button>
      </div>

      {liked.length === 0 && !open && (
        <p className="text-[11px] text-muted-foreground italic">
          No favourites yet — tap <span className="font-semibold">Add</span> to pin the rooms they
          liked.
        </p>
      )}

      {liked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {liked.map((p, i) => (
            <div
              key={p.id}
              className="group text-[10px] rounded-md border border-accent/40 bg-accent/10 px-2 py-1 flex items-center gap-1.5"
            >
              <Star className="h-3 w-3 text-accent" />
              <span className="font-semibold">
                #{i + 1} {p.name}
              </span>
              <span className="text-muted-foreground">
                · {p.area} · {formatINR(p.pricePerBed)}
              </span>
              {p.source === "hub" && (
                <Badge variant="outline" className="text-[8px]">
                  Hub
                </Badge>
              )}
              {p.vacantBeds !== undefined && (
                <Badge
                  variant="outline"
                  className={`text-[9px] ${
                    p.vacantBeds > 0
                      ? "bg-success/10 text-success border-success/40"
                      : "bg-danger/10 text-danger border-danger/40"
                  }`}
                >
                  {p.vacantBeds}/{p.totalBeds ?? "—"}
                </Badge>
              )}
              <button
                type="button"
                onClick={() => toggleInterest({ leadId: lead.id, propertyId: p.id })}
                className="opacity-40 hover:opacity-100 hover:text-danger"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-1.5 pt-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Search property…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1 rounded-md border border-border p-1">
            {sortedList.map((p) => {
              const on = interests.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleInterest({ leadId: lead.id, propertyId: p.id })}
                  className={`w-full text-left text-[11px] px-2 py-1 rounded border flex items-center gap-2 transition ${
                    on ? "bg-accent/10 border-accent/50" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      on ? "bg-accent border-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {on && <Heart className="h-2 w-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.area} · {formatINR(p.pricePerBed)}/bed
                      {p.source === "hub" ? " · Property Hub" : ""}
                    </div>
                  </div>
                  {p.vacantBeds !== undefined && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        p.vacantBeds > 0
                          ? "bg-success/10 text-success border-success/40"
                          : "bg-danger/10 text-danger border-danger/40"
                      }`}
                    >
                      {p.vacantBeds}/{p.totalBeds ?? "—"}
                    </Badge>
                  )}
                </button>
              );
            })}
            {sortedList.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-3">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadDrawer({
  open,
  onOpenChange,
  enriched,
  tcm,
  tcmOptions,
  catalogProperty,
  opsProperties,
  pendingAction,
  onPendingActionConsumed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enriched: EnrichedLite;
  tcm?: TCM;
  tcmOptions: TCM[];
  catalogProperty?: CatalogProperty;
  opsProperties: Property[];
  pendingAction?: LeadFocusAction | null;
  onPendingActionConsumed?: () => void;
}) {
  const { lead, openTour, lastQuote, nba, column } = enriched;
  const colMeta = COLUMNS.find((c) => c.key === column)!;
  const setLeadStage = useApp((s) => s.setLeadStage);
  const STAGES: Lead["stage"][] = [
    "new",
    "contacted",
    "tour-scheduled",
    "tour-done",
    "negotiation",
    "booked",
  ];
  const currentStageIndex = STAGES.indexOf(lead.stage);
  const stageLabel = (stage: string) => stage.replace(/-/g, " ");
  const previousStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : undefined;
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1
      ? STAGES[currentStageIndex + 1]
      : undefined;
  const moveStage = async (dir: -1 | 1) => {
    if (currentStageIndex < 0) return;
    const next = STAGES[Math.min(STAGES.length - 1, Math.max(0, currentStageIndex + dir))];
    if (next !== lead.stage) {
      try {
        await setLeadStage(lead.id, next);
        toast.success(`${lead.name.split(" ")[0]} → ${stageLabel(next)}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Stage change failed");
      }
    }
  };
  const [now, mounted] = useMountedNow(30_000);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<PG | null>(null);

  const handlePickPg = (pg: PG) => {
    setSchedulePrefill(pg);
    setScheduleOpen(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0 overflow-hidden bg-gradient-to-b from-card via-card to-background"
      >
        {/* Glossy header */}
        <SheetHeader className="relative px-5 pt-5 pb-3 border-b border-border space-y-2 bg-gradient-to-br from-accent/10 via-card to-primary/5 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-base font-display">{lead.name}</SheetTitle>
            <Badge variant="outline" className={`text-[9px] uppercase ${intentChip(lead.intent)}`}>
              {lead.intent}
            </Badge>
            <Badge variant="outline" className="text-[9px] uppercase gap-1">
              <colMeta.icon className="h-2.5 w-2.5" /> {colMeta.label}
            </Badge>
          </div>
          <SheetDescription className="text-[11px] flex items-center gap-1 flex-wrap">
            <Phone className="h-3 w-3" /> {lead.phone}
            <span>·</span>
            <span>{lead.preferredArea}</span>
            <span>·</span>
            <span>{formatINR(lead.budget)}</span>
            {tcm && (
              <>
                <span>·</span>
                <span>TCM: {tcm.name}</span>
              </>
            )}
          </SheetDescription>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Stage progress</span>
              <span className="rounded-full border px-2 py-0.5">
                {currentStageIndex >= 0 ? currentStageIndex + 1 : "—"}/{STAGES.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3"
                onClick={() => void moveStage(-1)}
                disabled={!previousStage}
              >
                {previousStage ? `Back: ${stageLabel(previousStage)}` : "Back"}
              </Button>
              <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-accent">
                {stageLabel(lead.stage)}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3"
                onClick={() => void moveStage(1)}
                disabled={!nextStage}
              >
                {nextStage ? `Next: ${stageLabel(nextStage)}` : "Complete"}
              </Button>
            </div>
          </div>
          {/* NBA banner */}
          <div className={`rounded-md border px-3 py-2 ${pressureColor(nba.pressure)}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-70">Next best action</div>
            <div className="text-sm font-semibold">{nba.label}</div>
            <div className="text-[10px] opacity-80">{nba.reason}</div>
          </div>

          {/* Context badges */}
          {(openTour || lastQuote) && (
            <div className="flex flex-wrap gap-1.5">
              {openTour && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Calendar className="h-3 w-3" />
                  {catalogProperty?.name ?? "Property"} · {fmtTime(openTour.scheduledAt)} (
                  {mounted ? fmtRel(openTour.scheduledAt, now) : "—"})
                </Badge>
              )}
              {lastQuote && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <FileText className="h-3 w-3" />
                  {formatINR(lastQuote.discountedPrice)} · {lastQuote.propertyName} ·{" "}
                  {lastQuote.status}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Body — scrollable, all actions in one place */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 space-y-3">
            <SmartDossier lead={lead} />
            <LeadPropertyDossier lead={lead} onPickPg={handlePickPg} />
          </div>
          <CommandActions
            lead={lead}
            tcm={tcm}
            tcmOptions={tcmOptions}
            openTour={openTour}
            lastQuote={lastQuote}
            nba={nba}
            catalogProperty={catalogProperty}
            opsProperties={opsProperties}
            column={column}
            scheduleOpen={scheduleOpen}
            schedulePrefill={schedulePrefill}
            onScheduleOpenChange={setScheduleOpen}
            onSchedulePrefillClear={() => setSchedulePrefill(null)}
            pendingAction={pendingAction}
            onPendingActionConsumed={onPendingActionConsumed}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ================================================================== */
/*  Command Actions — the full toolbelt for a single lead              */
/* ================================================================== */

export function CommandActions({
  lead,
  tcm,
  tcmOptions,
  openTour,
  lastQuote,
  nba,
  catalogProperty,
  opsProperties,
  column,
  scheduleOpen,
  schedulePrefill,
  onScheduleOpenChange,
  onSchedulePrefillClear,
  pendingAction,
  onPendingActionConsumed,
}: {
  lead: Lead;
  tcm?: TCM;
  openTour?: Tour;
  lastQuote?: Quotation;
  nba: NextBestAction;
  tcmOptions: TCM[];
  catalogProperty?: CatalogProperty;
  opsProperties: Property[];
  column: ColumnKey;
  scheduleOpen?: boolean;
  schedulePrefill?: PG | null;
  onScheduleOpenChange?: (v: boolean) => void;
  onSchedulePrefillClear?: () => void;
  pendingAction?: LeadFocusAction | null;
  onPendingActionConsumed?: () => void;
}) {
  const completeTour = useApp((s) => s.completeTour);
  const markTourStarted = useApp((s) => s.markTourStarted);
  const updateTourDetails = useApp((s) => s.updateTourDetails);
  const setQuotationStatus = useSetQuotationStatus();
  const setLeadIntent = useApp((s) => s.setLeadIntent);
  const setLeadStage = useApp((s) => s.setLeadStage);
  const logCall = useApp((s) => s.logCall);
  const activities = useApp((s) => s.activities);
  const currentUser = useIdentityStore((s) => s.currentUser);
  const auditLog = useAuditLog((s) => s.log);
  const { data: checkin } = useCheckin(lead.id);
  const dossier = useDossierReadiness(lead);
  const [now, mounted] = useMountedNow(30_000);
  const [loggingCall, setLoggingCall] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [localScheduleOpen, setLocalScheduleOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [messengerScenario, setMessengerScenario] = useState<ImpactScenario | null>(null);
  const messengerRef = useRef<HTMLDivElement>(null);

  const tcmPhone = useTcmContacts((s) => s.phones[tcm?.id ?? ""]);
  const scheduleDialogOpen = scheduleOpen ?? localScheduleOpen;
  const setScheduleDialogOpen = (v: boolean) => {
    if (onScheduleOpenChange) onScheduleOpenChange(v);
    else setLocalScheduleOpen(v);
  };

  const updateIntent = async (intent: Lead["intent"]) => {
    const previous = lead.intent;
    setLeadIntent(lead.id, intent);
    try {
      await api.command({
        _id: `cmd-${crypto.randomUUID()}`,
        type: "cmd.lead.update",
        issuedAt: new Date().toISOString(),
        payload: { leadId: lead.id, patch: { intent } },
      });
      toast.success(`Intent → ${intent}`);
    } catch (error) {
      setLeadIntent(lead.id, previous);
      toast.error(error instanceof Error ? error.message : "Intent update failed");
    }
  };

  const dropLead = async () => {
    try {
      await setLeadStage(lead.id, "dropped");
      toast("Lead dropped");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drop failed");
    }
  };

  const logCallAction = async () => {
    const at = new Date().toISOString();
    setLoggingCall(true);
    logCall(lead.id);
    auditLog({
      actorId: currentUser.id,
      actorName: currentUser.name,
      entityType: "lead",
      entityId: lead.id,
      action: "call_logged",
      summary: `Call logged by ${currentUser.name}`,
      after: {
        type: "call_logged",
        leadId: lead.id,
        actorId: currentUser.id,
        actorName: currentUser.name,
        at,
        meta: { callType: "manual" },
      },
    });
    try {
      await api.command({
        _id: `cmd-${crypto.randomUUID()}`,
        type: "cmd.activity.log",
        issuedAt: new Date().toISOString(),
        payload: {
          entityType: "lead",
          entityId: lead.id,
          kind: "call",
          subject: "Call logged",
          body: "Call logged from Impact Queue",
          direction: "outbound",
          outcome: "neutral",
          meta: { source: "impact_queue" },
        },
      });
      toast.success("Call logged");
    } catch (error) {
      toast.error("Failed to log call");
    } finally {
      setLoggingCall(false);
    }
  };

  const baseCtx: ImpactTplCtx = useMemo(
    () => ({
      leadName: lead.name.split(" ")[0],
      agentName: tcm?.name,
      agentPhone: tcmPhone,
      propertyName: catalogProperty?.name ?? lastQuote?.propertyName,
      propertyAddress: catalogProperty?.area,
      tourWhen: openTour ? fmtWhen(openTour.scheduledAt) : undefined,
      roomType: lastQuote?.roomType,
      price: lastQuote?.discountedPrice,
      altPrice: lastQuote ? Math.max(0, lastQuote.discountedPrice - 1500) : undefined,
      area: lead.preferredArea,
      budget: lead.budget,
      moveIn: fmtDate(lead.moveInDate),
    }),
    [lead, tcm, tcmPhone, catalogProperty, lastQuote, openTour],
  );

  /* primary scenario picker (changes with state) */
  const primaryScenario: ImpactScenario = useMemo(() => {
    if (lastQuote?.status === "paid") return "booking-confirm";
    if (lastQuote?.status === "sent") return "quote-followup";
    if (lead.stage === "negotiation") return "negotiate-hold";
    if (openTour) {
      if (!mounted) return "tour-confirm";
      const mins = (+new Date(openTour.scheduledAt) - now) / 60000;
      if (mins < -30) return "quote-followup";
      if (mins < 60 * 4) return "tour-reminder";
      return "tour-confirm";
    }
    if (lead.stage === "dropped") return "revival";
    return "first-touch";
  }, [lead.stage, lastQuote, openTour, mounted, now]);

  useEffect(() => {
    if (!pendingAction) return;
    const action =
      pendingAction === "auto"
        ? mapNbaToFocusAction(nba.verb, column, Boolean(lastQuote))
        : pendingAction;

    switch (action) {
      case "schedule":
        if (dossier.ready) {
          setScheduleDialogOpen(true);
        } else {
          toast.warning(`Complete deep profile first: ${dossier.missing.join(", ")}`);
        }
        break;
      case "quote":
        setQuoteOpen(true);
        break;
      case "negotiate":
        setNegotiateOpen(true);
        break;
      case "book":
        if (lastQuote) setBookOpen(true);
        break;
      case "checkin":
        setCheckinOpen(true);
        break;
      case "call-hot":
        void logCallAction();
        break;
      case "revive":
        setMessengerScenario("revival");
        window.requestAnimationFrame(() => {
          messengerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        break;
    }
    onPendingActionConsumed?.();
  }, [pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps -- one-shot from Hard Actions

  return (
    <div className="space-y-3">
      {/* Interested properties — what the lead is leaning toward */}
      <InterestedPropertiesPicker lead={lead} />

      {/* Action toolbar — context-aware */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
        {(column === "inbox" || scheduleDialogOpen) &&
          (dossier.ready ? (
            <ScheduleTourDialog
              lead={lead}
              open={scheduleDialogOpen}
              onOpenChange={(v) => {
                setScheduleDialogOpen(v);
                if (!v) onSchedulePrefillClear?.();
              }}
              prefillPg={schedulePrefill}
              showTrigger={column === "inbox"}
              tcmOptions={tcmOptions}
            />
          ) : (
            <Button
              size="sm"
              disabled
              title={`Complete deep profile first: ${dossier.missing.join(", ")}`}
              className="h-7 text-[10px] gap-1"
            >
              <Calendar className="h-3 w-3" /> Schedule locked
            </Button>
          ))}

        {column === "scheduled" && openTour && (
          <>
            <ConfirmTourButton lead={lead} tour={openTour} />
            {isTodayIST(openTour.scheduledAt) &&
              +new Date(openTour.scheduledAt) > now &&
              lead.stage !== "on-tour" && (
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
                  onClick={() => {
                    void markTourStarted(openTour.id)
                      .then(() => toast.success("Tour marked live"))
                      .catch(() => toast.error("Failed to start tour"));
                  }}
                >
                  <UserCheck className="h-3 w-3" /> Move to on-tour
                </Button>
              )}
            {+new Date(openTour.scheduledAt) <= now && (
              <>
                <Button
                  size="sm"
                  className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
                  onClick={() => {
                    void completeTour(openTour.id)
                      .then(() => toast.success("Visit completed · post-tour unlocked"))
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to complete tour"),
                      );
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" /> Visit done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-[10px] gap-1 text-destructive hover:text-destructive ${actionButtonClass}`}
                  onClick={() => {
                    void updateTourDetails(openTour.id, { status: "no-show", showUp: false })
                      .then(() => toast("Marked no-show · lead returned for follow-up"))
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to mark no-show"),
                      );
                  }}
                >
                  <AlertTriangle className="h-3 w-3" /> No-show
                </Button>
              </>
            )}
            <span className="text-[10px] text-muted-foreground self-center">
              {isTodayIST(openTour.scheduledAt)
                ? "After the visit time, mark Visit done or No-show."
                : "Tour will move into today automatically on the scheduled day."}
            </span>
          </>
        )}

        {column === "onTour" && openTour && (
          <>
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
              onClick={() => {
                void completeTour(openTour.id)
                  .then(() => toast.success("Tour completed"))
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to complete tour"),
                  );
              }}
            >
              <CheckCircle2 className="h-3 w-3" /> Tour done
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-[10px] gap-1 text-destructive hover:text-destructive ${actionButtonClass}`}
              onClick={() => {
                void updateTourDetails(openTour.id, { status: "no-show", showUp: false })
                  .then(() => toast("Marked no-show · lead returned for follow-up"))
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to mark no-show"),
                  );
              }}
            >
              <AlertTriangle className="h-3 w-3" /> No-show
            </Button>
          </>
        )}

        {column === "quoted" && lastQuote && (
          <>
            {lastQuote.status === "sent" && (
              <>
                <Button
                  size="sm"
                  className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
                  onClick={() => {
                    setQuotationStatus.mutate({
                      id: lastQuote.id,
                      leadId: lastQuote.leadId,
                      status: "paid",
                    });
                    toast.success("Quote accepted · paid");
                  }}
                >
                  <Wallet className="h-3 w-3" /> Mark paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 text-[10px] ${actionButtonClass}`}
                  onClick={() => {
                    setQuotationStatus.mutate({
                      id: lastQuote.id,
                      leadId: lastQuote.leadId,
                      status: "not-paid",
                    });
                    toast("Marked not paid");
                  }}
                >
                  Not paid
                </Button>
              </>
            )}
            <BookingDialog
              lead={lead}
              quote={lastQuote}
              openTour={openTour}
              open={bookOpen}
              onOpenChange={setBookOpen}
            />
          </>
        )}

        {column === "booked" && (
          <div className="text-[10px] text-success font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Closed
          </div>
        )}

        {column === "quoted" && (
          <>
            <NegotiationPlaybook
              lead={lead}
              leadPhone={lead.phone}
              ctx={baseCtx}
              open={negotiateOpen}
              onOpenChange={setNegotiateOpen}
            />
            <QuotationDialog
              lead={lead}
              label={lastQuote ? "Re-quote" : "Quotation"}
              open={quoteOpen}
              onOpenChange={setQuoteOpen}
            />
          </>
        )}
        {(column === "inbox" || column === "quoted") && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
            onClick={() => void logCallAction()}
            disabled={loggingCall}
          >
            {loggingCall ? (
              <RotateCcw className="h-3 w-3 animate-spin" />
            ) : (
              <Phone className="h-3 w-3" />
            )}{" "}
            Log call
          </Button>
        )}
        {column === "booked" && (
          <CheckInOpsButton
            lead={lead}
            existing={checkin}
            open={checkinOpen}
            onOpenChange={setCheckinOpen}
          />
        )}
        {lastQuote && column !== "quoted" && (
          <BookingDialog
            lead={lead}
            quote={lastQuote}
            openTour={openTour}
            open={bookOpen}
            onOpenChange={setBookOpen}
            hideTrigger
          />
        )}
      </div>

      {checkin && <CheckInAuditReport checkin={checkin} lead={lead} compact />}
      <LeadActivityTimeline
        activities={activities.filter((a) => a.leadId === lead.id)}
        tcms={useApp.getState().tcms}
      />

      {/* Tier override */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        Override intent:
        {(["hot", "warm", "cold"] as const).map((t) => (
          <button
            key={t}
            onClick={() => void updateIntent(t)}
            className={`px-2 py-0.5 rounded-full border uppercase tracking-wider ${lead.intent === t ? intentChip(t) : "border-border"}`}
          >
            {t}
          </button>
        ))}
        <span className="mx-1">·</span>
        {lead.stage !== "dropped" && (
          <button
            onClick={() => void dropLead()}
            className="px-2 py-0.5 rounded-full border border-border hover:text-danger"
          >
            Drop
          </button>
        )}
      </div>

      {/* Template messenger */}
      <div ref={messengerRef}>
        <TemplateMessenger
          leadPhone={lead.phone}
          initialScenario={messengerScenario ?? primaryScenario}
          ctx={baseCtx}
          highlight={messengerScenario === "revival"}
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Template Messenger — 3+ variants per scenario, copy + send         */
/* ================================================================== */

function TemplateMessenger({
  leadPhone,
  initialScenario,
  ctx,
  highlight = false,
}: {
  leadPhone: string;
  initialScenario: ImpactScenario;
  ctx: ImpactTplCtx;
  highlight?: boolean;
}) {
  const [scenario, setScenario] = useState<ImpactScenario>(initialScenario);
  const variants = IMPACT_TEMPLATES[scenario];
  const [tplId, setTplId] = useState<string>(variants[0].id);
  const tpl = variants.find((v) => v.id === tplId) ?? variants[0];
  const [draft, setDraft] = useState(renderImpactTemplate(tpl, ctx));
  const [copied, setCopied] = useState(false);

  // re-render when scenario / template changes
  const apply = (s: ImpactScenario, id?: string) => {
    const next = IMPACT_TEMPLATES[s];
    const chosen = next.find((v) => v.id === id) ?? next[0];
    setScenario(s);
    setTplId(chosen.id);
    setDraft(renderImpactTemplate(chosen, ctx));
  };
  const reset = () => setDraft(renderImpactTemplate(tpl, ctx));

  const copy = async () => {
    await copyText(draft, "Copied!");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const scenarioSets: Record<string, { label: string; scenario: ImpactScenario }> = {
    first: { label: "First touch", scenario: "first-touch" },
    follow: { label: "Follow up", scenario: "quote-followup" },
    post: { label: "Post tour", scenario: "tour-noshow" },
  };
  const selectedSet =
    Object.entries(scenarioSets).find(([, item]) => item.scenario === scenario)?.[0] ?? "first";

  return (
    <div
      className={cn(
        "rounded-md border bg-card/60 p-2 space-y-2",
        highlight ? "border-accent ring-2 ring-accent/30" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          WhatsApp template
        </div>
        <Select value={selectedSet} onValueChange={(v) => apply(scenarioSets[v].scenario)}>
          <SelectTrigger className="h-7 text-[11px] w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(scenarioSets).map(([k, item]) => (
              <SelectItem key={k} value={k} className="text-xs">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => apply(scenario, v.id)}
            className={`h-6 px-2 rounded text-[10px] uppercase tracking-wider font-semibold border ${tpl.id === v.id ? "bg-accent text-accent-foreground border-accent" : "bg-card text-muted-foreground border-border hover:border-foreground/40"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Textarea
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-[12px] font-mono leading-relaxed"
      />

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
          onClick={() => void copy()}
        >
          <ClipboardCopy className="h-3 w-3" /> {copied ? "Copied!" : "Copy template"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
          onClick={() => void copy()}
        >
          <ClipboardCopy className="h-3 w-3" /> {copied ? "Copied!" : "Copy text"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={`h-7 text-[10px] ${actionButtonClass}`}
          onClick={reset}
        >
          Reset
        </Button>
        {!ctx.agentPhone && (
          <span className="text-[10px] text-warning self-center">
            ⚠ Set the TCM phone (in “Confirm tour”) so it auto-fills
          </span>
        )}
      </div>
    </div>
  );
}

function LeadActivityTimeline({ activities, tcms }: { activities: ActivityLog[]; tcms: TCM[] }) {
  const rows = activities
    .slice()
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .slice(0, 5);

  const actorName = (actor: string) =>
    tcms.find((t) => t.id === actor)?.name ??
    (actor === "flow-ops" ? "Flow Ops" : actor === "system" ? "System" : actor);

  return (
    <div className="rounded-md border border-border bg-card/70 p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <Activity className="h-3 w-3" /> Activity
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No activity logged yet.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 rounded border border-border/70 p-1.5 text-[11px]"
            >
              {a.kind === "call_logged" ? (
                <Phone className="h-3 w-3 text-accent mt-0.5" />
              ) : (
                <Activity className="h-3 w-3 text-muted-foreground mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {a.kind === "call_logged" ? `Call logged by ${actorName(a.actor)}` : a.text}
                </div>
                <div className="text-[10px] text-muted-foreground">{fmtActivityTime(a.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Negotiation playbook — 3 scripted paths                            */
/* ================================================================== */

function NegotiationPlaybook({
  lead,
  leadPhone,
  ctx,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  lead: Lead;
  leadPhone: string;
  ctx: ImpactTplCtx;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const setLeadStage = useApp((s) => s.setLeadStage);
  const currentUser = useApp((s) => s.tcms.find((t) => t.id === s.currentTcmId));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function resolveTemplate(template: string, lead: Lead, ctx: ImpactTplCtx): string {
    return template
      .replace(/\{price\}/g, lead.budget ? `₹${lead.budget.toLocaleString("en-IN")}` : "")
      .replace(
        /\{altPrice\}/g,
        lead.budget ? `₹${(lead.budget * 0.9).toLocaleString("en-IN")}` : "",
      )
      .replace(/\{propertyName\}/g, ctx.propertyName ?? "the property")
      .replace(/\{roomType\}/g, "triple")
      .replace(/\{leadName\}/g, lead.name ?? "")
      .replace(/\{agentName\}/g, ctx.agentName ?? currentUser?.name ?? "")
      .replace(/\{[^}]+\}/g, "");
  }

  const copyNegotiation = (msg: string, label: string) => {
    void copyText(msg, "Copied!");
    setLeadStage(lead.id, "negotiation");
    toast.success(`${label} copied`);
  };

  const paths: { key: ImpactScenario; title: string; tag: string }[] = [
    { key: "negotiate-hold", title: "Hold price · add value", tag: "Keep rent, sweeten the deal" },
    { key: "negotiate-alt", title: "Alternate room/property", tag: "Lower-priced swap" },
    { key: "negotiate-floor", title: "Floor price offer", tag: "Manager-approved minimum" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
        >
          <Sparkles className="h-3 w-3" /> Negotiate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-sm">Negotiation playbook · {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-160px)] pb-6 scroll-smooth">
          {paths.map((p) => (
            <div key={p.key} className="border border-border rounded-lg p-3 space-y-2">
              <div>
                <div className="text-xs font-semibold">{p.title}</div>
                <div className="text-[10px] text-muted-foreground">{p.tag}</div>
              </div>
              <div className="space-y-1.5">
                {IMPACT_TEMPLATES[p.key].map((tpl) => {
                  const msg = resolveTemplate(tpl.body, lead, ctx);
                  return (
                    <div key={tpl.id} className="rounded bg-muted/40 p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {tpl.label}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => {
                              void copyText(msg, "Copied!");
                              setCopiedId(tpl.id);
                              window.setTimeout(
                                () => setCopiedId((id) => (id === tpl.id ? null : id)),
                                2000,
                              );
                            }}
                          >
                            <ClipboardCopy className="h-3 w-3" />{" "}
                            {copiedId === tpl.id ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => copyNegotiation(msg, tpl.label)}
                          >
                            <ClipboardCopy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                      </div>
                      <div className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed">
                        {msg}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/*  Quick Add Lead                                                     */
/* ================================================================== */

function QuickAddLead({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onLeadSaved,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTcmId: string;
  tcmOptions: TCM[];
  onLeadSaved?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-[11px] gap-1">
          <Plus className="h-3 w-3" /> Add lead
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[calc(100dvh-24px)] w-[98vw] max-w-[1360px] flex-col gap-2 overflow-hidden p-3">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg">Paste a lead - auto-extract every field</DialogTitle>
        </DialogHeader>
        {open ? (
          <LeadPasteParser
            onDone={() => {
              onLeadSaved?.();
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ================================================================== */
/*  Schedule Tour                                                      */
/* ================================================================== */

function ScheduleTourDialog({
  lead,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  prefillPg,
  showTrigger = true,
  tcmOptions,
}: {
  lead: Lead;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  prefillPg?: PG | null;
  showTrigger?: boolean;
  tcmOptions: TCM[];
}) {
  const scheduleTour = useApp((s) => s.scheduleTour);
  const currentTcmId = useApp((s) => s.currentTcmId);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [selectedAgent, setSelectedAgent] = useState(lead.assignedTcmId ?? "");
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PG | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const today = todayISO();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => tourTimeSlotsForDate(today)[0] ?? "");
  const [tourType, setTourType] = useState<Tour["tourType"]>("physical");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && prefillPg) {
      setSelectedProperty(prefillPg);
      setPropertySearch(prefillPg.name);
    }
  }, [open, prefillPg]);

  useEffect(() => {
    if (!open || selectedAgent) return;
    const fallbackAgent = lead.assignedTcmId || tcmOptions[0]?.id || currentTcmId || "";
    if (fallbackAgent) setSelectedAgent(fallbackAgent);
  }, [currentTcmId, lead.assignedTcmId, open, selectedAgent, tcmOptions]);

  useEffect(() => {
    if (!open) return;
    const slots = tourTimeSlotsForDate(date);
    if (!slots.includes(time)) {
      setTime(slots[0] ?? "");
    }
  }, [date, open, time]);

  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    let list = PGS;
    if (q) {
      list = PGS.filter(
        (p) => p.name.toLowerCase().includes(q) || p.area?.toLowerCase().includes(q),
      );
    } else if (lead.preferredArea) {
      const byArea = PGS.filter((p) =>
        p.area.toLowerCase().includes(lead.preferredArea.toLowerCase()),
      );
      if (byArea.length > 0) list = byArea;
    }
    return list.slice(0, 6);
  }, [propertySearch, lead.preferredArea]);

  const resolvedAgentId =
    selectedAgent || lead.assignedTcmId || tcmOptions[0]?.id || currentTcmId || "";
  const timeOptions = useMemo(() => tourTimeSlotsForDate(date), [date]);
  const hasValidTime = Boolean(time) && timeOptions.includes(time);
  const scheduleErrors = {
    property: selectedProperty ? "" : "Property is required.",
    agent: resolvedAgentId ? "" : "Agent is required.",
    date: date && date >= today ? "" : "Date must be today or future.",
    time: hasValidTime
      ? ""
      : date === today
        ? "Pick a future time slot."
        : "Time slot is required.",
  };
  const canSchedule =
    !scheduleErrors.property &&
    !scheduleErrors.agent &&
    !scheduleErrors.date &&
    !scheduleErrors.time;

  const handleScheduleTour = async () => {
    setSubmitted(true);
    if (!canSchedule) return;
    const iso = new Date(`${date}T${time}:00`).toISOString();
    setScheduling(true);
    try {
      await scheduleTour({
        leadId: lead.id,
        propertyId: selectedProperty!.id,
        tcmId: resolvedAgentId,
        scheduledAt: iso,
        tourType,
      });
      toast.success("Tour scheduled successfully");
      setOpen(false);
      setPropertySearch("");
      setSelectedProperty(null);
      setTourType("physical");
      setSubmitted(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule tour. Try again.");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" className="h-7 text-[10px] gap-1">
            <Calendar className="h-3 w-3" /> Schedule
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Schedule tour · {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground">PROPERTY</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search or type new name..."
                value={propertySearch}
                onChange={(e) => {
                  setPropertySearch(e.target.value);
                  setSelectedProperty(null);
                }}
                className="w-full border border-border rounded-md pl-7 pr-3 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-primary h-8"
              />
            </div>
            {propertySearch || !selectedProperty ? (
              <div className="max-h-40 overflow-y-auto mt-1 space-y-1 border border-border rounded-md divide-y divide-border">
                {filteredProperties.length === 0 && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    No properties found
                  </div>
                )}
                {filteredProperties.map((property) => (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => {
                      setSelectedProperty(property);
                      setPropertySearch(property.name);
                    }}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 transition-colors",
                      selectedProperty?.id === property.id ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="font-medium">{property.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {property.area} · Property Hub
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {submitted && scheduleErrors.property && (
              <p className="mt-1 text-[10px] text-danger">{scheduleErrors.property}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground">ASSIGN TO</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-primary h-8"
            >
              <option value="">{resolvedAgentId ? "Auto assign" : "Select agent..."}</option>
              {tcmOptions.map((agent: any) => (
                <option key={agent.id} value={agent.id} className="bg-background">
                  {memberOptionLabel(agent)}
                </option>
              ))}
            </select>
            {resolvedAgentId && !selectedAgent && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Auto assigning to lead/current TCM.
              </p>
            )}
            {submitted && scheduleErrors.agent && (
              <p className="mt-1 text-[10px] text-danger">{scheduleErrors.agent}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Tour type</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {TOUR_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTourType(value)}
                  className={cn(
                    "h-10 rounded-md border text-[11px] flex items-center justify-center gap-1.5",
                    tourType === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-muted-foreground">Date</label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
              />
              {submitted && scheduleErrors.date && (
                <p className="mt-1 text-[10px] text-danger">{scheduleErrors.date}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase text-muted-foreground">Time</label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.length > 0 ? (
                    timeOptions.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {formatTime12h(slot)}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No slots left today. Pick tomorrow.
                    </div>
                  )}
                </SelectContent>
              </Select>
              {submitted && scheduleErrors.time && (
                <p className="mt-1 text-[10px] text-danger">{scheduleErrors.time}</p>
              )}
            </div>
          </div>

          <Button
            className={`w-full h-8 text-xs ${actionButtonClass}`}
            onClick={() => void handleScheduleTour()}
            disabled={scheduling || (submitted && !canSchedule)}
          >
            {scheduling && <RotateCcw className="h-3 w-3 mr-1 animate-spin" />}
            {scheduling ? "Scheduling..." : "Schedule tour"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/*  Confirm tour → send TCM details (with phone save)                  */
/* ================================================================== */

function ConfirmTourButton({ lead, tour }: { lead: Lead; tour: Tour }) {
  const tcms = useApp((s) => s.tcms);
  const opsProperties = useApp((s) => s.properties);
  const catalogProperty = resolvePropertyById(tour.propertyId, opsProperties);
  const tcm = tcms.find((item) => item.id === tour.tcmId);
  const phones = useTcmContacts((s) => s.phones);
  const setPhone = useTcmContacts((s) => s.setPhone);
  const [open, setOpen] = useState(false);
  const [phone, setPhoneLocal] = useState(phones[tour.tcmId] ?? "");

  const message = useMemo(() => {
    const tpl = IMPACT_TEMPLATES["tour-confirm"][0];
    return renderImpactTemplate(tpl, {
      leadName: lead.name.split(" ")[0],
      agentName: tcm?.name ?? "Gharpayy TCM",
      agentPhone: phone || "(coming soon)",
      propertyName: catalogProperty?.name ?? "Property",
      propertyAddress: catalogProperty?.area,
      tourWhen: fmtWhen(tour.scheduledAt),
    });
  }, [lead.name, phone, catalogProperty?.name, catalogProperty?.area, tcm?.name, tour.scheduledAt]);

  const handleSend = () => {
    if (phone) setPhone(tour.tcmId, normalizePhone(phone));
    void copyText(message, "Tour confirmation copied");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
          <ClipboardCopy className="h-3 w-3" /> Confirm tour
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Confirm tour to {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">
              TCM phone (saved for next time)
            </Label>
            <Input
              className="h-8 text-xs"
              placeholder="+91 9xxxxxxxxx"
              value={phone}
              onChange={(event) => setPhoneLocal(event.target.value)}
            />
          </div>
          <div className="rounded-lg p-3" style={{ background: "#075E54" }}>
            <div
              className="rounded-xl px-3 py-2 text-[12px] whitespace-pre-wrap font-mono"
              style={{ background: "#DCF8C6", color: "#111", borderRadius: "12px 12px 2px 12px" }}
            >
              {message}
            </div>
          </div>
          <Button className="w-full h-8 text-xs gap-1" onClick={handleSend}>
            <ClipboardCopy className="h-3 w-3" /> Copy confirmation
          </Button>
          <ReminderRow tour={tour} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReminderRow({ tour }: { tour: Tour }) {
  const addFollowUp = useApp((s) => s.addFollowUp);
  const opts = [
    { label: "2 h before", min: 120 },
    { label: "1 h before", min: 60 },
    { label: "30 m before", min: 30 },
  ];
  const setReminder = (min: number) => {
    const due = new Date(+new Date(tour.scheduledAt) - min * 60_000).toISOString();
    addFollowUp({
      leadId: tour.leadId,
      tourId: tour.id,
      tcmId: tour.tcmId,
      dueAt: due,
      priority: "high",
      reason: `Tour reminder · ${opts.find((option) => option.min === min)?.label}`,
    });
    toast.success("Reminder set");
  };
  return (
    <div className="border-t border-border pt-2">
      <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 flex items-center gap-1">
        <Timer className="h-2.5 w-2.5" /> Reminder
      </div>
      <div className="flex gap-1">
        {opts.map((option) => (
          <Button
            key={option.min}
            size="sm"
            variant="outline"
            className="h-7 text-[10px] flex-1"
            onClick={() => setReminder(option.min)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function QuotationDialog({
  lead,
  label = "Create quote",
  variant = "default",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  lead: Lead;
  label?: string;
  variant?: "default" | "ghost";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant={variant === "ghost" ? "ghost" : "default"}
            className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
          >
            <FileText className="h-3 w-3" /> {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Quotation · {lead.name}</DialogTitle>
        </DialogHeader>
        <QuotationBuilder lead={lead} embedded onSent={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BookingDialog({
  lead,
  quote,
  openTour,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  lead: Lead;
  quote: Quotation;
  openTour?: Tour;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}) {
  const closeDeal = useApp((s) => s.closeDeal);
  const { mutate: upsertCheckin } = useUpsertCheckin();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [amt, setAmt] = useState(quote.discountedPrice);
  const [closing, setClosing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            size="sm"
            className={`h-7 text-[10px] gap-1 bg-success text-success-foreground hover:bg-success/90 ${actionButtonClass}`}
          >
            <CheckCircle2 className="h-3 w-3" /> Book
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Close booking · {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground">
            {quote.propertyName} · {quote.roomType}
            {quote.roomNumber ? ` #${quote.roomNumber}` : ""}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Monthly rent</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={amt}
              onChange={(event) => setAmt(Number(event.target.value))}
            />
          </div>
          <div className="text-[10px] text-muted-foreground">
            Prebook collected: {formatINR(quote.prebook)} · Deposit: {formatINR(quote.deposit)}
          </div>
          <Button
            className={`w-full h-8 text-xs ${actionButtonClass}`}
            disabled={closing}
            onClick={() => {
              setClosing(true);
              try {
                closeDeal({
                  leadId: lead.id,
                  tourId: openTour?.id ?? "manual",
                  propertyId: quote.propertyId ?? openTour?.propertyId ?? "",
                  tcmId: lead.assignedTcmId,
                  amount: amt,
                });
                upsertCheckin({
                  leadId: lead.id,
                  rent: amt,
                  deposit: quote.deposit,
                  propertyId: quote.propertyId ?? openTour?.propertyId ?? undefined,
                  propertyName: quote.propertyName,
                });
                toast.success("Booking closed");
                setOpen(false);
              } catch {
                toast.error("Booking failed");
              } finally {
                setClosing(false);
              }
            }}
          >
            {closing && <RotateCcw className="h-3 w-3 mr-1 animate-spin" />}
            Confirm booking
          </Button>
          {!openTour && (
            <div className="text-[10px] text-warning">
              No tour found — booking will be marked as direct.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DirectBookButton({
  lead,
  openTour,
  opsProperties,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  lead: Lead;
  openTour?: Tour;
  opsProperties: Property[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const properties = opsProperties;
  const closeDeal = useApp((s) => s.closeDeal);
  const addProperty = useApp((s) => s.addProperty);
  const { mutateAsync: upsertCheckin } = useUpsertCheckin();
  const { mutateAsync: patchCheckin } = usePatchCheckin();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [propQuery, setPropQuery] = useState("");
  const [propId, setPropId] = useState(openTour?.propertyId ?? "");
  const [propName, setPropName] = useState("");
  const [rent, setRent] = useState(lead.budget);
  const [moveIn, setMoveIn] = useState(todayISO());
  const [mode, setMode] = useState<"upi" | "card" | "cash" | "bank">("upi");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(
    () =>
      searchPropertyCatalog(propQuery, properties, { preferredArea: lead.preferredArea, limit: 8 }),
    [properties, propQuery, lead.preferredArea],
  );

  const submit = async () => {
    let pid = propId;
    let name = propName || propQuery.trim();
    if (!pid && name) {
      const created = addProperty({
        name,
        area: lead.preferredArea,
        pricePerBed: rent,
        totalBeds: 1,
        vacantBeds: 1,
      });
      pid = created.id;
      name = created.name;
    }
    if (!pid) {
      toast.error("Pick or add a property");
      return;
    }
    if (rent <= 0) {
      toast.error("Rent must be greater than zero");
      return;
    }
    setSubmitting(true);
    try {
      closeDeal({
        leadId: lead.id,
        tourId: openTour?.id ?? "direct",
        propertyId: pid,
        tcmId: lead.assignedTcmId,
        amount: rent,
      });
      const resolved = resolvePropertyById(pid, properties);
      const ci = await upsertCheckin({
        leadId: lead.id,
        rent,
        propertyId: pid,
        propertyName: resolved?.name ?? name,
      });
      if (moveIn && ci) {
        await patchCheckin({
          id: ci.id,
          leadId: lead.id,
          patch: { checkInDate: new Date(moveIn).toISOString() },
        });
      }
      toast.success(`Direct booking · ${lead.name} · ${formatINR(rent)}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Direct booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
        >
          <Wallet className="h-3 w-3" /> Direct book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Direct book · {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Skip the funnel. Use this when the lead is ready right now.
          </p>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Property</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Search or type new"
                value={propQuery}
                onChange={(event) => {
                  setPropQuery(event.target.value);
                  setPropId("");
                }}
              />
            </div>
            <div className="max-h-32 overflow-y-auto mt-1 space-y-1">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPropId(item.id);
                    setPropQuery(item.name);
                    setPropName(item.name);
                    setRent(item.pricePerBed);
                  }}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded border ${propId === item.id ? "bg-primary/10 border-primary/40" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {item.area} · {formatINR(item.pricePerBed)}/bed
                    {item.source === "hub" ? " · Property Hub" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Monthly rent">
              <Input
                type="number"
                className="h-8 text-xs"
                value={rent}
                onChange={(event) => setRent(Number(event.target.value))}
              />
            </Field>
            <Field label="Move-in">
              <Input
                type="date"
                className="h-8 text-xs"
                value={moveIn}
                onChange={(event) => setMoveIn(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Payment mode">
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi" className="text-xs">
                  UPI
                </SelectItem>
                <SelectItem value="card" className="text-xs">
                  Card
                </SelectItem>
                <SelectItem value="cash" className="text-xs">
                  Cash
                </SelectItem>
                <SelectItem value="bank" className="text-xs">
                  Bank transfer
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button
            className={`w-full h-8 text-xs ${actionButtonClass}`}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting && <RotateCcw className="h-3 w-3 mr-1 animate-spin" />}
            Confirm direct booking
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckInOpsButton({
  lead,
  existing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  lead: Lead;
  existing?: CheckIn | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={existing ? "default" : "outline"}
          className={`h-7 text-[10px] gap-1 ${actionButtonClass}`}
        >
          <KeyRound className="h-3 w-3" /> Check-in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Check-in command · {lead.name}</DialogTitle>
        </DialogHeader>
        <CheckInPanel lead={lead} />
      </DialogContent>
    </Dialog>
  );
}

function CheckInAuditReport({
  checkin,
  lead,
  compact = false,
}: {
  checkin: CheckIn;
  lead: Lead;
  compact?: boolean;
}) {
  const risk = riskLevel(checkin);
  return (
    <div className="rounded-md border border-border bg-card/70 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <ScrollText className="h-3 w-3" /> Check-in audit report
        </div>
        <Badge variant="outline" className={`text-[9px] ${RISK_CLASS[risk]}`}>
          {RISK_LABEL[risk]}
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
        <AuditMetric label="Stage" value={STAGE_LABEL[checkin.stage]} />
        <AuditMetric label="Room" value={checkin.roomNumber || "Pending"} />
        <AuditMetric label="Balance" value={formatINR(checkin.balanceDue)} />
        <AuditMetric
          label="Delays"
          value={String(checkin.delays.length)}
          danger={checkin.delays.length >= 2}
        />
      </div>
      {!compact && (
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {checkin.history
            .slice()
            .reverse()
            .map((entry, index) => (
              <div
                key={`${entry.at}-${index}`}
                className="flex items-start gap-2 text-[10px] rounded border border-border/70 p-1.5"
              >
                <span className="font-mono text-muted-foreground shrink-0">
                  {fmtWhen(entry.at)}
                </span>
                <span className="flex-1">
                  {entry.note ?? `${lead.name}: ${STAGE_LABEL[entry.stage]}`}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AuditMetric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={`rounded border p-1.5 ${danger ? "border-danger/40 bg-danger/5 text-danger" : "border-border bg-muted/20"}`}
    >
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold truncate">{value}</div>
    </div>
  );
}

function tmName(t: { fullName?: string; name?: string }): string {
  return memberDisplayName(t, "—");
}

/* ================================================================== */
/*  Message Lab — preview every template variant, copy/send each       */
/* ================================================================== */

function MessageLabButton({ tcmOptions }: { tcmOptions: TCM[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-6 px-2 rounded-full text-[10px] uppercase tracking-wider font-semibold border border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 flex items-center gap-1"
      >
        <Beaker className="h-3 w-3" /> Message Lab
      </button>
      <MessageLabSheet open={open} onOpenChange={setOpen} tcmOptions={tcmOptions} />
    </>
  );
}

function MessageLabSheet({
  open,
  onOpenChange,
  tcmOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tcmOptions: TCM[];
}) {
  const opsProperties = useApp((s) => s.properties);
  const catalog = useMemo(() => allCatalogProperties(opsProperties), [opsProperties]);
  const phones = useTcmContacts((s) => s.phones);
  const [tcmId, setTcmId] = useState(tcmOptions[0]?.id ?? "");
  const [propId, setPropId] = useState(catalog[0]?.id ?? "");
  const [leadName, setLeadName] = useState("Aakash");
  const [leadPhone, setLeadPhone] = useState("");
  const [tourWhen, setTourWhen] = useState("Tomorrow, 11:00 AM");
  const [price, setPrice] = useState<number>(12000);
  const [altPrice, setAltPrice] = useState<number>(10500);
  const [budget, setBudget] = useState<number>(13000);
  const tcm = tcmOptions.find((item) => item.id === tcmId);
  const property = catalog.find((item) => item.id === propId);

  const ctx: ImpactTplCtx = useMemo(
    () => ({
      leadName,
      agentName: memberDisplayName(tcm, ""),
      agentPhone: phones[tcmId] ?? "",
      propertyName: property?.name,
      propertyAddress: property?.area,
      tourWhen,
      roomType: "Shared · Triple",
      price,
      altPrice,
      area: property?.area,
      budget,
      moveIn: fmtDate(new Date().toISOString()),
    }),
    [
      leadName,
      tcm,
      phones,
      tcmId,
      property?.name,
      property?.area,
      tourWhen,
      price,
      altPrice,
      budget,
    ],
  );

  const scenarios = Object.keys(IMPACT_TEMPLATES) as ImpactScenario[];
  const copy = (text: string) => copyText(text);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="border-b border-border bg-card px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-display flex items-center gap-2">
                <Beaker className="h-4 w-4 text-accent" /> Message Lab
              </SheetTitle>
              <SheetDescription className="text-[11px]">
                Tune the context once, then copy or send the right template fast.
              </SheetDescription>
            </div>
            <div className="rounded-lg border border-border bg-muted/35 px-3 py-2 text-right">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                Ready for
              </div>
              <div className="text-sm font-semibold">
                {leadName || "Lead"} · {property?.area ?? "Area"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Message context
              </div>
              <Badge variant="outline" className="text-[9px]">
                {property?.name ?? "No property selected"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Field label="Lead name">
                <Input
                  className="h-8 text-xs"
                  value={leadName}
                  onChange={(event) => setLeadName(event.target.value)}
                />
              </Field>
              <Field label="Lead phone">
                <Input
                  className="h-8 text-xs"
                  placeholder="+91 9xxxxxxxxx"
                  value={leadPhone}
                  onChange={(event) => setLeadPhone(event.target.value)}
                />
              </Field>
              <Field label="TCM">
                <Select value={tcmId} onValueChange={setTcmId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tcmOptions.map((item: any) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {memberOptionLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Property">
                <Select value={propId} onValueChange={setPropId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {item.name}
                        {item.source === "hub" ? " · Hub" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tour when">
                <Input
                  className="h-8 text-xs"
                  value={tourWhen}
                  onChange={(event) => setTourWhen(event.target.value)}
                />
              </Field>
              <Field label="Budget">
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                />
              </Field>
              <Field label="Price">
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                />
              </Field>
              <Field label="Alt price">
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={altPrice}
                  onChange={(event) => setAltPrice(Number(event.target.value))}
                />
              </Field>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto bg-muted/15 p-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {scenarios.map((scenario) => (
              <section key={scenario} className="space-y-2">
                <div className="sticky top-0 z-10 -mx-1 bg-muted/15 px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold backdrop-blur">
                  {scenario.replace(/-/g, " ")}
                </div>
                {IMPACT_TEMPLATES[scenario].map((tpl) => {
                  const text = renderImpactTemplate(tpl, ctx);
                  return (
                    <div
                      key={tpl.id}
                      className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase bg-background">
                          {tpl.label}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => copy(text)}
                          >
                            <ClipboardCopy className="h-3 w-3" /> Copy
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => copy(text)}
                          >
                            <ClipboardCopy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 rounded-lg bg-muted/35 p-2.5 text-[11px] whitespace-pre-wrap font-mono leading-relaxed text-foreground">
                        {text}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ================================================================== */
/*  10x Command Bar — live recompute pulse, streak, SLA, digest        */
/* ================================================================== */

function TenXCommandBar({
  lastRerank,
  escalations,
  counters,
  targets,
  stackSorted,
  tick,
  onFocusLead,
  digestOpen,
  onDigestOpenChange,
}: {
  lastRerank: number;
  escalations: number;
  counters: { leadsToday: number; toursToday: number; quotesToday: number; bookingsMonth: number };
  targets: { leadsToday: number; toursToday: number; quotesToday: number; bookingsMonth: number };
  stackSorted: Array<{
    lead: { id: string; name: string };
    score: number;
    nba: { label: string; pressure: string };
    column: string;
  }>;
  tick: number;
  onFocusLead?: (leadId: string) => void;
  digestOpen?: boolean;
  onDigestOpenChange?: (open: boolean) => void;
}) {
  const streak = counters.toursToday + counters.quotesToday + counters.bookingsMonth;
  const breach = escalations;
  const top5 = stackSorted.slice(0, 5);
  const stalled = stackSorted.filter((e) => e.nba.pressure === "escalate").slice(0, 5);
  const moved = Math.min(streak, 99);

  const ago = lastRerank === 0 ? 0 : Math.max(0, Math.floor((Date.now() - lastRerank) / 1000));
  const agoLabel =
    lastRerank === 0 ? "—" : ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`;
  void tick;

  const progress = Math.min(
    100,
    Math.round((counters.bookingsMonth / Math.max(targets.bookingsMonth, 1)) * 100),
  );

  return (
    <Dialog open={digestOpen} onOpenChange={onDigestOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[11px] px-2.5 bg-background"
        >
          <Sunrise className="h-3.5 w-3.5" /> Daily digest
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-accent" /> Today's digest
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <DigestStat label="Live re-rank" value={`${agoLabel} · auto 60s`} />
            <DigestStat label="Streak" value={`${moved} moved`} tone="success" />
            <DigestStat
              label="SLA breach"
              value={`${breach} leads`}
              tone={breach > 0 ? "danger" : "default"}
            />
            <DigestStat
              label="Month target"
              value={`${counters.bookingsMonth}/${targets.bookingsMonth}`}
              sub={`${progress}%`}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/25 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Today
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <DigestStat label="Leads" value={`${counters.leadsToday}/${targets.leadsToday}`} />
              <DigestStat label="Tours" value={`${counters.toursToday}/${targets.toursToday}`} />
              <DigestStat label="Quotes" value={`${counters.quotesToday}/${targets.quotesToday}`} />
              <DigestStat
                label="Bookings"
                value={`${counters.bookingsMonth}/${targets.bookingsMonth}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-border p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Moved</div>
              <div className="text-xl font-display font-semibold">{moved}</div>
            </div>
            <div className="rounded-md border border-border p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                Stalled
              </div>
              <div className="text-xl font-display font-semibold text-danger">{stalled.length}</div>
            </div>
            <div className="rounded-md border border-border p-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                Booked
              </div>
              <div className="text-xl font-display font-semibold text-success">
                {counters.bookingsMonth}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Tomorrow's top 5
            </div>
            <ol className="space-y-1">
              {top5.length === 0 && (
                <li className="text-xs text-muted-foreground italic">Queue clear.</li>
              )}
              {top5.map((e, i) => (
                <li key={e.lead.id}>
                  <button
                    type="button"
                    onClick={() => onFocusLead?.(e.lead.id)}
                    className="w-full flex items-center gap-2 text-xs rounded-md border border-border bg-card p-2 text-left hover:border-accent/50 hover:bg-accent/5 transition"
                  >
                    <span className="h-5 w-5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-medium truncate flex-1">{e.lead.name}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {e.nba.label}
                    </Badge>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {stalled.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-1">
                Stalled — escalate
              </div>
              <ul className="space-y-1">
                {stalled.map((e) => (
                  <li key={e.lead.id}>
                    <button
                      type="button"
                      onClick={() => onFocusLead?.(e.lead.id)}
                      className="w-full flex items-center gap-2 text-xs rounded-md border border-danger/30 bg-danger/5 p-2 text-left hover:border-danger/50 transition"
                    >
                      <Zap className="h-3 w-3 text-danger" />
                      <span className="font-medium truncate flex-1">{e.lead.name}</span>
                      <Badge variant="outline" className="text-[9px] border-danger/40 text-danger">
                        {e.nba.label}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => {
              const txt = `*Daily digest*\nMoved: ${moved}  ·  Stalled: ${stalled.length}  ·  Booked: ${counters.bookingsMonth}\n\nTomorrow's top 5:\n${top5.map((e, i) => `${i + 1}. ${e.lead.name} — ${e.nba.label}`).join("\n")}`;
              navigator.clipboard?.writeText(txt);
              markDigestSentToday();
              toast.success("Digest copied — paste into WhatsApp");
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy digest for WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DigestStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-display font-semibold leading-none",
          tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-danger"
              : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function DroppedLeadsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);

  const droppedLeads = useMemo(() => {
    return leads
      .filter((l) => l.stage === "dropped")
      .sort((a, b) => {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return tb - ta;
      });
  }, [leads]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border bg-card space-y-1">
          <SheetTitle className="text-sm flex items-center gap-2">
            <ArchiveX className="h-4 w-4 text-destructive" />
            Dropped / Lost Leads
          </SheetTitle>
          <SheetDescription className="text-xs">
            Leads marked as not interested or no-show without follow-up.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/10">
          {droppedLeads.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-8">
              No dropped leads.
            </div>
          ) : (
            droppedLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => {
                  useApp.getState().selectLead(lead.id);
                  onOpenChange(false);
                }}
                className="w-full text-left rounded-xl border border-border bg-card p-3 space-y-2 relative overflow-hidden transition hover:border-destructive/40 hover:bg-destructive/5"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-destructive/60" />
                <div className="flex justify-between items-start">
                  <div className="font-medium text-sm text-foreground truncate pl-2">
                    {lead.name || "Unknown Lead"}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] text-destructive border-destructive/20 bg-destructive/5 shrink-0"
                  >
                    Dropped
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground pl-2 space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3 w-3" /> {lead.phone}
                  </div>
                  {lead.preferredArea && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3" /> {lead.preferredArea}
                    </div>
                  )}
                  {lead.assignedTcmId && (
                    <div className="flex items-center gap-1.5 truncate pt-1">
                      <UserRound className="h-3 w-3" /> Assigned to{" "}
                      {tcms.find((t) => t.id === lead.assignedTcmId)?.name || lead.assignedTcmId}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
