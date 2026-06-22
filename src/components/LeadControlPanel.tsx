import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api/client";
import { useAuthUser } from "@/lib/auth-store";
import { useApp, getProperty, getTcm } from "@/lib/store";
import type { Tour as CrmTour } from "@/lib/types";
import { useAppState } from "@/myt/lib/app-context";
import { Tour } from "@/myt/lib/types";
import {
  memberDisplayName,
  memberOptionLabel,
  memberShortLabel,
  useOrgMembers,
  useActiveTcMs,
} from "@/hooks/useOrgDirectory";
import { notifyTourScheduled } from "@/lib/notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar, IntentChip, StageBadge } from "./atoms";
import { HandoffThread } from "./HandoffThread";
import { SequenceChip } from "./SequenceChip";
import { SupplyMatchPanel } from "./leads/SupplyMatchPanel";
import { PostVisitGate } from "./crm10x/PostVisitGate";
import { CommitmentBanner } from "./crm10x/CommitmentBanner";
import { ObjectionTag } from "./crm10x/ObjectionLogger";
import { LeadDossierPanel } from "./crm10x/LeadDossierPanel";
import { QuotationBuilder } from "./crm10x/QuotationBuilder";
import { LeadJourneyStepper, type JourneyTab } from "./crm10x/LeadJourneyStepper";
import { SmartDossier } from "./crm10x/SmartDossier";
import { LeadDeepProfile } from "./crm10x/LeadDeepProfile";
import { ObjectionLogger } from "./crm10x/ObjectionLogger";
import { useImpactStateForLead } from "./impact/ImpactQueue";
import { isTodayIST } from "@/lib/crm10x/dates";
import { useCRM10x } from "@/lib/crm10x/store";
import { computeBookingProbability, inferBestCallTime } from "@/lib/crm10x/intelligence";
import type { CallOutcome } from "@/lib/crm10x/types";
import {
  Phone,
  MessageSquare,
  Calendar as CalendarIcon,
  Tag,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X,
  Activity as ActivityIcon,
  MapPin,
  Wallet,
  Copy,
  Zap,
  BellRing,
  Building2,
  Video,
  Briefcase,
  UserCheck,
  Trophy,
  Search,
  Star,
  Sparkles,
  Clock,
  Home,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn, formatTime12h, localDateISO, tourTimeSlotsForDate } from "@/lib/utils";
import {
  formatBudget,
  formatAssignee,
  normalizeLeadName,
  pickRelevantActiveTour,
  resolveBestLeadName,
  profileCompletionScore,
  resolveLeadLocation,
} from "@/lib/lead-helpers";
import type { Lead, LeadStage, FollowUpPriority, SequenceKind } from "@/lib/types";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";
import { ActivityTimeline } from "@/components/activities/ActivityTimeline";
import { ActivityComposer } from "@/components/activities/ActivityComposer";
import { TodoPanel } from "@/components/todos/TodoPanel";
import { useActivities } from "@/hooks/useActivities";
import {
  allCatalogProperties,
  resolvePropertyById,
  searchPropertyCatalog,
} from "@/lib/crm10x/property-catalog";
import { pressureColor } from "@/lib/crm10x/impact-scoring";
import type { LeadFocusAction } from "@/lib/crm10x/impact-hard-actions";
import { formatINR, useQuotationsQuery } from "@/lib/crm10x/quotations";
import { CheckInPanel } from "@/components/checkins/CheckInPanel";
import { useLeadInterests, useToggleInterest } from "@/lib/crm10x/lead-interests";
import { PGDetail } from "@/property-genius/components/PGDetail";
import type { PG } from "@/property-genius/data/types";

const TAG_OPTIONS = [
  "price-issue",
  "location-mismatch",
  "parents-involved",
  "urgent",
  "budget-low",
];
const OBJECTIONS = [
  "Budget",
  "Location",
  "Amenities",
  "Timing",
  "Parents",
  "Comparing options",
  "Other",
];
const ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Studio"];
const BOOKING_SOURCES = ["ad", "referral", "organic", "whatsapp", "call", "walk-in"];
const DECISION_MAKERS = ["self", "parent", "group"];
const OTHER_PROPERTY_VALUE = "__others__";
const TOUR_TYPES = [
  { value: "physical", label: "Physical", icon: Building2 },
  { value: "virtual", label: "Virtual", icon: Video },
  { value: "pre-book-pitch", label: "Pre-book", icon: Briefcase },
];
const TOUR_TYPE_LABELS = Object.fromEntries(
  TOUR_TYPES.map((item) => [item.value, item.label]),
) as Record<string, string>;
const CALL_DURATION_OPTIONS = [
  { value: "0.5", label: "30 sec" },
  { value: "1", label: "1 min" },
  { value: "1.5", label: "1 min 30 sec" },
  { value: "2", label: "2 min" },
  { value: "2.5", label: "2 min 30 sec" },
  { value: "3", label: "3 min" },
  { value: "3.5", label: "3 min 30 sec" },
  { value: "4", label: "4 min" },
  { value: "4.5", label: "4 min 30 sec" },
  { value: "5", label: "5 min" },
  { value: "7.5", label: "7 min 30 sec" },
  { value: "10", label: "10 min" },
];
const FOLLOW_UP_TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});
const WORKFLOW_TAB_LABELS: Record<JourneyTab, string> = {
  impact: "Impact",
  tour: "Tour",
  post: "Post-tour",
  quote: "Quote",
  negotiation: "Negotiation",
  checkin: "Check-in",
};
const TEMPLATES = [
  {
    id: "tour-confirm",
    label: "Tour confirmation",
    body: "Hi! Confirming your tour today. Looking forward to meeting you.",
  },
  {
    id: "post-tour",
    label: "Post-tour check-in",
    body: "Hi! How did you find the property? Happy to answer any questions.",
  },
  {
    id: "scarcity",
    label: "Scarcity",
    body: "Just a heads-up - only a couple of beds left at this price.",
  },
];

function parseSafeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSafeDate(value: string | null | undefined, pattern: string, fallback = "-"): string {
  const d = parseSafeDate(value);
  return d ? format(d, pattern) : fallback;
}

function formatSafeDistance(value: string | null | undefined, fallback = "recently"): string {
  const d = parseSafeDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : fallback;
}

type DrawerScheduleAnswers = {
  bookingSource: string;
  decisionMaker: string;
  moveInDate: string;
  budget: string;
  occupation: string;
  workLocation: string;
  roomType: string;
  readyIn48h: boolean;
  exploring: boolean;
  comparing: boolean;
  needsFamily: boolean;
  willBookToday: string;
  keyConcern: string;
  tourType: string;
};

