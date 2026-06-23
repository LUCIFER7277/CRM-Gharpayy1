// Direct Lead Form - full schema, with Email and Full Address optional,
// persists to the
// backend (Mongo) via cmd.lead.create so it shows up in /myt/leads everywhere
// and respects role-based visibility on the server.
import { useEffect, useMemo, useState } from "react";
import { detectZone, detectDirection } from "@/lib/lead-identity/parser";
import { useIdentityStore } from "@/lib/lead-identity/store";
import type { MatchResult, ParsedLeadDraft, UnifiedLead } from "@/lib/lead-identity/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, AlertCircle, User, Phone, Mail, MapPin, Wallet,
  CalendarDays, Briefcase, BedDouble, Sparkles, Loader2, Flame, UserCheck, Tag,
  Search, Building2, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DuplicateModal } from "./DuplicateModal";
import { QUICKAD_NEED_OPTIONS, QUICKAD_ROOM_OPTIONS, QUICKAD_TYPE_OPTIONS, parseBudgetAmount } from "@/lib/quickad-shared";
import { memberOptionLabel, resolveMemberPrimaryZone, useOrgMembers, useOrgZones, useActiveTcMs } from "@/hooks/useOrgDirectory";
import { useAuthUser } from "@/lib/auth-store";
import { dispatch } from "@/lib/api/command-bus";
import { useApp } from "@/lib/store";
import { PGS } from "@/property-genius/data/pgs";
import { searchPGs } from "@/property-genius/lib/search";
import type { PG } from "@/property-genius/data/types";
import { formatINR, cn } from "@/lib/utils";
import { useToggleInterest } from "@/lib/crm10x/lead-interests";

interface Props {
  onCreated?: (lead: UnifiedLead) => void;
}

type Quality = "hot" | "good" | "bad";

type Draft = Omit<ParsedLeadDraft, "quality"> & {
  quality: Quality | "";
  zoneBucket: string;
  assigneeId: string;
  stage: string;
};

const STAGES = [
  "new",
  "contacted",
  "tour-scheduled",
  "tour-done",
  "negotiation",
  "booked",
  "dropped",
  "not-responding-3d",
  "not-responding-7d",
] as const;

const QUALITY_OPTS: { v: Quality; label: string }[] = [
  { v: "hot", label: "🔥 Hot" },
  { v: "good", label: "✅ Good" },
  { v: "bad", label: "❌ Bad" },
];

const emptyDraft = (): Draft => ({
  name: "", phone: "", email: "", location: "", areas: [], fullAddress: "",
  budget: "", moveIn: "",
  type: "", room: "", need: "", specialReqs: "", inBLR: null, zone: "", rawSource: "",
  quality: "", zoneBucket: "", assigneeId: "", stage: "",
});

const TYPE_OPTIONS = QUICKAD_TYPE_OPTIONS;
const ROOM_OPTIONS = QUICKAD_ROOM_OPTIONS;
const NEED_OPTIONS = QUICKAD_NEED_OPTIONS;