export function LeadControlPanel() {
  const reminderTimersRef = useRef<Map<string, number>>(new Map());
  const {
    selectedLeadId,
    selectedLeadTab,
    selectedLeadAction,
    selectLead,
    consumeSelectedLeadAction,
    leads,
    properties,
    tours,
    activities,
    tcms,
    setLeadStage,
    setLeadIntent,
    setLeadFollowUp,
    addLeadTag,
    removeLeadTag,
    scheduleTour,
    cancelTour,
    rescheduleTour,
    completeTour,
    updatePostTour,
    addNote,
    logCall,
    autoAssignLead,
    startSequence,
    markHandoffsRead,
    reassignLead,
  } = useApp();
  const { currentMemberId, setTours } = useAppState();
  const { members: orgMembers } = useOrgMembers();
  const authUser = useAuthUser((s) => s.user);

  useEffect(() => {
    return () => {
      reminderTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      reminderTimersRef.current.clear();
    };
  }, []);

  const scheduleLocalReminderAlert = (
    key: string,
    dueAt: string,
    title: string,
    description: string,
  ) => {
    if (typeof window === "undefined") return;
    const due = parseSafeDate(dueAt);
    if (!due) return;
    const existing = reminderTimersRef.current.get(key);
    if (existing) window.clearTimeout(existing);

    const notify = () => {
      toast.warning(title, { description, duration: 12000 });
      if ("Notification" in window && window.Notification.permission === "granted") {
        new window.Notification(title, { body: description });
      }
    };

    const ms = due.getTime() - Date.now();
    if (ms <= 0) {
      notify();
      return;
    }
    if (ms > 2_147_483_647) return;

    const timerId = window.setTimeout(notify, ms);
    reminderTimersRef.current.set(key, timerId);
    if ("Notification" in window && window.Notification.permission === "default") {
      void window.Notification.requestPermission();
    }
  };

  const lead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );
  const { data: drawerQuotes = [] } = useQuotationsQuery(selectedLeadId || "__none__");
  const hasPaidQuote = useMemo(
    () => drawerQuotes.some((quote) => quote.status === "paid"),
    [drawerQuotes],
  );
  const leadProfile = useCRM10x((s) => (selectedLeadId ? s.profiles[selectedLeadId] : undefined));
  const allObjections = useCRM10x((s) => s.objections);
  const leadObjections = useMemo(
    () => (lead ? allObjections.filter((item) => item.leadId === lead.id) : []),
    [allObjections, lead],
  );
  const { data: selectedInterestIdsRaw = [] } = useLeadInterests(selectedLeadId || "__none__");
  const selectedInterestIds = Array.isArray(selectedInterestIdsRaw) ? selectedInterestIdsRaw : [];
  const selectedInterestKey = selectedInterestIds.join("|");
  const tourPropertyOptions = useMemo(() => allCatalogProperties(properties), [properties]);
  const selectedTourPropertyOptions = useMemo(() => {
    const selected = selectedInterestIds
      .map((id) => resolvePropertyById(id, properties))
      .filter(Boolean);
    return selected.length > 0 ? selected : tourPropertyOptions;
  }, [properties, selectedInterestIds, tourPropertyOptions]);

  // Mark handoffs read when this lead opens
  useEffect(() => {
    if (selectedLeadId) markHandoffsRead(selectedLeadId);
  }, [selectedLeadId, markHandoffsRead]);

  const leadTours = useMemo(
    () =>
      lead
        ? tours
            .filter((tour) => {
              // Match by leadId (primary), then fallback to phone/name for legacy tours
              if (tour.leadId === lead.id) return true;
              return tour.phone === lead.phone || tour.leadName === lead.name;
            })
            .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
        : [],
    [tours, lead],
  );
  const leadActivities = useMemo(
    () => (lead ? activities.filter((a) => a.leadId === lead.id).slice(0, 30) : []),
    [activities, lead],
  );

  const { tcms: activeTcms } = useActiveTcMs();
  const tcmUsers = useMemo(() => {
    if (activeTcms && activeTcms.length > 0) {
      return activeTcms
        .map((a: any) => ({
          id: a.id,
          name: a.fullName ?? a.name,
          role: a.role ?? "tcm",
          zones: a.zones ?? (a.zone ? [a.zone] : []),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return orgMembers
      .filter((m) => m.role === "tcm" || m.isTcm !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, activeTcms]);
  const scheduleAssignees = useMemo(() => {
    if (authUser?.role !== "member") return tcmUsers;

    const selfFromDirectory = orgMembers.find((m) => m.id === authUser.id);
    const selfOption = selfFromDirectory
      ? { ...selfFromDirectory }
      : {
          id: authUser.id,
          name: authUser.fullName || authUser.username || authUser.email,
          role: "member",
          zones:
            (authUser as any).zones ?? ((authUser as any).zone ? [(authUser as any).zone] : []),
        };

    const unique = new Map<string, typeof selfOption>();
    for (const tcm of tcmUsers) unique.set(tcm.id, tcm);
    // Include the current user as an option only if they have TCM capability
    if (authUser?.isTcm) unique.set(selfOption.id, selfOption);
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [authUser, orgMembers, tcmUsers]);
  const defaultSelfAssigneeId = useMemo(() => {
    if (!authUser?.id) return "";
    if (authUser.role !== "tcm" && authUser.role !== "member") return "";
    return scheduleAssignees.some((option) => option.id === authUser.id) ? authUser.id : "";
  }, [authUser, scheduleAssignees]);

  // Tour scheduling form state
  const [tcmId, setTcmId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleAnswers, setScheduleAnswers] = useState({
    bookingSource: "whatsapp",
    decisionMaker: "self",
    moveInDate: "",
    budget: "",
    occupation: "",
    workLocation: "",
    roomType: "Single",
    readyIn48h: false,
    exploring: false,
    comparing: false,
    needsFamily: false,
    willBookToday: "maybe",
    keyConcern: "",
    tourType: "physical",
  });
  const [tab, setTab] = useState("impact");
  const previousLeadIdRef = useRef<string | null>(null);
  const previousRequestedTabRef = useRef<string | null>(null);
  const [, mounted] = useMountedNow();

  // Note state
  const [note, setNote] = useState("");
  const [customMsg, setCustomMsg] = useState("");

  const pendingPostTour = leadTours.find((t) => t.status === "completed" && !t.postTour.filledAt);
  const completedPostTour = leadTours.find((t) => t.status === "completed" && t.postTour.filledAt);
  const upcomingTour = pickRelevantActiveTour(leadTours);
  const hasScheduledTour = Boolean(upcomingTour) || lead?.stage === "tour-scheduled";
  const scheduledTourActivity =
    leadActivities.find(
      (a) => (a.kind === "tour_scheduled" || a.kind === "site_visit") && a.tourId,
    ) ?? null;
  const scheduledTourFromActivity = scheduledTourActivity?.tourId
    ? tours.find((candidate) => candidate.id === scheduledTourActivity.tourId)
    : null;
  const tourToShow =
    upcomingTour ?? scheduledTourFromActivity ?? (hasScheduledTour ? (leadTours[0] ?? null) : null);
  const currentWorkTab: JourneyTab = (() => {
    if (!lead) return "impact";
    if (lead.stage === "booked" || hasPaidQuote) return "checkin";
    if (lead.stage === "negotiation") return "negotiation";
    if (lead.stage === "quote-sent") return "quote";
    if (completedPostTour) return "quote";
    if (pendingPostTour || lead.stage === "tour-done") return "post";
    if (hasScheduledTour || lead.stage === "tour-scheduled" || lead.stage === "on-tour")
      return "tour";
    return "impact";
  })();

  useEffect(() => {
    if (!lead) return;
    const tourAssigneeId = tourToShow?.tcmId ?? "";
    const isSelfDefaultRole = authUser?.role === "tcm" || authUser?.role === "member";
    const roleDefaultAssignee = isSelfDefaultRole ? defaultSelfAssigneeId : "";
    const preferredAssignee = tourAssigneeId || lead.assignedTcmId || currentMemberId || "";
    const preferredExists = preferredAssignee
      ? scheduleAssignees.some((option) => option.id === preferredAssignee)
      : false;
    setTcmId(roleDefaultAssignee || (preferredExists ? preferredAssignee : ""));
    setPropertyId(tourToShow?.propertyId ?? selectedInterestIds[0] ?? "");
    setScheduledAt(tourToShow ? toLocal(tourToShow.scheduledAt) : "");
    setScheduleAnswers((answers) => ({
      ...answers,
      bookingSource: profileToBookingSource(leadProfile?.source) || answers.bookingSource,
      decisionMaker: profileToDecisionMaker(leadProfile?.decisionMaker) || answers.decisionMaker,
      budget: String(leadProfile?.budgetStated || lead.budget || ""),
      moveInDate: profileDateToInput(leadProfile?.preferredMoveInDate || lead.moveInDate),
      occupation: leadProfile?.companyOrCollege || answers.occupation,
      workLocation:
        preferenceAreasForLead(lead).join(", ") || lead.preferredArea || answers.workLocation,
      roomType: profileToScheduleRoomType(leadProfile?.roomType) || lead.room || answers.roomType,
      keyConcern: latestConcernFromObjections(leadObjections) || answers.keyConcern,
    }));
    const requestedTab = selectedLeadTab === "dossier" ? "impact" : selectedLeadTab;
    setTab((previousTab) => {
      const isNewLead = previousLeadIdRef.current !== lead.id;
      const isNewTabRequest = requestedTab !== previousRequestedTabRef.current;
      previousLeadIdRef.current = lead.id;
      previousRequestedTabRef.current = requestedTab;
      if (requestedTab && (isNewLead || isNewTabRequest)) return requestedTab;
      if (isNewLead) return currentWorkTab;
      return previousTab || "impact";
    });
  }, [
    authUser?.role,
    currentWorkTab,
    currentMemberId,
    defaultSelfAssigneeId,
    hasScheduledTour,
    lead,
    leadProfile,
    leadObjections,
    scheduleAssignees,
    selectedLeadTab,
    selectedInterestKey,
    tourToShow,
  ]);

  useEffect(() => {
    if (!lead || !hasScheduledTour || leadTours.length > 0 || scheduledTourFromActivity) return;
    let cancelled = false;

    void (async () => {
      try {
        const { items } = await api.tours.list();
        if (cancelled) return;

        const wireTour = items.find(
          (tour) =>
            tour.leadId === lead.id && (tour.status === "scheduled" || tour.status === "confirmed"),
        );
        if (!wireTour) return;

        // 1. Add to CRM store so tourToShow / leadTours can find it
        const crmTour: CrmTour = {
          id: wireTour._id,
          leadId: wireTour.leadId,
          propertyId: wireTour.propertyId ?? undefined,
          tcmId: wireTour.assignedTo,
          scheduledBy: wireTour.scheduledBy,
          scheduledAt: wireTour.scheduledAt,
          status: wireTour.status as CrmTour["status"],
          decision: null,
          postTour: {
            outcome: null,
            confidence: 0,
            objection: null,
            objectionNote: "",
            expectedDecisionAt: null,
            nextFollowUpAt: null,
            filledAt: null,
          },
          createdAt: wireTour.createdAt,
          updatedAt: wireTour.updatedAt ?? wireTour.createdAt,
        };
        useApp.setState((s) => ({
          tours: s.tours.some((t) => t.id === crmTour.id)
            ? s.tours.map((t) => (t.id === crmTour.id ? { ...t, ...crmTour } : t))
            : [crmTour, ...s.tours],
        }));

        // 2. Also add MYT-format tour for /myt/schedule
        const hydratedLocation = resolveLeadLocation(lead, tours, properties);
        const property = wireTour.propertyId
          ? tourPropertyOptions.find((p) => p.id === wireTour.propertyId)
          : undefined;
        const assignedTo = orgMembers.find((member) => member.id === wireTour.assignedTo);
        const scheduledBy = orgMembers.find((member) => member.id === wireTour.scheduledBy);
        const hydratedTour: Tour = {
          id: wireTour._id,
          leadId: wireTour.leadId,
          leadName: resolveBestLeadName(lead),
          phone: lead.phone || "",
          assignedTo: wireTour.assignedTo,
          assignedToName: assignedTo ? memberShortLabel(assignedTo) : wireTour.assignedTo,
          propertyName: property?.name ?? hydratedLocation.propertyName ?? "Property Hub option",
          propertyId: wireTour.propertyId ?? undefined,
          area: hydratedLocation.area,
          zoneId: "",
          tourDate: wireTour.scheduledAt.slice(0, 10),
          tourTime: wireTour.scheduledAt.slice(11, 16),
          bookingSource: wireTour.bookingSource as Tour["bookingSource"],
          scheduledBy: wireTour.scheduledBy,
          scheduledByName: scheduledBy ? memberShortLabel(scheduledBy) : wireTour.scheduledBy,
          leadType: "future",
          status: wireTour.status as Tour["status"],
          showUp: null,
          outcome: null,
          remarks: "",
          budget: lead.budget || 0,
          createdAt: wireTour.createdAt,
          tourType: (wireTour.tourType ?? "physical") as Tour["tourType"],
          intent: "medium",
          confidenceScore: 50,
          confidenceReason: [],
          confirmationStrength: "tentative",
          qualification: {
            moveInDate: lead.moveInDate || "",
            decisionMaker: "self",
            roomType: "Single",
            occupation: "",
            workLocation: lead.preferredArea || "",
            willBookToday: "maybe",
            readyIn48h: false,
            exploring: false,
            comparing: false,
            needsFamily: false,
            keyConcern: "",
          },
          tokenPaid: false,
          whyLost: null,
        };

        setTours((prev) =>
          prev.some((tour) => tour.id === hydratedTour.id)
            ? prev.map((tour) =>
                tour.id === hydratedTour.id ? { ...tour, ...hydratedTour } : tour,
              )
            : [hydratedTour, ...prev],
        );
      } catch (err) {
        console.warn(
          "[LeadControlPanel] failed to hydrate scheduled tour:",
          (err as Error).message,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasScheduledTour,
    lead,
    leadTours.length,
    orgMembers,
    properties,
    scheduledTourFromActivity,
    setTours,
    tourPropertyOptions,
    tours,
  ]);

  const leadLocation = useMemo(
    () =>
      lead
        ? resolveLeadLocation(lead, tours, properties)
        : { area: "", propertyName: null, source: "fallback" as const },
    [lead, tours, properties],
  );
  const drawerImpactState = useImpactStateForLead(lead);

  if (!lead) return null;

  const displayLeadName = resolveBestLeadName(lead);
  const assignedMemberId = lead.assignedTcmId || lead.assigneeId || "";
  const tcm = getTcm(assignedMemberId);
  const selectedMember = orgMembers.find((m) => m.id === assignedMemberId) ?? null;
  const actualPropertyName = tourToShow?.propertyId
    ? (tourPropertyOptions.find((property) => property.id === tourToShow.propertyId)?.name ??
      getProperty(tourToShow.propertyId, properties)?.name ??
      null)
    : null;
  const assignmentLabel = selectedMember
    ? memberShortLabel(selectedMember)
    : formatAssignee(assignedMemberId, tcm?.name);

  const handleSchedule = async () => {
    if (!tcmId || !scheduledAt) {
      toast.error("Member and time are required");
      return;
    }
    const assignee = scheduleAssignees.find((m) => m.id === tcmId) ?? null;
    const scheduler = currentMemberId
      ? (orgMembers.find((m) => m.id === currentMemberId) ?? null)
      : null;

    try {
      const selectedPropertyId =
        propertyId === OTHER_PROPERTY_VALUE ? undefined : propertyId || undefined;
      const tour = await scheduleTour({
        leadId: lead.id,
        propertyId: selectedPropertyId,
        tcmId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        tourType: scheduleAnswers.tourType as CrmTour["tourType"],
      });

      // MYT tour is created by LiveToursBridge from the server event.
      // Only create a local MYT entry as a fast optimistic update so /myt/schedule
      // shows the tour immediately. LiveToursBridge will reconcile later.
      const scheduledDateTime = new Date(scheduledAt);
      const mytTour = {
        id: tour.id,
        leadId: lead.id,
        leadName: displayLeadName,
        phone: lead.phone || "",
        assignedTo: tcmId,
        assignedToName: assignee ? memberShortLabel(assignee) : "Member",
        propertyName: selectedPropertyId
          ? (tourPropertyOptions.find((p) => p.id === selectedPropertyId)?.name ??
            leadLocation.propertyName ??
            "Property Hub option")
          : (leadLocation.propertyName ?? "Property Hub option"),
        propertyId: selectedPropertyId,
        area: leadLocation.area,
        zoneId: "",
        tourDate: scheduledDateTime.toISOString().split("T")[0],
        tourTime: scheduledDateTime.toTimeString().split(" ")[0].substring(0, 5),
        bookingSource: scheduleAnswers.bookingSource as Tour["bookingSource"],
        scheduledBy: scheduler?.id ?? currentMemberId ?? tcmId,
        scheduledByName: scheduler ? memberShortLabel(scheduler) : "You",
        leadType: "future" as const,
        status: "scheduled" as const,
        showUp: null,
        outcome: null,
        remarks: "",
        budget: lead.budget || 0,
        createdAt: new Date().toISOString(),
        tourType: scheduleAnswers.tourType as Tour["tourType"],
        intent: "medium" as const,
        confidenceScore: 50,
        confidenceReason: [],
        confirmationStrength: "tentative" as const,
        qualification: {
          moveInDate: scheduleAnswers.moveInDate || lead.moveInDate || "",
          decisionMaker: scheduleAnswers.decisionMaker as Tour["qualification"]["decisionMaker"],
          roomType: scheduleAnswers.roomType,
          budget: scheduleAnswers.budget || String(lead.budget || ""),
          occupation: scheduleAnswers.occupation,
          workLocation: scheduleAnswers.workLocation || leadLocation.area,
          readyIn48h: scheduleAnswers.readyIn48h,
          exploring: scheduleAnswers.exploring,
          comparing: scheduleAnswers.comparing,
          needsFamily: scheduleAnswers.needsFamily,
          willBookToday: scheduleAnswers.willBookToday as Tour["qualification"]["willBookToday"],
          keyConcern: scheduleAnswers.keyConcern,
          tourType: scheduleAnswers.tourType as Tour["tourType"],
        },
        tokenPaid: false,
        whyLost: null,
      };
      setTours((prev) => {
        // Avoid duplicates if LiveToursBridge already added it
        if (prev.some((t) => t.id === mytTour.id)) return prev;
        return [mytTour, ...prev];
      });

      notifyTourScheduled({
        tourId: tour.id,
        leadId: lead.id,
        leadName: displayLeadName,
        senderId: scheduler?.id ?? currentMemberId ?? tcmId,
        senderName: scheduler?.name ?? "You",
        assigneeName: assignee?.name ?? "Member",
        recipientIds: [
          { id: tcmId, name: memberDisplayName(assignee, "Member") },
          ...(scheduler?.id && scheduler.id !== tcmId
            ? [{ id: scheduler.id, name: scheduler.name }]
            : []),
        ],
      });
      setTcmId(defaultSelfAssigneeId);
      setPropertyId("");
      setScheduledAt("");
      setTab("tour");

      if (tcmId !== lead.assignedTcmId) {
        reassignLead(lead.id, tcmId, "Assigned to tour manager");
      }

      toast.success("Tour scheduled");
    } catch (err) {
      console.error("[LeadControlPanel] Failed to schedule tour:", err);
      toast.error("Failed to schedule tour. Please try again.");
    }
  };

  const tabTriggerClass =
    "relative h-auto rounded-none border-0 bg-transparent px-0 pb-3 pt-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-foreground transition-colors";

  return (
    <Sheet open={!!selectedLeadId} onOpenChange={(o) => !o && selectLead(null)}>
      <SheetContent
        side="right"
        className="w-full p-0 flex flex-col overflow-y-auto transition-all duration-300"
        style={{ maxWidth: 560 }}
      >
        {/* Header block */}
        <SheetHeader className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="font-display text-base leading-tight">
                {displayLeadName}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {lead.phone} · via {lead.source}
              </SheetDescription>
            </div>
            {drawerImpactState && (
              <div
                className={`min-w-[118px] rounded-md border px-2 py-1.5 text-right ${pressureColor(drawerImpactState.nba.pressure)}`}
              >
                <div className="text-[9px] uppercase tracking-wider opacity-70">Next action</div>
                <div className="text-xs font-semibold truncate">{drawerImpactState.nba.label}</div>
                <div className="flex items-center justify-end gap-1 text-[11px] font-semibold">
                  <Trophy className="h-3 w-3" />
                  {drawerImpactState.score}%
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StageBadge stage={lead.stage} />
            <IntentChip intent={lead.intent} />
            <ConfidenceBar value={lead.confidence} />
            <ObjectionTag leadId={lead.id} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              <CalendarIcon className="mr-1 inline h-3 w-3" />
              Move-in:{" "}
              <b className="font-medium text-foreground">
                {formatSafeDate(lead.moveInDate, "MMM d", "TBD")}
              </b>
            </span>
            <span>
              <Wallet className="mr-1 inline h-3 w-3" />
              Budget: <b className="font-medium text-foreground">{formatBudget(lead.budget)}</b>
            </span>
            <span>
              <MapPin className="mr-1 inline h-3 w-3" />
              Area: <b className="font-medium text-foreground">{leadLocation.area}</b>
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {actualPropertyName ? <>{actualPropertyName} · </> : null}
            {assignmentLabel === "Unassigned"
              ? "Not assigned yet"
              : `Assigned · ${assignmentLabel}`}
          </div>
        </SheetHeader>

        <LeadJourneyStepper lead={lead} currentTab={tab} onJump={(t: JourneyTab) => setTab(t)} />

        {/* CRM 10x - commitment banner + 48h post-visit gate */}
        <CommitmentBanner lead={lead} />
        <PostVisitGate lead={lead} />

        {/* Stale alert */}
        {pendingPostTour && (
          <div className="mx-5 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Post-tour pending</div>
              <div className="text-muted-foreground">Fill the post-tour outcome.</div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-none">
          <Tabs value={tab} onValueChange={setTab} className="px-6 pt-5 pb-6">
            {/* Quiet underline tab bar — single horizontal scroll, no chrome */}
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border/60 bg-transparent p-0 overflow-x-auto scrollbar-thin">
              {(() => {
                const isVisitReady =
                  lead?.tags?.includes("impact:visit-ready") || Boolean(leadProfile?.visitReadyAt);
                const tourUnlocked =
                  isVisitReady ||
                  hasScheduledTour ||
                  ["on-tour", "tour-done", "quote-sent", "negotiation", "booked"].includes(
                    lead.stage,
                  );
                const postUnlocked =
                  Boolean(pendingPostTour || completedPostTour) ||
                  ["tour-done", "quote-sent", "negotiation", "booked"].includes(lead.stage);
                const quoteUnlocked =
                  Boolean(completedPostTour) ||
                  hasPaidQuote ||
                  ["quote-sent", "negotiation", "booked"].includes(lead.stage);
                const negotiationUnlocked = ["quote-sent", "negotiation", "booked"].includes(
                  lead.stage,
                );
                const checkinUnlocked = lead.stage === "booked" || hasPaidQuote;
                const workflowTabs: Array<{ key: JourneyTab; enabled: boolean }> = [
                  { key: "impact", enabled: true },
                  { key: "tour", enabled: tourUnlocked },
                  { key: "post", enabled: postUnlocked },
                  { key: "quote", enabled: quoteUnlocked },
                  { key: "negotiation", enabled: negotiationUnlocked },
                  { key: "checkin", enabled: checkinUnlocked },
                ];
                return workflowTabs
                  .filter(({ enabled }) => enabled)
                  .map(({ key: workflowTab }) => (
                    <TabsTrigger key={workflowTab} value={workflowTab} className={tabTriggerClass}>
                      {WORKFLOW_TAB_LABELS[workflowTab]}
                      {workflowTab === "post" && pendingPostTour && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" />
                      )}
                    </TabsTrigger>
                  ));
              })()}
            </TabsList>

            <TabsContent value="activity" className="space-y-3 pt-4">
              <LeadActivityTab leadId={lead.id} />
            </TabsContent>

            <TabsContent value="tasks" className="pt-4">
              <TodoPanel entityType="lead" entityId={lead.id} />
            </TabsContent>

            <TabsContent value="details" className="pt-4 space-y-4">
              <Section title="Lead Details (from creation)">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {lead.email && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Email</Label>
                      <div>{lead.email}</div>
                    </div>
                  )}
                  {lead.type && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
                      <div className="capitalize">{lead.type}</div>
                    </div>
                  )}
                  {lead.room && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Room preference
                      </Label>
                      <div className="capitalize">{lead.room}</div>
                    </div>
                  )}
                  {lead.need && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Gender need
                      </Label>
                      <div className="capitalize">{lead.need}</div>
                    </div>
                  )}
                  {lead.quality && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Quality</Label>
                      <div className="capitalize">{lead.quality}</div>
                    </div>
                  )}
                  {lead.inBLR !== null && lead.inBLR !== undefined && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">In BLR</Label>
                      <div>{lead.inBLR ? "Yes" : "No"}</div>
                    </div>
                  )}
                  {lead.zoneCategory && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Zone Category
                      </Label>
                      <div>{lead.zoneCategory}</div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Current Stage
                    </Label>
                    <div className="capitalize">{lead.stage.replace("-", " ")}</div>
                  </div>
                </div>
                {lead.areas && lead.areas.length > 0 && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-[10px] uppercase text-muted-foreground">Areas</Label>
                    <div className="text-sm">{lead.areas.join(", ")}</div>
                  </div>
                )}
                {lead.fullAddress && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Full Address
                    </Label>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                      {lead.fullAddress}
                    </div>
                  </div>
                )}
                {lead.specialReqs && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Special Requirements
                    </Label>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md whitespace-pre-wrap">
                      {lead.specialReqs}
                    </div>
                  </div>
                )}
                {lead.notes && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Original Notes
                    </Label>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md whitespace-pre-wrap">
                      {lead.notes}
                    </div>
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="quote" className="space-y-4 pt-4">
              <QuotationBuilder lead={lead} onPaid={() => setTab("checkin")} />
            </TabsContent>

            <TabsContent value="negotiation" className="space-y-4 pt-4">
              <NegotiationTab lead={lead} />
            </TabsContent>

            <TabsContent value="checkin" className="space-y-4 pt-4">
              <CheckInPanel lead={lead} />
            </TabsContent>

            <TabsContent value="impact" className="space-y-4 pt-4">
              <ImpactTabContent
                lead={lead}
                pendingAction={selectedLeadAction}
                onPendingActionConsumed={consumeSelectedLeadAction}
                onGoTour={() => setTab("tour")}
              />
            </TabsContent>

            <TabsContent value="best-fit" className="space-y-4 pt-4">
              <Section title="Best property matches">
                <SupplyMatchPanel lead={lead} onNavigateAway={() => selectLead(null)} />
              </Section>
            </TabsContent>

            {/* CONTROL - status, intent, follow-up, action engine, notes, tags */}
            <TabsContent value="control" className="space-y-4 pt-4">
              <SequenceChip leadId={lead.id} />

              <Section title="Routing">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const r = autoAssignLead(lead.id);
                      const tcm = tcms.find((t) => t.id === r.tcmId);
                      toast.success(`Auto-routed to ${tcm?.name ?? "TCM"}`, {
                        description: r.reasons.join(" · "),
                      });
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" /> Auto-route to best TCM
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Currently with{" "}
                  <span className="text-foreground font-medium">
                    {selectedMember ? memberShortLabel(selectedMember) : "-"}
                  </span>
                </div>
              </Section>

              <Section title="Status engine">
                <Select
                  value={lead.stage}
                  onValueChange={(v) => {
                    const prev = lead.stage;
                    const next = v as LeadStage;
                    void (async () => {
                      try {
                        await setLeadStage(lead.id, next);
                        if (v === "dropped") {
                          toast("Marked dropped", {
                            description: `${displayLeadName} → dropped`,
                            action: {
                              label: "Undo",
                              onClick: () => {
                                void setLeadStage(lead.id, prev)
                                  .then(() => toast.success("Restored"))
                                  .catch((err) =>
                                    toast.error(
                                      (err as Error).message || "Failed to restore stage",
                                    ),
                                  );
                              },
                            },
                            duration: 5000,
                          });
                        }
                      } catch (err) {
                        toast.error((err as Error).message || "Failed to update status");
                      }
                    })();
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "new",
                        "contacted",
                        "tour-scheduled",
                        "tour-done",
                        "negotiation",
                        "not-responding-3d",
                        "not-responding-7d",
                        "booked",
                        "dropped",
                      ] as LeadStage[]
                    ).map((s) => (
                      <SelectItem key={s} value={s} className="text-sm capitalize">
                        {s.replace("-", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(
                    ["first-contact", "post-tour", "pre-decision", "cold-revival"] as SequenceKind[]
                  ).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        startSequence(lead.id, k);
                        toast.success(`Started ${k} sequence`);
                      }}
                    >
                      Start {k}
                    </Button>
                  ))}
                </div>
              </Section>

              <Section title="Action engine">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      logCall(lead.id);
                      toast.success("Call logged");
                    }}
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" /> Call
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(TEMPLATES[0]?.body ?? "")
                        .then(() => toast.success("Template copied"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy text
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Templates
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((t) => (
                      <Button
                        key={t.id}
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(t.body)
                            .then(() => toast.success(`Copied: ${t.label}`));
                        }}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Custom message…"
                    className="h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!customMsg.trim()}
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(customMsg)
                        .then(() => toast.success("Copied"));
                      setCustomMsg("");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Section>

              <Section title="Follow-up engine">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Next follow-up
                    </Label>
                    <Input
                      type="datetime-local"
                      defaultValue={lead.nextFollowUpAt ? toLocal(lead.nextFollowUpAt) : ""}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setLeadFollowUp(
                          lead.id,
                          new Date(e.target.value).toISOString(),
                          priorityFor(lead.confidence),
                        );
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Priority
                    </Label>
                    <Select
                      value={
                        lead.intent === "hot" ? "high" : lead.intent === "warm" ? "medium" : "low"
                      }
                      onValueChange={(v) =>
                        setLeadIntent(
                          lead.id,
                          v === "high" ? "hot" : v === "medium" ? "warm" : "cold",
                        )
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Hot</SelectItem>
                        <SelectItem value="medium">Warm</SelectItem>
                        <SelectItem value="low">Cold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {lead.nextFollowUpAt && (
                  <div className="text-[11px] text-muted-foreground">
                    Due {mounted ? formatSafeDistance(lead.nextFollowUpAt, "soon") : "soon"}
                  </div>
                )}
              </Section>

              <Section title="Notes & signals">
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      {t}
                      <button
                        onClick={() => removeLeadTag(lead.id, t)}
                        className="hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.filter((t) => !lead.tags.includes(t)).map((t) => (
                    <button
                      key={t}
                      onClick={() => addLeadTag(lead.id, t)}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note…"
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <Button
                    size="sm"
                    disabled={!note.trim()}
                    onClick={() => {
                      addNote(lead.id, note);
                      setNote("");
                      toast.success("Note added");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </Section>
            </TabsContent>

            {/* TOUR */}
            <TabsContent value="tour" className="space-y-4 pt-4">
              {tourToShow ? (
                <Section title="Tour">
                  <UpcomingTourCard
                    tour={tourToShow}
                    members={orgMembers}
                    leadName={displayLeadName}
                  />
                </Section>
              ) : null}

              {!hasScheduledTour ? (
                <InlineScheduleTour
                  lead={lead}
                  properties={selectedTourPropertyOptions}
                  tcms={scheduleAssignees}
                  propertyId={propertyId}
                  tcmId={tcmId}
                  scheduledAt={scheduledAt}
                  answers={scheduleAnswers}
                  onAnswersChange={(patch: Partial<DrawerScheduleAnswers>) =>
                    setScheduleAnswers((answers) => ({ ...answers, ...patch }))
                  }
                  onPropertyChange={setPropertyId}
                  onTcmChange={setTcmId}
                  onScheduledAtChange={setScheduledAt}
                  onSchedule={handleSchedule}
                />
              ) : null}

              {leadTours.length > 1 && (
                <Section title="Tour history">
                  <div className="space-y-2">
                    {leadTours.slice(upcomingTour ? 1 : 0).map((t) => {
                      const prop = getProperty(t.propertyId, properties);
                      return (
                        <div
                          key={t.id}
                          className="rounded-lg border border-border bg-card p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{prop?.name}</span>
                            <span className="text-muted-foreground">
                              {formatSafeDate(t.scheduledAt, "MMM d, p", "time unknown")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <Badge variant="outline" className="capitalize">
                              {t.status}
                            </Badge>
                            {t.decision && (
                              <Badge variant="outline" className="capitalize">
                                {t.decision}
                              </Badge>
                            )}
                            {t.postTour.filledAt ? (
                              <span className="text-success inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Post-tour done
                              </span>
                            ) : t.status === "completed" ? (
                              <span className="text-destructive inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Post-tour pending
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </TabsContent>

            {/* POST-TOUR */}
            <TabsContent value="post" className="space-y-4 pt-4">
              {(() => {
                const target = pendingPostTour ?? leadTours.find((t) => t.status === "completed");
                if (!target) {
                  return (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No completed tours yet. The post-tour form appears here once a tour is marked
                      complete.
                    </div>
                  );
                }
                const prop = getProperty(target.propertyId, properties);
                const catalogPostTourProperty = target.propertyId
                  ? resolvePropertyById(target.propertyId, properties)
                  : null;
                const rawPostTourPropertyName =
                  prop?.name ??
                  catalogPostTourProperty?.name ??
                  (target as any).propertyName ??
                  target.customPropertyName ??
                  leadLocation.propertyName ??
                  lead.propertyName ??
                  "";
                const postTourPropertyName =
                  rawPostTourPropertyName.trim() &&
                  rawPostTourPropertyName.trim().toLowerCase() !== "property"
                    ? rawPostTourPropertyName.trim()
                    : "Property not selected";
                const pt = target.postTour;
                const leadFirstName = resolveBestLeadName(lead).split(" ")[0] || "there";
                const postTourFollowUpAt = () => {
                  if (pt.nextFollowUpAt && parseSafeDate(pt.nextFollowUpAt))
                    return pt.nextFollowUpAt;
                  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                  tomorrow.setHours(11, 0, 0, 0);
                  return tomorrow.toISOString();
                };
                const setPostTourReminder = async () => {
                  const dueAt = postTourFollowUpAt();
                  await updatePostTour(target.id, { nextFollowUpAt: dueAt });
                  setLeadFollowUp(
                    lead.id,
                    dueAt,
                    priorityFor(pt.confidence),
                    `Post-tour follow-up · ${postTourPropertyName}`,
                  );
                  scheduleLocalReminderAlert(
                    `post-tour:${target.id}`,
                    dueAt,
                    `Follow up with ${resolveBestLeadName(lead)}`,
                    `Post-tour follow-up for ${postTourPropertyName}`,
                  );
                  toast.success(
                    `Reminder set for ${formatSafeDate(dueAt, "MMM d, p", "the selected time")}`,
                  );
                };
                const copyPostTourMessage = async (kind: "thanks" | "update") => {
                  const propertyText =
                    postTourPropertyName === "Property not selected"
                      ? "the property"
                      : postTourPropertyName;
                  const message =
                    kind === "thanks"
                      ? `Hi ${leadFirstName}, thank you for visiting ${propertyText}. I have noted your feedback and will help you with the next step.`
                      : `Hi ${leadFirstName}, quick update after your visit to ${propertyText}: the option is available around ${formatBudget(lead.budget)}. Please tell me if you want to proceed or compare one more option.`;
                  await navigator.clipboard.writeText(message);
                  toast.success(
                    kind === "thanks" ? "Thank-you message copied" : "Post-tour update copied",
                  );
                };
                const nextFollowUpLocal = pt.nextFollowUpAt ? toLocal(pt.nextFollowUpAt) : "";
                const nextFollowUpDate = nextFollowUpLocal.slice(0, 10);
                const nextFollowUpTime = nextFollowUpLocal.slice(11, 16);
                const updateNextFollowUp = (date: string, time: string) => {
                  if (!date || !time) {
                    updatePostTour(target.id, { nextFollowUpAt: null });
                    return;
                  }
                  updatePostTour(target.id, {
                    nextFollowUpAt: new Date(`${date}T${time}`).toISOString(),
                  });
                };
                const applyPostTourOutcome = async (outcome: NonNullable<typeof pt.outcome>) => {
                  const nowIso = new Date().toISOString();
                  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                  tomorrow.setHours(11, 0, 0, 0);
                  const confidence =
                    pt.confidence > 0
                      ? pt.confidence
                      : outcome === "booked"
                        ? 85
                        : outcome === "thinking"
                          ? 55
                          : outcome === "not-interested" || outcome === "dropped"
                            ? 10
                            : 35;
                  const shouldComplete = outcome !== "awaiting";
                  await updatePostTour(target.id, {
                    outcome,
                    confidence,
                    expectedDecisionAt: pt.expectedDecisionAt ?? tomorrow.toISOString(),
                    nextFollowUpAt: pt.nextFollowUpAt ?? tomorrow.toISOString(),
                    filledAt: shouldComplete ? nowIso : null,
                  });

                  if (outcome === "booked") {
                    await setLeadStage(lead.id, "quote-sent");
                    setTab("quote");
                    toast.success("Post-tour complete. Quote is unlocked.");
                    return;
                  }
                  if (outcome === "thinking") {
                    await setLeadStage(lead.id, "negotiation");
                    setTab("negotiation");
                    toast.success("Post-tour complete. Negotiation is unlocked.");
                    return;
                  }
                  if (outcome === "not-interested" || outcome === "dropped") {
                    await setLeadStage(lead.id, "dropped");
                    toast.success("Lead moved to dropped.");
                    return;
                  }

                  await setLeadStage(lead.id, "tour-done");
                  setTab("post");
                  toast.success("Awaiting outcome saved. Follow-up remains in post-tour.");
                };
                return (
                  <div className="space-y-4">
                    <Section title="Post-tour">
                      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <div className="text-muted-foreground">Property</div>
                          <div className="truncate font-medium" title={postTourPropertyName}>
                            {postTourPropertyName}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <div className="text-muted-foreground">Tour time</div>
                          <div className="truncate font-medium">
                            {formatSafeDate(target.scheduledAt, "MMM d, p", "time unknown")}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto justify-center gap-1.5 text-xs"
                          onClick={() => void setPostTourReminder()}
                        >
                          <BellRing className="h-3 w-3" /> Reminder
                        </Button>
                      </div>
                    </Section>

                    {/* ── SCORECARD ─────────────────────────────────────── */}
                    <PostTourScorecard tourId={target.id} />

                    <Section title="Key objection">
                      <Select
                        value={pt.objection ?? ""}
                        onValueChange={(v) => updatePostTour(target.id, { objection: v })}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select objection" />
                        </SelectTrigger>
                        <SelectContent>
                          {OBJECTIONS.map((o) => (
                            <SelectItem key={o} value={o} className="text-sm">
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        key={`${target.id}:${pt.objection ?? "none"}`}
                        rows={3}
                        placeholder={
                          pt.objection === "Other"
                            ? "Write the objection clearly..."
                            : "Add context for the objection..."
                        }
                        defaultValue={pt.objectionNote}
                        onBlur={(e) => updatePostTour(target.id, { objectionNote: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 min-h-20 resize-y rounded-xl text-sm"
                      />
                    </Section>

                    <div className="grid gap-3">
                      <Section title="Expected decision">
                        <Input
                          type="date"
                          value={pt.expectedDecisionAt ? pt.expectedDecisionAt.slice(0, 10) : ""}
                          onChange={(e) =>
                            updatePostTour(target.id, {
                              expectedDecisionAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                          className="h-9 max-w-72 text-sm"
                        />
                      </Section>
                      <Section title="Next follow-up">
                        <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                          <Input
                            type="date"
                            value={nextFollowUpDate}
                            onChange={(e) =>
                              updateNextFollowUp(e.target.value, nextFollowUpTime || "11:00")
                            }
                            className="h-9 min-w-0 text-sm"
                          />
                          <Select
                            value={nextFollowUpTime}
                            onValueChange={(value) =>
                              updateNextFollowUp(nextFollowUpDate || localDateISO(), value)
                            }
                          >
                            <SelectTrigger className="h-9 min-w-0 text-sm">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
                            <SelectContent align="end">
                              {FOLLOW_UP_TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time} className="text-sm">
                                  {formatTime12h(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Section>
                    </div>

                    {/* ── PROPERTY RATING + BOOKING PROBABILITY ─────── */}
                    <div className="grid grid-cols-2 gap-3">
                      <Section title="Property rating (1–10)">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          placeholder="1-10"
                          value={(pt as any).propertyRating ?? ""}
                          onChange={(e) =>
                            updatePostTour(target.id, {
                              ...(pt as any),
                              propertyRating: e.target.value ? +e.target.value : null,
                            } as any)
                          }
                          className="h-11 text-sm rounded-xl"
                        />
                      </Section>
                      <Section title="Booking probability (%)">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="0-100"
                          value={(pt as any).bookingProbability ?? ""}
                          onChange={(e) =>
                            updatePostTour(target.id, {
                              ...(pt as any),
                              bookingProbability: e.target.value ? +e.target.value : null,
                            } as any)
                          }
                          className="h-11 text-sm rounded-xl"
                        />
                      </Section>
                    </div>

                    {/* ── BIGGEST OBJECTION + EXPECTED BOOKING DATE ───── */}
                    <div className="grid grid-cols-2 gap-3">
                      <Section title="Biggest objection">
                        <Select
                          value={pt.objection ?? ""}
                          onValueChange={(v) => updatePostTour(target.id, { objection: v })}
                        >
                          <SelectTrigger className="h-11 text-sm rounded-xl">
                            <SelectValue placeholder="Select objection" />
                          </SelectTrigger>
                          <SelectContent>
                            {OBJECTIONS.map((o) => (
                              <SelectItem key={o} value={o} className="text-sm">
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Section>
                      <Section title="Expected booking date">
                        <Input
                          type="date"
                          value={pt.expectedDecisionAt ? pt.expectedDecisionAt.slice(0, 10) : ""}
                          onChange={(e) =>
                            updatePostTour(target.id, {
                              expectedDecisionAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                          className="h-11 text-sm rounded-xl"
                        />
                      </Section>
                    </div>

                    {/* ── ACTION BUTTONS ───────────────────────────────── */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs h-9"
                        onClick={() => void copyPostTourMessage("thanks")}
                      >
                        <Copy className="h-3 w-3" /> Thank-you msg
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs h-9"
                        onClick={() => void copyPostTourMessage("update")}
                      >
                        <Copy className="h-3 w-3" /> Send update
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs h-9"
                        onClick={() => void setPostTourReminder()}
                      >
                        <BellRing className="h-3 w-3" /> Set reminder
                      </Button>
                    </div>

                    <PostTourOutcomeActions
                      tourId={target.id}
                      pt={pt}
                      onApply={applyPostTourOutcome}
                    />

                    {pt.filledAt ? (
                      <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span>
                          Form complete · saved{" "}
                          {mounted ? formatSafeDistance(pt.filledAt, "recently") : "recently"}
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-center gap-2 text-xs">
                        <ClipboardCheck className="h-4 w-4" />
                        <span>Select outcome, then complete post-tour.</span>
                      </div>
                    )}

                    {lead.stage === "booked" && (
                      <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <span className="font-semibold text-success">Booked.</span>
                        <span className="text-muted-foreground">Bed blocked, lead closed.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            {/* HANDOFF - FlowOps ↔ TCM thread for this lead */}
            <TabsContent value="handoff" className="pt-4">
              <Section title="FlowOps ↔ TCM thread">
                <HandoffThread leadId={lead.id} />
              </Section>
            </TabsContent>

            {/* ACTIVITY LOG */}
            <TabsContent value="log" className="pt-4">
              <Section title="Activity log (auto)">
                <div className="space-y-2">
                  {leadActivities.length === 0 && (
                    <div className="text-xs text-muted-foreground">No activity yet.</div>
                  )}
                  {leadActivities.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-2 text-xs border-l-2 border-border pl-3 py-1"
                    >
                      <ActivityIcon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <div className="text-foreground">{a.text}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">
                          {formatSafeDate(a.ts, "MMM d, p", "time unknown")} ·{" "}
                          {a.actor === "system"
                            ? "system"
                            : (tcms.find((t) => t.id === a.actor)?.name ?? a.actor)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NegotiationTab({ lead }: { lead: Lead }) {
  const setLeadStage = useApp((s) => s.setLeadStage);
  const { data: quotes = [] } = useQuotationsQuery(lead.id);
  const latestQuote = useMemo(
    () => [...quotes].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0],
    [quotes],
  );
  const propertyName = latestQuote?.propertyName || "selected property";
  const price = latestQuote?.discountedPrice || lead.budget;
  const leadFirstName = resolveBestLeadName(lead).split(" ")[0] || "there";

  const scripts = [
    {
      title: "Hold price, add value",
      body: `Hi ${leadFirstName}, I checked ${propertyName}. This is already a strong fit for your requirement. Instead of reducing quality, I can help lock this option and make sure the move-in is smooth.`,
    },
    {
      title: "Alternate option",
      body: `Hi ${leadFirstName}, if the quoted price feels tight, I can compare one alternate option near ${resolveLeadLocation(lead)} and share the better fit with you.`,
    },
    {
      title: "Manager check",
      body: `Hi ${leadFirstName}, I will check the best possible final offer for ${propertyName}. If it works for your budget, shall I help you block it today?`,
    },
  ];

  const copyScript = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setLeadStage(lead.id, "negotiation");
    toast.success(`${label} copied`);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> Negotiation playbook
          </div>
          <div className="text-[11px] text-muted-foreground">
            Copy the right script after quote follow-up. No WhatsApp send opens from here.
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {latestQuote ? `${propertyName} · ${formatINR(price)}` : "No quote selected"}
        </Badge>
      </div>
      <div className="space-y-2">
        {scripts.map((script) => (
          <div
            key={script.title}
            className="rounded-md border border-border bg-muted/25 p-2 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold">{script.title}</div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => void copyScript(script.body, script.title)}
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
            <div className="rounded bg-background px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {script.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactTabContent({
  lead,
  pendingAction,
  onPendingActionConsumed,
  onGoTour,
}: {
  lead: Lead;
  pendingAction?: LeadFocusAction | null;
  onPendingActionConsumed?: () => void;
  onGoTour?: () => void;
}) {
  const state = useImpactStateForLead(lead);
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const allCalls = useCRM10x((s) => s.calls);
  const allObjections = useCRM10x((s) => s.objections);
  const calls = useMemo(
    () => allCalls.filter((call) => call.leadId === lead.id),
    [allCalls, lead.id],
  );
  const objections = useMemo(
    () => allObjections.filter((item) => item.leadId === lead.id),
    [allObjections, lead.id],
  );
  const tags = lead.tags ?? [];
  const markDone = useApp((s) => s.addLeadTag);
  const removeDone = useApp((s) => s.removeLeadTag);
  const upsertProfile = useCRM10x((s) => s.upsertProfile);
  const isDone = (key: Exclude<PreVisitStepKey, "call">) => tags.includes(preVisitTag(key));
  const profileScore = profileCompletionScore(profile as unknown as Record<string, unknown>);
  const latestAnsweredCall = calls.find((call) => call.outcome === "answered") ?? null;
  const hasObjectionCapture = objections.length > 0;
  const { data: shortlist = [] } = useLeadInterests(lead.id);
  const qualificationDone = isDone("qualification") || Boolean(profile?.qualificationCompleteAt);
  const visitReadyDone = isDone("visit-ready") || Boolean(profile?.visitReadyAt);
  const reopenCall = tags.includes("impact:reopen-call");

  let activeStep = getPreVisitActiveStep({
    profileDone: qualificationDone,
    callConnected: Boolean(latestAnsweredCall),
    objectionDone: hasObjectionCapture,
    visitReady: visitReadyDone,
  });

  if (reopenCall && activeStep === "visit-ready") {
    activeStep = "call";
  }

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === "schedule" || pendingAction === "auto") {
      if (!isDone("visit-ready")) {
        toast.warning("Visit scheduling unlocks after the pre-visit workflow is complete.");
      }
    }
    onPendingActionConsumed?.();
  }, [pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps -- one-shot drawer action

  if (!state) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
        Impact intelligence will appear when this lead is loaded.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PreVisitProgress
        activeStep={activeStep}
        done={{
          "new-lead": true,
          qualification: qualificationDone,
          call: Boolean(latestAnsweredCall) && hasObjectionCapture,
          shortlist: visitReadyDone,
        }}
        backAction={
          activeStep === "call"
            ? {
                label: "Back",
                onClick: () => {
                  removeDone(lead.id, preVisitTag("qualification"));
                  upsertProfile({ leadId: lead.id, qualificationCompleteAt: undefined });
                  toast.info("Back to qualification");
                },
              }
            : activeStep === "visit-ready"
              ? {
                  label: "Back",
                  onClick: () => {
                    markDone(lead.id, "impact:reopen-call");
                    toast.info("Back to call + objection");
                  },
                }
              : undefined
        }
      />

      {activeStep === "qualification" && (
        <LifecycleCard title="Qualification" centeredTitle>
          <div className="grid gap-2">
            <LeadDeepProfile lead={state.lead} defaultOpen showShiftingHistory={false} />
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-2.5">
            <div className="text-center text-sm font-semibold text-foreground">
              Property selector
            </div>
            <PropertyShortlistStep
              lead={state.lead}
              doneTag={preVisitTag("qualification")}
              buttonLabel="Save qualification and start call"
              toastMessage="Qualification saved. Call + objection unlocked."
              disabled={profileScore < 80}
              disabledReason="Complete profile to 80% and select one property."
              onComplete={() =>
                upsertProfile({
                  leadId: lead.id,
                  qualificationCompleteAt: new Date().toISOString(),
                })
              }
            />
          </div>
        </LifecycleCard>
      )}

      {activeStep === "call" && (
        <LifecycleCard title="Call log" centeredTitle>
          <ProfileCallBrief lead={state.lead} />
          <PreVisitCallLogger lead={state.lead} calls={calls} />
          <ObjectionLogger lead={state.lead} context="call" />
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            Call:{" "}
            <span
              className={
                latestAnsweredCall ? "font-semibold text-success" : "font-semibold text-warning"
              }
            >
              {latestAnsweredCall ? "Connected" : "Not connected yet"}
            </span>
            {" · "}Objection:{" "}
            <span
              className={
                hasObjectionCapture ? "font-semibold text-success" : "font-semibold text-warning"
              }
            >
              {hasObjectionCapture ? "Captured" : "Required"}
            </span>
          </div>
          {reopenCall && (
            <Button
              className="w-full mt-2 h-9 text-xs"
              onClick={() => removeDone(lead.id, "impact:reopen-call")}
            >
              Continue to Visit Ready
            </Button>
          )}
        </LifecycleCard>
      )}

      {activeStep === "visit-ready" && (
        <LifecycleCard title="Visit ready" centeredTitle>
          {visitReadyDone ? (
            <Button className="w-full h-9 text-xs" onClick={onGoTour}>
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              Open Tour
            </Button>
          ) : (
            <Button
              className="w-full h-9 text-xs"
              onClick={() => {
                markDone(lead.id, preVisitTag("visit-ready"));
                upsertProfile({ leadId: lead.id, visitReadyAt: new Date().toISOString() });
                toast.success("Visit ready. Tour is now unlocked.");
              }}
            >
              Mark visit ready
            </Button>
          )}
        </LifecycleCard>
      )}
    </div>
  );
}

type PreVisitStepKey = "qualification" | "call" | "visit-ready";
type PreVisitProgressKey = "new-lead" | "qualification" | "call" | "shortlist";

const PRE_VISIT_STEPS: Array<{ key: PreVisitProgressKey; label: string }> = [
  { key: "new-lead", label: "New lead" },
  { key: "qualification", label: "Qualification" },
  { key: "call", label: "Call + objection" },
  { key: "shortlist", label: "Visit ready" },
];

function preVisitTag(key: Exclude<PreVisitStepKey, "call">) {
  return `impact:${key}`;
}

function getPreVisitActiveStep(state: {
  profileDone: boolean;
  callConnected: boolean;
  objectionDone: boolean;
  visitReady: boolean;
}): PreVisitStepKey {
  if (!state.profileDone) return "qualification";
  if (!state.callConnected || !state.objectionDone) return "call";
  return "visit-ready";
}


function PreVisitProgress({
  activeStep,
  done,
  backAction,
}: {
  activeStep: PreVisitStepKey;
  done: Record<PreVisitProgressKey, boolean>;
  backAction?: { label: string; onClick: () => void };
}) {
  const activeProgressKey: PreVisitProgressKey =
    activeStep === "visit-ready" ? "shortlist" : activeStep;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pre-visit lifecycle
        </div>
        {backAction ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-3 text-[10px] font-semibold"
            onClick={backAction.onClick}
          >
            {backAction.label}
          </Button>
        ) : (
          <span />
        )}
        <span />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {PRE_VISIT_STEPS.map((step) => {
          const complete = done[step.key];
          const active = step.key === activeProgressKey;
          return (
            <div key={step.key} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  complete ? "bg-success" : active ? "bg-accent" : "bg-muted",
                )}
              />
              <div
                className={cn(
                  "mt-1 truncate text-[9px]",
                  complete || active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LifecycleCard({
  eyebrow,
  title,
  helper,
  action,
  centeredTitle,
  children,
}: {
  eyebrow?: string;
  title?: string;
  helper?: string;
  action?: React.ReactNode;
  centeredTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0 flex-1", centeredTitle ? "text-center" : "")}>
          {eyebrow ? (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">
              {eyebrow}
            </div>
          ) : null}
          {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          {helper ? <p className="text-[11px] text-muted-foreground">{helper}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function DiscoverySnapshot({
  lead,
  score,
  nbaReason,
}: {
  lead: Lead;
  score: number;
  nbaReason: string;
}) {
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const allCalls = useCRM10x((s) => s.calls);
  const calls = useMemo(
    () => allCalls.filter((call) => call.leadId === lead.id),
    [allCalls, lead.id],
  );
  const probability = computeBookingProbability({
    lead,
    profile,
    tours: [],
    visits: [],
    objections: [],
    calls,
  });
  const items = [
    ["Need", [lead.type, lead.room, lead.need].filter(Boolean).join(" · ") || "Not captured"],
    ["Areas", lead.areas?.length ? lead.areas.join(", ") : lead.preferredArea || "Not captured"],
    ["Budget", lead.budget ? formatBudget(lead.budget) : "Not captured"],
    ["Move-in", formatSafeDate(lead.moveInDate, "MMM d", "TBD")],
    ["PG type", profileLabel(profile?.gender) || "Not captured"],
    ["Room fit", profileLabel(profile?.roomType) || "Not captured"],
    ["Decision-maker", profileLabel(profile?.decisionMaker) || "Not captured"],
    ["Location feasibility", locationFeasibilityLabel(profile?.locationFeasible) || "Ask on call"],
    ["Best call time", inferBestCallTime(calls) ?? profile?.bestCallTime ?? "Ask on call"],
    ["Special request", lead.specialReqs || lead.notes || "None captured"],
  ];
  const scoreTone =
    score >= 70
      ? "border-success/40 bg-success/10 text-success"
      : score >= 40
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-danger/40 bg-danger/10 text-danger";
  return (
    <div className="space-y-2">
      <div className={`rounded-md border px-3 py-2 ${scoreTone}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">
              Booking probability
            </div>
            <div className="text-xs font-medium">{probability.recommendation || nbaReason}</div>
          </div>
          <div className="text-2xl font-display font-bold">{probability.score}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-xs font-medium text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCallBrief({ lead }: { lead: Lead }) {
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const properties = useApp((s) => s.properties);
  const { data: interests = [] } = useLeadInterests(lead.id);
  const [activePg, setActivePg] = useState<PG | null>(null);
  const selectedProperties = useMemo(
    () =>
      interests
        .map((id) => resolvePropertyById(id, properties))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [interests, properties],
  );
  const items = [
    ["Need", [lead.type, lead.room, lead.need].filter(Boolean).join(" · ") || "Not captured"],
    ["Areas", lead.areas?.length ? lead.areas.join(", ") : lead.preferredArea || "Not captured"],
    ["Budget", lead.budget ? formatBudget(lead.budget) : "Not captured"],
    ["Decision-maker", profileLabel(profile?.decisionMaker) || "Ask who decides"],
    [
      "Location feasibility",
      locationFeasibilityLabel(profile?.locationFeasible) || "Ask area inventory fit",
    ],
    ["Best time", profile?.bestCallTime || "Ask on call"],
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Call brief
          </div>
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex max-w-[190px] items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:border-accent/50"
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.phone || "No phone"}</span>
          </a>
        </div>
        <div className="mb-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
          <span className="font-semibold">{resolveBestLeadName(lead)}</span>
          {lead.email ? (
            <>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="text-muted-foreground">{lead.email}</span>
            </>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {items.map(([label, value]) => (
            <div key={label} className="text-[11px]">
              <span className="text-muted-foreground">{label}: </span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Property to pitch
        </div>
        {selectedProperties.length > 0 ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {selectedProperties.map((property) => (
              <button
                key={property.id}
                type="button"
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs transition hover:border-accent/60 hover:bg-accent/5"
                onClick={() => {
                  if (property.pg) {
                    setActivePg(property.pg);
                    return;
                  }
                  toast.info(
                    `${property.name} is from ops inventory. Open Property Hub for full dossier.`,
                  );
                }}
                title={property.pg ? "View property dossier" : "Ops property details only"}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{property.name}</span>
                  <span className="shrink-0 text-[10px] font-medium text-accent">
                    {property.pg ? "View" : "Info"}
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {property.area} · {formatBudget(property.pricePerBed)}
                  {property.vacantBeds !== undefined ? ` · ${property.vacantBeds} vacant` : ""}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No property selected yet. Add one in Qualification before calling.
          </div>
        )}
      </div>
      <PGDetail pg={activePg} onClose={() => setActivePg(null)} />
    </div>
  );
}

function profileLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "";
  const labels: Record<string, string> = {
    "boys-pg": "Boys PG",
    "girls-pg": "Girls PG",
    "co-live": "Co-live",
    single: "Single",
    double: "Double",
    triple: "Triple",
    any: "Any",
    whatsapp: "WhatsApp",
    website: "Website",
    referral: "Referral",
    indiamart: "IndiaMart",
    google: "Google",
    "walk-in": "Walk-in",
    self: "Self",
    parents: "Parents",
    "company-hr": "Company / HR",
    answered: "Answered",
    "not-answered": "Not answered",
    busy: "Busy",
    "switched-off": "Switched off",
    "wrong-number": "Wrong number",
    "callback-requested": "Callback requested",
  };
  return labels[String(value)] ?? String(value);
}

function locationFeasibilityLabel(value?: boolean | null) {
  if (value === undefined || value === null) return "";
  return value ? "Yes" : "No";
}

function profileDateToInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function profileToScheduleRoomType(value?: string | null) {
  const map: Record<string, string> = {
    single: "Single",
    double: "Double Sharing",
    triple: "Triple Sharing",
    any: "Single",
  };
  return value ? (map[value] ?? "") : "";
}

function profileToBookingSource(value?: string | null) {
  if (!value) return "";
  const map: Record<string, string> = {
    website: "organic",
    google: "organic",
    indiamart: "organic",
    other: "organic",
    whatsapp: "whatsapp",
    referral: "referral",
    "walk-in": "walk-in",
  };
  return map[value] ?? "";
}

function profileToDecisionMaker(value?: string | null) {
  const map: Record<string, string> = {
    self: "self",
    parents: "parent",
    "company-hr": "group",
  };
  return value ? (map[value] ?? "") : "";
}

function latestConcernFromObjections(
  objections: Array<{ code?: string; leadWords?: string; handling?: string }>,
) {
  const latest = objections[0];
  if (!latest) return "";
  if (latest.leadWords) return latest.leadWords;
  if (latest.code && latest.code !== "none") return profileLabel(latest.code);
  return latest.handling || "";
}

function PreVisitCallLogger({
  lead,
  calls,
}: {
  lead: Lead;
  calls: ReturnType<typeof useCRM10x.getState>["calls"];
}) {
  const log = useCRM10x((s) => s.logCall);
  const [picked, setPicked] = useState<"" | "yes" | "no">("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [noPickOutcome, setNoPickOutcome] = useState<Exclude<CallOutcome, "answered"> | "">("");
  const [notes, setNotes] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);
  const attempt = calls.length + 1;
  const previousCall = useMemo(
    () => [...calls].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0],
    [calls],
  );
  const minutes = Number(durationMinutes);
  const canSubmit =
    picked === "yes"
      ? Number.isFinite(minutes) && minutes > 0 && notes.trim().length >= 3
      : picked === "no" && Boolean(noPickOutcome);

  const submit = () => {
    if (!picked) {
      toast.error("Select whether the lead picked the call");
      return;
    }
    if (picked === "yes" && (!Number.isFinite(minutes) || minutes <= 0)) {
      toast.error("Enter call duration in minutes");
      return;
    }
    if (picked === "yes" && notes.trim().length < 3) {
      toast.error("Add a short call note");
      return;
    }
    if (picked === "no" && !noPickOutcome) {
      toast.error("Select why the call was not picked");
      return;
    }
    const outcome: CallOutcome = picked === "yes" ? "answered" : noPickOutcome || "not-answered";
    const callNote =
      picked === "yes" ? notes.trim() : `Call not picked: ${profileLabel(noPickOutcome)}`;

    log({
      leadId: lead.id,
      attemptNumber: attempt,
      durationSec: picked === "yes" ? Math.round(minutes * 60) : 0,
      outcome,
      notes: callNote,
      loggedBy: lead.assignedTcmId || lead.assigneeId || "unassigned",
    });
    toast.success(
      outcome === "answered"
        ? "Call connected. Objection capture unlocked."
        : "Call attempt logged.",
    );
    setPicked("");
    setDurationMinutes("");
    setNoPickOutcome("");
    setNotes("");
  };

  return (
    <div className="space-y-3">
      <Field label="Picked?">
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={picked === value ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                setPicked(value);
                if (value === "yes") setNoPickOutcome("");
                if (value === "no") {
                  setDurationMinutes("");
                  setNotes("");
                }
              }}
            >
              {value === "yes" ? "Yes, connected" : "No, not picked"}
            </Button>
          ))}
        </div>
      </Field>

      {picked === "yes" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Duration (min)">
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Outcome">
              <div className="flex h-8 items-center rounded-md border border-success/30 bg-success/10 px-3 text-xs font-semibold text-success">
                Answered
              </div>
            </Field>
          </div>
          <Textarea
            rows={3}
            className="text-xs resize-none"
            placeholder="What did the lead say?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </>
      ) : null}

      {picked === "no" ? (
        <Field label="Reason">
          <Select
            value={noPickOutcome}
            onValueChange={(v) => setNoPickOutcome(v as Exclude<CallOutcome, "answered">)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not-answered">Not answered</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="switched-off">Switched off</SelectItem>
              <SelectItem value="wrong-number">Wrong number</SelectItem>
              <SelectItem value="callback-requested">Callback requested</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <div className="rounded-md border border-border bg-muted/20 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Previous call log
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            disabled={!previousCall}
            onClick={() => setShowPrevious((value) => !value)}
          >
            {showPrevious ? "Hide" : "See"}
          </Button>
        </div>
        {showPrevious && previousCall ? (
          <div className="mt-2 rounded-md border border-border bg-card p-2 text-[11px]">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <span>{format(new Date(previousCall.ts), "MMM d, h:mm a")}</span>
              <span>Attempt #{previousCall.attemptNumber}</span>
              <span>{profileLabel(previousCall.outcome)}</span>
              {previousCall.durationSec > 0 ? (
                <span>{Math.max(1, Math.round(previousCall.durationSec / 60))} min</span>
              ) : null}
            </div>
            <div className="whitespace-pre-wrap text-foreground">
              {previousCall.notes || "No notes captured."}
            </div>
          </div>
        ) : null}
      </div>
      <Button className="w-full h-9 text-xs" onClick={submit} disabled={!canSubmit}>
        Log call attempt #{attempt}
      </Button>
    </div>
  );
}

function preferenceAreasForLead(lead: Lead): string[] {
  return Array.from(
    new Set(
      [...(lead.areas ?? []), lead.preferredArea]
        .map((area) => area?.trim())
        .filter(Boolean) as string[],
    ),
  );
}

function PropertyMatchPreview({ lead }: { lead: Lead }) {
  const properties = useApp((s) => s.properties);
  const areas = preferenceAreasForLead(lead);
  const matches = useMemo(() => {
    const seen = new Set<string>();
    const rows = areas.flatMap((area) =>
      searchPropertyCatalog(area, properties, { preferredArea: area, limit: 4 }),
    );
    return rows
      .filter((property) => {
        if (seen.has(property.id)) return false;
        seen.add(property.id);
        return true;
      })
      .slice(0, 6);
  }, [areas, properties]);

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold">Suggested from preferred area</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {areas.join(", ") || "No area captured"}
        </div>
      </div>
      <div className="grid gap-1.5">
        {matches.length > 0 ? (
          matches.map((property) => (
            <div
              key={property.id}
              className="rounded-md border border-border bg-card px-2.5 py-2 text-xs"
            >
              <div className="font-semibold">{property.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {property.area} · {formatBudget(property.pricePerBed)}
                {property.vacantBeds !== undefined ? ` · ${property.vacantBeds} vacant` : ""}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-muted-foreground">
            No property hub matches found for these areas yet.
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyShortlistStep({
  lead,
  doneTag = preVisitTag("visit-ready"),
  buttonLabel = "Mark visit ready",
  toastMessage = "Shortlist created. Lead is visit ready.",
  disabled = false,
  disabledReason,
  onComplete,
}: {
  lead: Lead;
  doneTag?: string;
  buttonLabel?: string;
  toastMessage?: string;
  disabled?: boolean;
  disabledReason?: string;
  onComplete?: () => void;
}) {
  const properties = useApp((s) => s.properties);
  const { data: interests = [] } = useLeadInterests(lead.id);
  const { mutate: toggleInterest } = useToggleInterest();
  const markDone = useApp((s) => s.addLeadTag);
  const areas = preferenceAreasForLead(lead);
  const [query, setQuery] = useState("");
  const [activePg, setActivePg] = useState<PG | null>(null);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherPropertyName, setOtherPropertyName] = useState("");
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);
  const [createdOthers, setCreatedOthers] = useState<string[]>([]);

  const list = useMemo(() => {
    const base = query.trim()
      ? searchPropertyCatalog(query, properties, { preferredArea: lead.preferredArea, limit: 12 })
      : areas.flatMap((area) =>
          searchPropertyCatalog(area, properties, { preferredArea: area, limit: 5 }),
        );
    const seen = new Set<string>();
    const filtered = base
      .filter((property) => {
        if (seen.has(property.id)) return false;
        seen.add(property.id);
        return true;
      })
      .slice(0, 12);
      
    const allOtherIds = new Set([...interests.filter((id) => id.startsWith("other:")), ...createdOthers]);
    const otherInterests = Array.from(allOtherIds)
      .map((id) => resolvePropertyById(id, properties))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    for (const p of otherInterests) {
      if (!seen.has(p.id)) {
        filtered.unshift(p);
        seen.add(p.id);
      }
    }
    return filtered;
  }, [areas, lead.preferredArea, properties, query, interests]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8 text-xs"
          placeholder="Search property or area"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border p-1.5 space-y-1.5 flex flex-col">
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {list.map((property) => {
            const selected = interests.includes(property.id);
            return (
              <div
                key={property.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleInterest({ leadId: lead.id, propertyId: property.id })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {selected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary fill-primary/20" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{property.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {property.area}
                      {property.source !== "other" && ` · ${formatBudget(property.pricePerBed)}`}
                      {property.vacantBeds !== undefined ? ` · ${property.vacantBeds} vacant` : ""}
                    </div>
                  </div>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  onClick={(e) => {
                    e.preventDefault();
                    if (property.source === "other") {
                      setEditingOtherId(property.id);
                      setOtherPropertyName(property.name);
                      setShowOtherModal(true);
                      return;
                    }
                    if (property.pg) {
                      setActivePg(property.pg);
                      return;
                    }
                    toast.info(
                      `${property.name} is from ops inventory. Open Property Hub for full dossier.`,
                    );
                  }}
                >
                  {property.source === "other" ? "Change" : "View"}
                </Button>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="py-5 text-center text-xs text-muted-foreground">
              No matching properties.
            </div>
          )}
        </div>
        <div className="p-1 border-t border-border mt-1 shrink-0">
          <Button variant="secondary" size="sm" className="w-full text-xs" onClick={(e) => {
            e.preventDefault();
            setEditingOtherId(null);
            setOtherPropertyName("");
            setShowOtherModal(true);
          }}>
            Other Property
          </Button>
        </div>
      </div>
      <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        Selected: <span className="font-semibold text-foreground">{interests.length}</span> property
        {interests.length === 1 ? "" : "ies"}
      </div>
      <Button
        className="w-full h-9 text-xs"
        disabled={disabled || interests.length === 0}
        title={
          disabled
            ? disabledReason
            : interests.length === 0
              ? "Select at least one property"
              : undefined
        }
        onClick={() => {
          markDone(lead.id, doneTag);
          onComplete?.();
          toast.success(toastMessage);
        }}
      >
        {buttonLabel}
      </Button>
      <PGDetail pg={activePg} onClose={() => setActivePg(null)} />
      
      <Dialog open={showOtherModal} onOpenChange={setShowOtherModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Other Property</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs">Property Name *</Label>
            <Input 
              value={otherPropertyName} 
              onChange={(e) => setOtherPropertyName(e.target.value)} 
              placeholder="e.g. ABC PG" 
              maxLength={100}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowOtherModal(false)}>Cancel</Button>
            <Button size="sm" onClick={(e) => {
              e.preventDefault();
              const cleanName = otherPropertyName.replace(/\s+/g, " ").trim();
              if (!cleanName) { toast.error("Property Name is required"); return; }
              const newId = `other:${cleanName}`;
              
              if (editingOtherId && editingOtherId !== newId) {
                if (interests.includes(editingOtherId)) {
                  toggleInterest({ leadId: lead.id, propertyId: editingOtherId });
                }
              }

              if (!interests.includes(newId)) {
                toggleInterest({ leadId: lead.id, propertyId: newId });
              }
              
              setCreatedOthers(prev => {
                const filtered = prev.filter(id => id !== editingOtherId);
                if (!filtered.includes(newId)) filtered.push(newId);
                return filtered;
              });

              setShowOtherModal(false);
              setOtherPropertyName("");
              setEditingOtherId(null);
            }}>Save Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  centeredTitle,
  children,
}: {
  title: string;
  centeredTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div
        className={cn(
          "text-[11px] uppercase tracking-wider text-muted-foreground font-semibold",
          centeredTitle && "text-center",
        )}
      >
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="text-xs font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function UpcomingTourCard({
  tour,
  members,
  leadName,
}: {
  tour: import("@/lib/types").Tour;
  members: { id: string; name: string; role: string; zones: string[] }[];
  leadName?: string;
}) {
  const {
    properties,
    rescheduleTour,
    cancelTour,
    markTourStarted,
    completeTour,
    updateTourDetails,
  } = useApp();
  const prop = properties.find((p) => p.id === tour.propertyId);

  // Handle both old CRM tour format (tcmId) and new MYT tour format (assignedTo, assignedToName)
  const assignedToId = (tour as any).assignedTo ?? (tour as any).tcmId;
  const assignedToMember = members.find((m) => m.id === assignedToId);
  const assignedToName = assignedToMember
    ? memberShortLabel(assignedToMember)
    : ((tour as any).assignedToName ?? assignedToId ?? "TBD");
  const scheduledById = (tour as any).scheduledBy;
  const scheduledByMember = members.find((m) => m.id === scheduledById);
  const scheduledByName = scheduledByMember
    ? memberShortLabel(scheduledByMember)
    : ((tour as any).scheduledByName ?? scheduledById ?? "TBD");
  const tourType = (tour as any).tourType ?? "physical";
  const qualification = (tour as any).qualification;
  const displayLeadName = normalizeLeadName((tour as any).leadName ?? leadName ?? "");
  const phone = (tour as any).phone ?? "";
  const budget = (tour as any).budget ?? 0;
  const area = (tour as any).area ?? "";
  const tourTimeMs = +new Date(tour.scheduledAt);
  const nowMs = Date.now();
  const isPastTour = Number.isFinite(tourTimeMs) && tourTimeMs < nowMs;
  const canMoveToOnTour = tour.status !== "on-tour" && isTodayIST(tour.scheduledAt) && !isPastTour;
  const isOutcomeDue = isPastTour || tour.status === "on-tour";
  const isOverdueOutcome = Number.isFinite(tourTimeMs) && nowMs - tourTimeMs > 30 * 60_000;

  const [showReschedule, setShowReschedule] = useState(false);
  const [newDateTime, setNewDateTime] = useState(() => nextRescheduleLocalValue(tour.scheduledAt));

  useEffect(() => {
    setNewDateTime(nextRescheduleLocalValue(tour.scheduledAt));
  }, [tour.scheduledAt]);

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
      {/* Header with property and status */}
      <div className="flex items-center justify-between">
        <div className="font-display font-semibold text-sm">
          {prop?.name ??
            (tour as any).propertyName ??
            (displayLeadName ? `${displayLeadName}'s Tour` : "Property TBD")}
        </div>
        <Badge className="bg-accent text-accent-foreground capitalize">{tour.status}</Badge>
      </div>

      {/* Date, time, type */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {formatSafeDate(tour.scheduledAt, "EEE, MMM d · p", "time unknown")}
        </span>
        {isPastTour && (
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
          >
            {isOverdueOutcome ? "Outcome due" : "Time reached"}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] capitalize">
          {TOUR_TYPE_LABELS[tourType] ?? tourType.replace(/-/g, " ")}
        </Badge>
      </div>

      {/* Lead info row */}
      {(displayLeadName || phone) && (
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          {displayLeadName && (
            <div className="rounded-md bg-background/60 px-2 py-1.5">
              <span className="block text-muted-foreground">Lead</span>
              <span className="font-medium text-foreground">{displayLeadName}</span>
            </div>
          )}
          {phone && (
            <div className="rounded-md bg-background/60 px-2 py-1.5">
              <span className="block text-muted-foreground">Phone</span>
              <span className="font-medium text-foreground">{phone}</span>
            </div>
          )}
          {budget > 0 && (
            <div className="rounded-md bg-background/60 px-2 py-1.5">
              <span className="block text-muted-foreground">Budget</span>
              <span className="font-medium text-foreground">₹{(budget / 1000).toFixed(0)}k</span>
            </div>
          )}
        </div>
      )}

      {/* Assigned / Scheduled by */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-background/60 px-2 py-1.5">
          <span className="block text-muted-foreground">Assigned to</span>
          <span className="font-medium text-foreground">{assignedToName}</span>
        </div>
        <div className="rounded-md bg-background/60 px-2 py-1.5">
          <span className="block text-muted-foreground">Scheduled by</span>
          <span className="font-medium text-foreground">{scheduledByName}</span>
        </div>
      </div>

      {/* Qualification details if available */}
      {qualification && (
        <div className="rounded-md border border-border bg-background/40 px-3 py-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Qualification
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {qualification.moveInDate && (
              <div>
                <span className="text-muted-foreground">Move-in:</span>{" "}
                <span className="font-medium">{qualification.moveInDate}</span>
              </div>
            )}
            {qualification.roomType && (
              <div>
                <span className="text-muted-foreground">Room:</span>{" "}
                <span className="font-medium">{qualification.roomType}</span>
              </div>
            )}
            {qualification.decisionMaker && (
              <div>
                <span className="text-muted-foreground">Decision:</span>{" "}
                <span className="font-medium capitalize">{qualification.decisionMaker}</span>
              </div>
            )}
            {qualification.willBookToday && (
              <div>
                <span className="text-muted-foreground">Book today:</span>{" "}
                <span className="font-medium capitalize">{qualification.willBookToday}</span>
              </div>
            )}
            {qualification.workLocation && (
              <div>
                <span className="text-muted-foreground">Work area:</span>{" "}
                <span className="font-medium">{qualification.workLocation}</span>
              </div>
            )}
            {qualification.keyConcern && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Concern:</span>{" "}
                <span className="font-medium">{qualification.keyConcern}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {qualification.readyIn48h && (
              <Badge variant="secondary" className="text-[9px]">
                Ready in 48h
              </Badge>
            )}
            {qualification.exploring && (
              <Badge variant="secondary" className="text-[9px]">
                Exploring
              </Badge>
            )}
            {qualification.comparing && (
              <Badge variant="secondary" className="text-[9px]">
                Comparing
              </Badge>
            )}
            {qualification.needsFamily && (
              <Badge variant="secondary" className="text-[9px]">
                Family approval
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(tour.status === "scheduled" ||
        tour.status === "confirmed" ||
        tour.status === "on-tour") && (
        <div className="flex flex-wrap gap-2 pt-1">
          {showReschedule ? (
            <div className="flex gap-2 w-full items-end">
              <div className="flex-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  New date & time
                </Label>
                <Input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs"
                onClick={() => {
                  if (newDateTime) {
                    rescheduleTour(tour.id, new Date(newDateTime).toISOString());
                    setShowReschedule(false);
                    toast.success("Tour rescheduled");
                  }
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setShowReschedule(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              {(tour.status === "scheduled" || tour.status === "confirmed") && canMoveToOnTour && (
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => {
                    void markTourStarted(tour.id)
                      .then(() => toast.success("Moved to on-tour day"))
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to move tour"),
                      );
                  }}
                >
                  <UserCheck className="h-3 w-3" /> Move to on-tour
                </Button>
              )}
              {isOutcomeDue &&
                (tour.status as string) !== "completed" &&
                (tour.status as string) !== "cancelled" && (
                  <Button
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    variant={tour.status === "on-tour" ? "default" : "outline"}
                    onClick={() => {
                      void completeTour(tour.id)
                        .then(() => toast.success("Visit completed · post-tour unlocked"))
                        .catch((err) =>
                          toast.error(
                            err instanceof Error ? err.message : "Failed to complete tour",
                          ),
                        );
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Visit done
                  </Button>
                )}
              {isOutcomeDue &&
                (tour.status as string) !== "completed" &&
                (tour.status as string) !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      void updateTourDetails(tour.id, { status: "no-show", showUp: false })
                        .then(() => toast("Marked no-show · reschedule or revive from queue"))
                        .catch((err) =>
                          toast.error(
                            err instanceof Error ? err.message : "Failed to mark no-show",
                          ),
                        );
                    }}
                  >
                    <AlertTriangle className="h-3 w-3" /> No-show
                  </Button>
                )}
              {(tour.status === "scheduled" || tour.status === "confirmed") && (
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  variant={isPastTour ? "default" : "outline"}
                  onClick={() => setShowReschedule(true)}
                >
                  <CalendarIcon className="h-3 w-3" />{" "}
                  {isPastTour ? "Reschedule overdue tour" : "Reschedule"}
                </Button>
              )}
              {(tour.status === "scheduled" || tour.status === "confirmed") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Cancel this tour?")) {
                      cancelTour(tour.id);
                      toast.success("Tour cancelled");
                    }
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel Tour
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InlineScheduleTour({
  lead,
  properties,
  tcms,
  propertyId,
  tcmId,
  scheduledAt,
  answers,
  onAnswersChange,
  onPropertyChange,
  onTcmChange,
  onScheduledAtChange,
  onSchedule,
}: {
  lead: Lead;
  properties: any[];
  tcms: any[];
  propertyId: string;
  tcmId: string;
  scheduledAt: string;
  answers: DrawerScheduleAnswers;
  onAnswersChange: (patch: Partial<DrawerScheduleAnswers>) => void;
  onPropertyChange: (value: string) => void;
  onTcmChange: (value: string) => void;
  onScheduledAtChange: (value: string) => void;
  onSchedule: () => void;
}) {
  const [propertyQuery, setPropertyQuery] = useState("");
  const filteredProperties = useMemo(() => {
    const q = propertyQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.name, p.area, p.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [properties, propertyQuery]);

  return (
    <Section title="Tour scheduling" centeredTitle>
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md bg-muted/60 px-2 py-1.5">
            <span className="block text-muted-foreground">Phone</span>
            <span className="font-medium text-foreground">{lead.phone}</span>
          </div>
          <div className="rounded-md bg-muted/60 px-2 py-1.5">
            <span className="block text-muted-foreground">Budget</span>
            <span className="font-medium text-foreground">₹{(lead.budget / 1000).toFixed(0)}k</span>
          </div>
          <div className="rounded-md bg-muted/60 px-2 py-1.5">
            <span className="block text-muted-foreground">Area</span>
            <span className="font-medium text-foreground">{lead.preferredArea}</span>
          </div>
        </div>
        <div className="rounded-md border border-border bg-background/60 p-2 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            MYT Schedule questions
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Source">
              <Select
                value={answers.bookingSource}
                onValueChange={(v) => onAnswersChange({ bookingSource: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_SOURCES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Decision maker">
              <Select
                value={answers.decisionMaker}
                onValueChange={(v) => onAnswersChange({ decisionMaker: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_MAKERS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Move-in">
              <Input
                type="date"
                value={answers.moveInDate}
                onChange={(e) => onAnswersChange({ moveInDate: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Budget">
              <Input
                type="number"
                value={answers.budget}
                onChange={(e) => onAnswersChange({ budget: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Work / College">
              <Input
                value={answers.occupation}
                onChange={(e) => onAnswersChange({ occupation: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Work location">
              <Input
                value={answers.workLocation}
                onChange={(e) => onAnswersChange({ workLocation: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
          </div>
          <Field label="Room type">
            <Select
              value={answers.roomType}
              onValueChange={(v) => onAnswersChange({ roomType: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-1.5">
            {(
              [
                ["readyIn48h", "Ready to finalize within 48 hours"],
                ["exploring", "Only exploring"],
                ["comparing", "Comparing options"],
                ["needsFamily", "Needs family approval"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5 text-xs"
              >
                <Checkbox
                  checked={answers[key]}
                  onCheckedChange={(v) => onAnswersChange({ [key]: v === true })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Field label="Will book today">
            <Select
              value={answers.willBookToday}
              onValueChange={(v) => onAnswersChange({ willBookToday: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["yes", "maybe", "no"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Key concern / blocker">
            <Input
              value={answers.keyConcern}
              placeholder="e.g. price high, parents approval, location mismatch"
              onChange={(e) => onAnswersChange({ keyConcern: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Tour Type
          </Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {TOUR_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onAnswersChange({ tourType: value })}
                className={`h-12 rounded-md border text-xs flex flex-col items-center justify-center gap-1 ${
                  answers.tourType === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-2 text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Property
            </Label>
            <Select value={propertyId} onValueChange={onPropertyChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Property" />
              </SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-8 pl-7 text-xs"
                      placeholder="Search selected properties"
                      value={propertyQuery}
                      onChange={(event) => setPropertyQuery(event.target.value)}
                      onKeyDown={(event) => event.stopPropagation()}
                    />
                  </div>
                </div>
                {filteredProperties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.area ? ` · ${p.area}` : ""}
                  </SelectItem>
                ))}
                {filteredProperties.length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    No selected property matches.
                  </div>
                )}
                <SelectItem value={OTHER_PROPERTY_VALUE}>Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              TCM
            </Label>
            <Select value={tcmId} onValueChange={onTcmChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select TCM" />
              </SelectTrigger>
              <SelectContent>
                {tcms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {memberOptionLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          {/* Separate date and time selectors. Time options: 09:00–21:00 every 30 minutes */}
          {(() => {
            const datePart = scheduledAt ? scheduledAt.split("T")[0] : "";
            const timePartRaw =
              scheduledAt && scheduledAt.includes("T")
                ? (scheduledAt.split("T")[1] || "").slice(0, 5)
                : "";
            const times = tourTimeSlotsForDate(datePart);

            return (
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={datePart}
                  onChange={(e) => {
                    const d = e.target.value;
                    const nextTimes = tourTimeSlotsForDate(d);
                    const t = nextTimes.includes(timePartRaw) ? timePartRaw : nextTimes[0] || "";
                    onScheduledAtChange(d && t ? `${d}T${t}` : "");
                  }}
                  min={localDateISO()}
                  className="h-9 text-sm"
                />

                <Select
                  value={timePartRaw}
                  onValueChange={(v) => {
                    const d = datePart || localDateISO();
                    onScheduledAtChange(v ? `${d}T${v}` : "");
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {times.length > 0 ? (
                      times.map((t) => (
                        <SelectItem key={t} value={t} className="text-sm">
                          {formatTime12h(t)}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        No slots left today. Pick tomorrow.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          <Button size="sm" onClick={onSchedule} className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" /> Schedule Tour
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST-TOUR SCORECARD
   5 quick-tap sections matching the design: Property Fit, Budget Fit,
   Location Fit, Decision Readiness, Move-in Urgency.
   Stored in component local state (session-only — lightweight signal for TCM).
───────────────────────────────────────────────────────────────────────────── */

type ScoreState = {
  propertyFit: string;
  budgetFit: string;
  locationFit: string;
  decisionReadiness: string;
  moveInUrgency: string;
};

const SCORECARD_SECTIONS: Array<{
  key: keyof ScoreState;
  label: string;
  options: string[];
}> = [
  {
    key: "propertyFit",
    label: "Property fit",
    options: ["Perfect — loved it", "Liked, few concerns", "Did not like"],
  },
  {
    key: "budgetFit",
    label: "Budget fit",
    options: ["Within budget", "Slightly above", "Budget objection"],
  },
  {
    key: "locationFit",
    label: "Location fit",
    options: ["Near office/college", "Slightly far · OK", "Travel concern", "Wrong area"],
  },
  {
    key: "decisionReadiness",
    label: "Decision readiness",
    options: [
      "Self · can book now",
      "Parent approval pending",
      "Group decision pending",
      "Company approval pending",
    ],
  },
  {
    key: "moveInUrgency",
    label: "Move-in urgency",
    options: [
      "0–3 days · immediate",
      "4–7 days · high intent",
      "8–15 days · medium",
      "15+ days · future",
    ],
  },
];

// Per-tour scorecard store (localStorage, keyed by tourId)
function useTourScorecard(tourId: string) {
  const storageKey = `gh-scorecard-${tourId}`;
  const [score, setScore] = useState<ScoreState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw
        ? JSON.parse(raw)
        : {
            propertyFit: "",
            budgetFit: "",
            locationFit: "",
            decisionReadiness: "",
            moveInUrgency: "",
          };
    } catch {
      return {
        propertyFit: "",
        budgetFit: "",
        locationFit: "",
        decisionReadiness: "",
        moveInUrgency: "",
      };
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        setScore(
          raw
            ? JSON.parse(raw)
            : {
                propertyFit: "",
                budgetFit: "",
                locationFit: "",
                decisionReadiness: "",
                moveInUrgency: "",
              },
        );
      } catch {}
    };
    window.addEventListener(storageKey, handleStorage);
    return () => window.removeEventListener(storageKey, handleStorage);
  }, [storageKey]);

  const pick = (key: keyof ScoreState, value: string) => {
    const next = { ...score, [key]: score[key] === value ? "" : value };
    setScore(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event(storageKey));
    } catch {}
  };

  const filledCount = Object.values(score).filter(Boolean).length;
  const pct = Math.round((filledCount / SCORECARD_SECTIONS.length) * 100);

  return { score, pick, filledCount, pct };
}

function PostTourScorecard({ tourId }: { tourId: string }) {
  const { score, pick, pct } = useTourScorecard(tourId);

  return (
    <div className="space-y-2">
      {SCORECARD_SECTIONS.map((sec, i) => (
        <div key={sec.key} className="rounded-xl border border-border p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {i + 1} · {sec.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sec.options.map((opt) => {
              const selected = score[sec.key] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(sec.key, opt)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    selected
                      ? "bg-foreground text-background border-foreground font-medium"
                      : "border-border bg-background text-foreground hover:bg-muted/50",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {/* progress hint */}
      {pct > 0 && pct < 100 && (
        <p className="text-[10px] text-muted-foreground pl-1">{pct}% of scorecard filled</p>
      )}
    </div>
  );
}

function PostTourOutcomeActions({
  tourId,
  pt,
  onApply,
}: {
  tourId: string;
  pt: {
    outcome: string | null;
    confidence: number;
    objection: string | null;
    expectedDecisionAt: string | null;
    nextFollowUpAt: string | null;
    filledAt: string | null;
  };
  onApply: (outcome: "booked" | "thinking" | "not-interested" | "awaiting") => Promise<void>;
}) {
  const { filledCount, pct } = useTourScorecard(tourId);
  const scorecardComplete = filledCount === SCORECARD_SECTIONS.length;
  const formReady =
    scorecardComplete &&
    Boolean(pt.objection) &&
    Boolean(pt.expectedDecisionAt) &&
    Boolean(pt.nextFollowUpAt);
  const remaining: string[] = [];
  if (!scorecardComplete) remaining.push("scorecard");
  if (!pt.objection) remaining.push("objection");
  if (!pt.expectedDecisionAt) remaining.push("expected date");
  if (!pt.nextFollowUpAt) remaining.push("follow-up");
  const options = [
    { o: "booked" as const, label: "Booked", hint: "Ready for quote" },
    { o: "thinking" as const, label: "Still deciding", hint: "Move to negotiation" },
    { o: "not-interested" as const, label: "Not interested", hint: "Drop this lead" },
    { o: "awaiting" as const, label: "Awaiting outcome", hint: "Save follow-up" },
  ];

  return (
    <Section title="Outcome">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const selected = pt.outcome === opt.o;
          return (
            <Button
              key={opt.o}
              variant={selected ? "default" : "outline"}
              size="sm"
              disabled={!formReady || Boolean(pt.filledAt)}
              className="h-auto min-h-12 whitespace-normal flex-col items-start justify-center gap-0.5 px-3 text-left disabled:opacity-55"
              onClick={async () => {
                try {
                  await onApply(opt.o);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Post-tour action failed");
                }
              }}
            >
              <span className="w-full text-sm font-medium">{opt.label}</span>
              <span
                className={`w-full break-words text-xs leading-snug ${selected ? "text-primary-foreground/70" : "text-muted-foreground"}`}
              >
                {opt.hint}
              </span>
            </Button>
          );
        })}
      </div>
      {!formReady && !pt.filledAt && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Complete {remaining.join(", ")} before selecting the final outcome. Scorecard is {pct}%
          filled.
        </div>
      )}
    </Section>
  );
}

function toLocal(iso: string) {
  const d = parseSafeDate(iso);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextRescheduleLocalValue(iso: string) {
  const d = parseSafeDate(iso);
  if (!d || d.getTime() >= Date.now()) return toLocal(iso);
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(d.getHours() || 11, d.getMinutes(), 0, 0);
  return toLocal(next.toISOString());
}

function priorityFor(c: number): FollowUpPriority {
  return c >= 75 ? "high" : c >= 50 ? "medium" : "low";
}

// Salesforce-style activity tab - backed by the new VPS contracts (or local
// adapter when offline). Auto-logs every system change AND lets the user
// quickly log calls, emails, WhatsApp, notes, meetings and site visits.
function LeadActivityTab({ leadId }: { leadId: string }) {
  const { activities, loading, log, remove } = useActivities({
    entityType: "lead",
    entityId: leadId,
  });
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card p-3">
        <ActivityComposer onLog={log} />
      </div>
      <ActivityTimeline
        activities={activities}
        loading={loading}
        onDelete={remove}
        emptyHint="No activity logged yet. Use the composer above to log a call, message, note, or meeting."
      />
    </div>
  );
}