const phoneOk = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ""));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function DirectLeadForm({ onCreated }: Props) {
  const checkDuplicates = useIdentityStore((s) => s.checkDuplicates);
  const createLead = useIdentityStore((s) => s.createLead);
  const { members: orgMembers } = useOrgMembers();
  const { tcms: activeTcms } = useActiveTcMs();
  const { zones: orgZones } = useOrgZones();
  const authUser = useAuthUser((s) => s.user);
  const addLead = useApp((s) => s.addLead);
  const { toggleInterest } = useToggleInterest();

  // Default to the current member when a regular member is adding a lead
  const defaultAssigneeId = authUser?.role === "member" || authUser?.role === "tcm" ? authUser.id : "";

  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), assigneeId: defaultAssigneeId }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!draft.assigneeId && defaultAssigneeId) {
      setDraft((d) => ({ ...d, assigneeId: defaultAssigneeId }));
    }
  }, [defaultAssigneeId, draft.assigneeId]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPG, setSelectedPG] = useState<PG | null>(null);
  const [hubQuery, setHubQuery] = useState("");
  const [showHubResults, setShowHubResults] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherPropertyName, setOtherPropertyName] = useState("");

  const hubResults = useMemo(() => {
    const q = hubQuery.trim();
    if (!q && selectedPG) return [];
    if (q) return searchPGs(q, 10);
    if (draft.location) {
      const byArea = PGS.filter((p) =>
        p.area.toLowerCase().includes(draft.location.toLowerCase()) ||
        draft.location.toLowerCase().includes(p.area.toLowerCase()),
      );
      return byArea.slice(0, 10).map((pg) => ({ pg, score: 1, matched: [] }));
    }
    return [...PGS].sort((a, b) => b.iq - a.iq).slice(0, 10).map((pg) => ({ pg, score: 1, matched: [] }));
  }, [hubQuery, selectedPG, draft.location]);

  const sortedMembers = useMemo(() => {
    const base = (activeTcms && activeTcms.length > 0)
      ? activeTcms.map((a: any) => ({ id: a.id, name: a.fullName ?? a.name, role: a.role ?? 'tcm', zones: a.zones ?? (a.zone ? [a.zone] : []) }))
      : orgMembers.filter((m) => m.role === 'member' || m.role === 'tcm').map((m: any) => ({ id: m.id, name: m.fullName ?? m.name, role: m.role, zones: m.zones ?? (m.zone ? [m.zone] : []) }));
    if (authUser && !base.some((b: any) => b.id === authUser.id)) {
      base.unshift({ id: authUser.id, name: authUser.fullName ?? authUser.name, role: authUser.role ?? 'member', zones: (authUser as any).zones ?? ((authUser as any).zone ? [(authUser as any).zone] : []) });
    }
    return base.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, activeTcms, authUser]);
  const selectedAssignee = sortedMembers.find((m: any) => m.id === draft.assigneeId)
    ?? orgMembers.find((m) => m.id === draft.assigneeId)
    ?? (activeTcms || []).find((a: any) => a.id === draft.assigneeId);
  const assigneeZone = useMemo(() => resolveMemberPrimaryZone(selectedAssignee, orgZones), [selectedAssignee, orgZones]);

  const detectedZone = useMemo(
    () => detectDirection(`${draft.location} ${draft.fullAddress}`),
    [draft.location, draft.fullAddress],
  );

  useEffect(() => {
    if (!assigneeZone) return;
    setDraft((d) => ({ ...d, zoneBucket: assigneeZone }));
  }, [draft.assigneeId, assigneeZone]);

  // Auto-detect zone (informational) when location changes
  useEffect(() => {
    if (!draft.location) return;
    const zone = detectZone(draft.location, orgZones);
    if (zone && zone !== draft.zone) {
      setDraft((d) => ({ ...d, zone }));
    }
  }, [draft.location]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!draft.name.trim()) e.name = "Name is required";
    if (!draft.phone.trim()) e.phone = "Phone is required";
    else if (!phoneOk(draft.phone)) e.phone = "Enter a valid 10-digit phone";
    if (draft.email.trim() && !emailOk(draft.email)) e.email = "Invalid email";
    if (!draft.location.trim()) e.location = "Areas are required";
    if (!draft.budget.trim()) e.budget = "Budget is required";
    if (!draft.moveIn) e.moveIn = "Move-in date is required";
    if (!draft.type) e.type = "Type is required";
    if (!draft.room) e.room = "Room preference is required";
    if (!draft.need) e.need = "Need is required";
    if (draft.inBLR === undefined) e.inBLR = "Specify In-Bangalore";
    if (!draft.specialReqs.trim()) e.specialReqs = "Special requirements are required";
    if (!draft.quality) e.quality = "Quality is required";
    if (!draft.zoneBucket) e.zoneBucket = "Zone is required";
    if (!draft.assigneeId) e.assigneeId = "Assignee is required";
    if (!draft.stage) e.stage = "Stage is required";
    return e;
  }, [draft]);

  const totalRequired = 15;
  const filledCount = totalRequired - Object.keys(errors).length;
  const completion = Math.round((filledCount / totalRequired) * 100);

  const submit = () => {
    setTouched(Object.keys(emptyDraft()).reduce((a, k) => ({ ...a, [k]: true }), {}));
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      toast.error(`Fix the highlighted fields: ${first}`);
      return;
    }
    const parsedDraft: ParsedLeadDraft = {
      ...draft,
      quality: draft.quality || null,
    };
    const result = checkDuplicates(parsedDraft);
    if (result.type === "exact" || result.type === "strong") {
      setMatch(result);
      setShowModal(true);
      return;
    }
    void persist();
  };

  const persist = async () => {
    setSubmitting(true);
    const phoneClean = draft.phone.replace(/\D/g, "");
    const areasArr = draft.location.split(",").map((a) => a.trim()).filter(Boolean);
    const assignee = sortedMembers.find((m: any) => m.id === draft.assigneeId)
      ?? orgMembers.find((m) => m.id === draft.assigneeId)
      ?? (activeTcms || []).find((a: any) => a.id === draft.assigneeId);
    const zoneObj = orgZones.find((z) => z.name === draft.zoneBucket);
    const budgetNum = parseBudgetAmount(draft.budget);

    const result = await dispatch({
      type: "cmd.lead.create",
      payload: {
        name: draft.name.trim(),
        phone: `+91${phoneClean}`,
        source: "direct-form",
        budget: budgetNum,
        budgetText: draft.budget.trim(),
        moveInDate: draft.moveIn,
        preferredArea: areasArr[0] ?? draft.location.trim(),
        zoneId: zoneObj?.id ?? null,
        email: draft.email.trim(),
        areas: areasArr,
        fullAddress: draft.fullAddress.trim(),
        type: draft.type,
        room: draft.room,
        need: draft.need,
        inBLR: draft.inBLR,
        quality: draft.quality as Quality,
        specialReqs: draft.specialReqs.trim(),
        notes: "",
        zoneCategory: draft.zoneBucket,
        assigneeId: assignee?.id ?? null,
        stageLabel: draft.stage,
        propertySelection: draft.propertySelection,
      },
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(`Could not save: ${result.error}`);
      return;
    }
    const newLeadId = (result as any).data?.leadId;

    // Mirror locally so dedup hints stay current this session
    const parsedDraft: ParsedLeadDraft = {
      ...draft,
      quality: draft.quality || null,
    };
    const identityLead = createLead(parsedDraft);

    // Optimistically add to the main app store for immediate visibility
    addLead({
      id: newLeadId || identityLead.id,
      name: draft.name.trim(),
      phone: `+91${phoneClean}`,
      source: "direct-form",
      budget: budgetNum,
      budgetText: draft.budget.trim(),
      moveInDate: draft.moveIn,
      preferredArea: areasArr[0] ?? draft.location.trim(),
      assignedTcmId: assignee?.id ?? "",
      stage: "new",
      intent: draft.quality === "hot" ? "hot" : draft.quality === "bad" ? "cold" : "warm",
      tags: [],
      propertySelection: draft.propertySelection,
    });

    if (draft.propertySelection?.type === "hub" && draft.propertySelection.propertyId) {
      void toggleInterest({
        leadId: newLeadId || identityLead.id,
        propertyId: draft.propertySelection.propertyId,
        interested: true,
      });
    }

    toast.success(`Lead saved · ${draft.name.trim()}`);
    setDraft({ ...emptyDraft(), assigneeId: defaultAssigneeId });
    setSelectedPG(null);
    setHubQuery("");
    setOtherPropertyName("");
    setTouched({});
    setMatch(null);
    onCreated?.(identityLead);
  };

  const onForceCreate = () => {
    setShowModal(false);
    void persist();
  };

  const onUseExisting = (lead: UnifiedLead) => {
    toast.info(`Opening existing lead: ${lead.name}`);
    setShowModal(false);
    onCreated?.(lead);
  };

  const showError = (k: keyof Draft) => touched[k as string] && errors[k];

  return (
    <div className="space-y-4">
      {/* Header progress */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">New lead</h3>
            <p className="text-[11px] text-muted-foreground">Email and full address are optional · saves to backend</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Completion</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-xs font-medium tabular-nums">{completion}%</span>
          </div>
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity" subtitle="Name and phone required for safe deduplication">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField icon={User} label="Full name *" error={showError("name") ? errors.name : undefined}>
            <Input value={draft.name} onChange={(e) => update("name", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="Rahul Sharma" className="h-10 text-sm" autoFocus />
          </FormField>
          <FormField icon={Phone} label="Phone *" error={showError("phone") ? errors.phone : undefined}>
            <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="98xxxxxxxx" inputMode="tel" className={cn("h-10 text-sm transition-colors duration-200", draft.phone.replace(/\D/g, "").length === 10 ? "text-foreground bg-background" : draft.phone.length > 0 ? "text-destructive bg-destructive/10 border-destructive/50 font-medium" : "")} />
          </FormField>
          <FormField icon={Mail} label="Email (optional)" error={showError("email") ? errors.email : undefined}>
            <Input value={draft.email} onChange={(e) => update("email", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="rahul@example.com" type="email" className="h-10 text-sm" />
          </FormField>
          <FormField icon={MapPin} label="Preferred property (from Property Hub) *"
            error={showError("location") ? errors.location : undefined}>
            <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setShowHubResults(false), 200); }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={selectedPG ? selectedPG.name : hubQuery}
                  onChange={(e) => {
                    setHubQuery(e.target.value);
                    setShowHubResults(true);
                    if (selectedPG) {
                      setSelectedPG(null);
                      update("location", "");
                      update("propertySelection", undefined);
                    }
                  }}
                  onFocus={() => setShowHubResults(true)}
                  onBlur={() => { setTouched((t) => ({ ...t, location: true })); }}
                  placeholder="Search Property Hub — name, area, landmark…"
                  className="h-10 text-sm pl-8"
                />
                {draft.zone && !selectedPG && (
                  <Badge variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]">
                    {draft.zone}
                  </Badge>
                )}
              </div>
              {selectedPG && (
                <div className="mt-1.5 rounded-md border border-primary/40 bg-primary/5 p-2">
                  <div className="text-sm font-semibold">{selectedPG.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedPG.area} · {selectedPG.gender} · IQ {selectedPG.iq}
                  </div>
                </div>
              )}
              {showHubResults && !selectedPG && draft.propertySelection?.type !== "other" && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-56 flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {hubResults.map(({ pg }) => (
                      <button
                        key={pg.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedPG(pg);
                          update("location", pg.area);
                          update("propertySelection", { type: "hub", propertyId: pg.id, propertyName: pg.name });
                          setHubQuery("");
                          setShowHubResults(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border last:border-0"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{pg.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {pg.area} · {formatINR(Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter(Boolean)))}/mo · IQ {pg.iq}
                          </div>
                        </div>
                      </button>
                    ))}
                    {hubResults.length === 0 && (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">No properties found in Property Hub</div>
                    )}
                  </div>
                  <div className="p-2 border-t border-border bg-muted/20 shrink-0">
                    <Button variant="secondary" size="sm" className="w-full text-xs" onClick={(e) => { 
                      e.preventDefault(); 
                      setShowOtherModal(true); 
                      setShowHubResults(false); 
                    }}>Other Property</Button>
                  </div>
                </div>
              )}
              {draft.propertySelection?.type === "other" && draft.propertySelection.propertyName && (
                <div className="mt-1.5 rounded-md border border-primary/40 bg-primary/5 p-2 flex justify-between items-center">
                  <div className="text-sm font-semibold">Other: {draft.propertySelection.propertyName}</div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { 
                    e.preventDefault();
                    setOtherPropertyName(draft.propertySelection?.propertyName || "");
                    setShowOtherModal(true);
                  }}>Change</Button>
                </div>
              )}
            </div>
          </FormField>
          <FormField icon={MapPin} label="Full address / map link (optional)"
            error={showError("fullAddress") ? errors.fullAddress : undefined}>
            <Textarea value={draft.fullAddress} onChange={(e) => update("fullAddress", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fullAddress: true }))}
              placeholder="Door no, street, landmark or Google Maps link" className="min-h-16 text-sm" />
          </FormField>
        </div>
      </Section>

      {/* Requirements */}
      <Section title="Requirements" subtitle="All fields required">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField icon={Wallet} label="Budget (₹/month) *" error={showError("budget") ? errors.budget : undefined}>
            <Input value={draft.budget} onChange={(e) => update("budget", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, budget: true }))}
              placeholder="8000-12000" className="h-10 text-sm" />
          </FormField>
          <FormField icon={CalendarDays} label="Move-in *" error={showError("moveIn") ? errors.moveIn : undefined}>
            <Input type="date" value={draft.moveIn} onChange={(e) => update("moveIn", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, moveIn: true }))} className="h-10 text-sm" />
          </FormField>
          <FormField icon={Briefcase} label="Type *" error={showError("type") ? errors.type : undefined}>
            <Select value={draft.type} onValueChange={(v) => update("type", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField icon={BedDouble} label="Room preference *" error={showError("room") ? errors.room : undefined}>
            <Select value={draft.room} onValueChange={(v) => update("room", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {ROOM_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Cohort / need *" error={showError("need") ? errors.need : undefined}>
            <Select value={draft.need} onValueChange={(v) => update("need", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {NEED_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Currently in Bangalore? *" error={showError("inBLR") ? errors.inBLR : undefined}>
            <Select value={draft.inBLR === undefined ? "" : draft.inBLR === null ? "unknown" : draft.inBLR ? "yes" : "no"}
              onValueChange={(v) => update("inBLR", v === "unknown" ? null : v === "yes")}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Special requirements / notes *" error={showError("specialReqs") ? errors.specialReqs : undefined}>
          <Textarea value={draft.specialReqs} onChange={(e) => update("specialReqs", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, specialReqs: true }))}
            placeholder="e.g. needs parking, food preferences, family visiting…" className="min-h-20 text-sm" />
        </FormField>
      </Section>

      {/* Routing & Stage */}
      <Section title="Routing & Stage" subtitle="Required for assignment and visibility">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField icon={Flame} label="Lead quality *" error={showError("quality") ? errors.quality : undefined}>
            <Select value={draft.quality} onValueChange={(v) => update("quality", v as Quality)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {QUALITY_OPTS.map((q) => <SelectItem key={q.v} value={q.v}>{q.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField icon={MapPin} label="Zone *" error={showError("zoneBucket") ? errors.zoneBucket : undefined}>
            <Select value={draft.zoneBucket} onValueChange={(v) => update("zoneBucket", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {orgZones.map((z) => <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField icon={UserCheck} label="Assign member *" error={showError("assigneeId") ? errors.assigneeId : undefined}>
            <Select value={draft.assigneeId} onValueChange={(v) => update("assigneeId", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {sortedMembers.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{memberOptionLabel(o)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField icon={Tag} label="Lead stage *" error={showError("stage") ? errors.stage : undefined}>
            <Select value={draft.stage} onValueChange={(v) => update("stage", v)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </Section>

      {/* Footer */}
      <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 bg-linear-to-t from-background via-background/95 to-background/0">
        <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {Object.keys(errors).length === 0 ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> All required fields filled - ready to save</>
            ) : (
              <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /> {Object.keys(errors).length} field(s) remaining</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDraft(emptyDraft()); setTouched({}); }}>
              Reset
            </Button>
            <Button onClick={submit} disabled={submitting} size="sm" className="h-9 gap-2 min-w-36">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save lead
            </Button>
          </div>
        </div>
      </div>

      <DuplicateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        result={match}
        onForceCreate={onForceCreate}
        onUseExisting={onUseExisting}
      />

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
            <Button size="sm" onClick={() => {
              const cleanName = otherPropertyName.replace(/\s+/g, " ").trim();
              if (!cleanName) { toast.error("Property Name is required"); return; }
              update("propertySelection", { type: "other", propertyName: cleanName });
              setShowOtherModal(false);
            }}>Save Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FormField({
  label, error, icon: Icon, children,
}: {
  label: string;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      {children}
      {error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
    </div>
  );
}
