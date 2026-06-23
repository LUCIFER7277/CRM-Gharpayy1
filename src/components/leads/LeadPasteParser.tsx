// Paste a WhatsApp / portal message → auto-extract every field → review the FULL Quick Add field
// set (Name, Phone, Email, Areas, Full Address, Budget, Move-in, Type, Room, Need, Special Reqs,
// In-BLR, Quality, Zone, Assignee, Stage, Notes) → save through the unified Identity store.
//
// Same UX as before (paste box first, then fields appear), but with ALL fields, matching the
// Quick Add panel 1:1 so nothing is missed before saving.
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, MapPin, Sparkles, Wand2 } from "lucide-react";
import { detectDirection } from "@/lib/lead-identity/parser";
import { LeadParsingService, type AIParsedLead } from "@/lib/lead-identity/LeadParsingService";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { memberOptionLabel, memberShortLabel, resolveMemberPrimaryZone, useOrgMembers, useOrgZones, useActiveTcMs } from "@/hooks/useOrgDirectory";
import { useAuthUser } from "@/lib/auth-store";
import { dispatch } from "@/lib/api/command-bus";
import { api } from "@/lib/api/client";
import { QUICKAD_NEED_OPTIONS, QUICKAD_ROOM_OPTIONS, QUICKAD_TYPE_OPTIONS, parseBudgetAmount } from "@/lib/quickad-shared";
import type { ParsedLeadDraft } from "@/lib/lead-identity/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useApp } from "@/lib/store";
import type { LeadStage, Intent } from "@/lib/types";

const SAMPLE = `Hi team, new lead 👇
Rahul Sharma 9876543210
Email: rahul@example.com
Looking in HSR Layout, BTM, Koramangala
Budget: 8-12k
Move in: 30/06/2026
Working professional, private room, boys
Currently in Bangalore`;

// Zone bucket options come from the org's real zones (live from /api/zones).

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

const QUALITY_OPTS = [
  { v: "hot" as const, label: "Hot" },
  { v: "good" as const, label: "Good" },
  { v: "bad" as const, label: "Bad" },
];
const BLR_OPTS = [
  { v: true as const, label: "In Bangalore" },
  { v: false as const, label: "Out of Bangalore" },
  { v: null, label: "Unknown" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Props {
  onDone?: () => void;
}

export function LeadPasteParser({ onDone }: Props) {
  const create = useIdentityStore((s) => s.createLead);
  const { members: orgMembers } = useOrgMembers();
  const { tcms: activeTcms } = useActiveTcMs();
  const { zones: orgZones } = useOrgZones();

  const authUser = useAuthUser((s) => s.user);
  const sortedZones = useMemo(() => orgZones.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgZones]);
  const sortedMembers = useMemo(() => {
    const base = (activeTcms && activeTcms.length > 0)
      ? activeTcms.map((a: any) => ({ id: a.id, name: a.fullName ?? a.name, role: a.role ?? 'tcm', zones: a.zones ?? (a.zone ? [a.zone] : []) }))
      : orgMembers.filter((m) => m.role === 'member' || m.role === 'tcm').map((m: any) => ({ id: m.id, name: m.fullName ?? m.name, role: m.role, zones: m.zones ?? (m.zone ? [m.zone] : []) }));
    if (authUser && !base.find((b: any) => b.id === authUser.id)) {
      base.unshift({ id: authUser.id, name: authUser.fullName ?? authUser.name, role: authUser.role ?? 'member', zones: (authUser as any).zones ?? ((authUser as any).zone ? [(authUser as any).zone] : []) });
    }
    return base.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, activeTcms, authUser]);
  const sortedStages = useMemo(() => Array.from(STAGES).slice().sort((a, b) => a.localeCompare(b)), []);
  const addLead = useApp((s) => s.addLead);

  const [raw, setRaw] = useState("");
  const [parsedOnce, setParsedOnce] = useState(false);
  const [parsingAI, setParsingAI] = useState(false);
  const [lastParsedConfidence, setLastParsedConfidence] = useState<number>(0);
  const [aiMissing, setAiMissing] = useState<string[]>([]);
  const [parsedByAI, setParsedByAI] = useState(false);
  const [rawSource, setRawSource] = useState("");

  // Quick-Add field state (same as QuickAddLeadPanel)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [areasText, setAreasText] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [type, setType] = useState("");
  const [room, setRoom] = useState("");
  const [need, setNeed] = useState("");
  const [specialReqs, setSpecialReqs] = useState("");
  const [inBLR, setInBLR] = useState<boolean | null | undefined>(undefined);
  const [quality, setQuality] = useState<"hot" | "good" | "bad" | null>(null);
  const [zoneBucket, setZoneBucket] = useState<string>("");
  // Default to the current member when a regular member is adding a lead
  const defaultAssigneeId = authUser?.role === "member" || authUser?.role === "tcm" ? authUser.id : "";
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId);
  const [stage, setStage] = useState<string>(STAGES[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!assigneeId && defaultAssigneeId) {
      setAssigneeId(defaultAssigneeId);
    }
  }, [assigneeId, defaultAssigneeId]);

  const selectedAssignee = sortedMembers.find((m: any) => m.id === assigneeId)
    ?? orgMembers.find((m) => m.id === assigneeId)
    ?? (activeTcms || []).find((a: any) => a.id === assigneeId);
  const assigneeZone = useMemo(() => resolveMemberPrimaryZone(selectedAssignee, orgZones), [selectedAssignee, orgZones]);

  useEffect(() => {
    if (!assigneeZone) return;
    setZoneBucket(assigneeZone);
  }, [assigneeId, assigneeZone]);

  const textRef = useRef<HTMLTextAreaElement>(null);

  const detectedZone = useMemo(
    () => detectDirection(`${areasText} ${fullAddress}`),
    [areasText, fullAddress],
  );

  // Auto-parse whenever the paste text changes
  useEffect(() => {
    if (!raw || raw.length < 10) { 
      setParsedOnce(false); 
      setParsingAI(false);
      return; 
    }
    
    let isStale = false;
    setParsingAI(true);
    
    LeadParsingService.parseLead(raw, orgZones).then((parsed) => {
      if (isStale) return;
      setParsingAI(false);
      if (!parsed || parsed.confidence === 0) return;
      setLastParsedConfidence(parsed.confidence);
      setAiMissing(parsed.missing);
      setParsedByAI(parsed.parsedByAI);
      setRawSource(parsed.rawSource);
      applyParsed(parsed);
      setParsedOnce(true);
    });

    return () => {
      isStale = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const applyParsed = (p: AIParsedLead) => {
    if (p.fields.name) setName(p.fields.name);
    if (p.fields.phone) setPhone(p.fields.phone);
    if (p.fields.email) setEmail(p.fields.email);
    if (p.fields.area) setAreasText(p.fields.area);
    if (p.fields.budget) setBudget(p.fields.budget);
    
    // Accept moveIn if it's ISO format OR any non-empty string (parser tries to convert human dates)
    if (p.fields.moveIn) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(p.fields.moveIn)) setMoveIn(p.fields.moveIn);
      else if (p.fields.moveIn.trim().length > 0) setMoveIn(p.fields.moveIn); // Fallback for unparseable dates
    }
    
    if (p.fields.type) setType(p.fields.type);
    if (p.fields.room) setRoom(p.fields.room);
    if (p.fields.need) setNeed(p.fields.need.split(" / ")[0] ?? p.fields.need);
    if (p.fields.specialReqs) setSpecialReqs(p.fields.specialReqs);
    if (p.fields.internalNotes) setNotes(p.fields.internalNotes);
  };

  const reset = () => {
    setRaw(""); setParsedOnce(false);
    setLastParsedConfidence(0);
    setAiMissing([]);
    setParsedByAI(false);
    setRawSource("");
    setName(""); setPhone(""); setEmail("");
    setAreasText(""); setFullAddress("");
    setBudget(""); setMoveIn("");
    setType(""); setRoom(""); setNeed(""); setSpecialReqs("");
    setInBLR(null); setQuality(null); setZoneBucket("");
    setAssigneeId(defaultAssigneeId); setStage(STAGES[0]); setNotes("");
  };

  // Validation matching Quick Add - Email and Full Address are optional.
  const phoneClean = phone.replace(/\D/g, "");
  const phoneValid = /^[6-9]\d{9}$/.test(phoneClean);
  const emailClean = email.trim().toLowerCase();
  const emailValid = !emailClean || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean);
  const validationItems = [
    { key: "name", label: "Name", missing: !name.trim() },
    { key: "phone", label: "Valid 10-digit phone", missing: !phoneValid },
    { key: "email", label: "Valid email", missing: !emailValid },
    { key: "areas", label: "Areas", missing: !areasText.trim() },
    { key: "budget", label: "Budget", missing: !budget.trim() },
    { key: "moveIn", label: "Move-in date", missing: !moveIn },
    { key: "moveInFuture", label: "Future move-in date", missing: Boolean(moveIn && moveIn < todayIso()) },
    { key: "type", label: "Type", missing: !type },
    { key: "room", label: "Room", missing: !room },
    { key: "need", label: "Need", missing: !need },
    { key: "inBLR", label: "In Bangalore?", missing: inBLR === undefined },
    { key: "quality", label: "Lead Quality", missing: !quality },
    { key: "zone", label: "Zone", missing: !zoneBucket },
    { key: "assignee", label: "Assigned member", missing: !assigneeId },
    { key: "stage", label: "Lead stage", missing: !stage },
  ] as const;
  const missingItems = validationItems.filter((item) => item.missing);
  const missingKeys = new Set(missingItems.map((item) => item.key));
  const errors = missingItems.map((item) => item.label);
  const isPending = (key: (typeof validationItems)[number]["key"]) => missingKeys.has(key);
  const blocking = errors.length > 0;
  const invalidInputClass = (key: (typeof validationItems)[number]["key"]) => cn(
    isPending(key) && "border-destructive/70 bg-destructive/5 focus-visible:ring-destructive/40",
  );
  const fieldHint = (key: (typeof validationItems)[number]["key"]) => (
    isPending(key) ? <p className="text-[10px] font-medium text-destructive">{validationItems.find((item) => item.key === key)?.label} required</p> : null
  );

  const save = async () => {
    if (savingRef.current) return;
    if (blocking) {
      toast.error(`Fill all required fields: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "…" : ""}`);
      return;
    }
    const areasArr = areasText.split(",").map((a) => a.trim()).filter(Boolean);
    const zoneObj = orgZones.find((z) => z.name === zoneBucket);
    const budgetNum = parseBudgetAmount(budget);

    savingRef.current = true;
    setSaving(true);
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch({
        type: "cmd.lead.create",
        payload: {
          name: name.trim(),
          phone: `+91${phoneClean}`,
          source: "paste",
          budget: budgetNum,
          budgetText: budget.trim(),
          moveInDate: moveIn,
          preferredArea: areasArr[0] ?? areasText.trim(),
          zoneId: zoneObj?.id ?? null,
          email: emailClean,
          areas: areasArr,
          fullAddress: fullAddress.trim(),
          type, room, need,
          inBLR: inBLR === undefined ? null : inBLR,
          quality,
          specialReqs: specialReqs.trim(),
          notes: notes.trim(),
          zoneCategory: zoneBucket,
          assigneeId: selectedAssignee?.id ?? null,
          stageLabel: stage,
          rawSource: rawSource || raw,
          aiConfidence: lastParsedConfidence,
          parsedByAI,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save lead");
      savingRef.current = false;
      setSaving(false);
      return;
    }
    savingRef.current = false;
    setSaving(false);
    if (!result.ok) {
      toast.error(`Could not save: ${result.error}`);
      return;
    }

    const isServerDuplicate = Boolean((result as any).data?.duplicate);
    if (isServerDuplicate) {
      const existingLeadId = (result as any).data?.leadId;
      if (existingLeadId) {
        try {
          if (selectedAssignee?.id) {
            const assignResult = await dispatch({
              type: "cmd.lead.assign",
              payload: { leadId: existingLeadId, tcmId: selectedAssignee.id },
            });
            if (!assignResult.ok) {
              toast.warning(`Lead already exists, but could not assign it: ${assignResult.error}`);
            }
          }
          const existing = await api.leads.get(existingLeadId) as any;
          addLead({
            id: existing._id,
            name: existing.name,
            phone: existing.phone,
            source: existing.source ?? "manual",
            budget: Number(existing.budget ?? 0),
            budgetText: existing.budgetText ?? "",
            moveInDate: existing.moveInDate,
            preferredArea: existing.preferredArea ?? existing.areas?.[0] ?? "",
            assignedTcmId: existing.assignedTcmId ?? selectedAssignee?.id ?? "",
            assigneeId: existing.assigneeId ?? existing.assignedTcmId ?? selectedAssignee?.id ?? null,
            createdBy: existing.createdBy ?? null,
            stage: (existing.stage ?? "new") as LeadStage,
            intent: (existing.intent ?? "warm") as Intent,
            confidence: Number(existing.confidence ?? 50),
            tags: existing.tags ?? [],
            nextFollowUpAt: existing.nextFollowUpAt ?? null,
            responseSpeedMins: Number(existing.responseSpeedMins ?? 0),
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
            email: existing.email ?? "",
            areas: existing.areas ?? [],
            fullAddress: existing.fullAddress ?? "",
            type: existing.type ?? "",
            room: existing.room ?? "",
            need: existing.need ?? "",
            inBLR: existing.inBLR ?? null,
            quality: existing.quality ?? null,
            specialReqs: existing.specialReqs ?? "",
            notes: existing.notes ?? "",
            zoneCategory: existing.zoneCategory ?? "",
            stageLabel: existing.stageLabel ?? "",
          });
          toast.info(`This phone already exists. Added ${existing.name ?? "existing lead"} to Inbox.`);
          reset();
          onDone?.();
        } catch {
          toast.warning("This phone already exists, but the existing lead is outside your visible queue. No duplicate was created.");
        }
      } else {
        toast.warning("This phone already exists. No duplicate lead was created.");
      }
      return;
    }

    const newLeadId = (result as any).data?.leadId;

    // Mirror into the local identity store so dedup hints stay current.
    const identityLead = create(
      {
        name: name.trim(),
        phone: `+91${phoneClean}`,
        email: emailClean,
        location: areasText.trim(),
        areas: areasArr,
        fullAddress: fullAddress.trim(),
        budget: budget.trim(),
        moveIn,
        type, room, need,
        specialReqs: [specialReqs, notes].filter(Boolean).join(" · "),
        extraContent: notes.trim(),
        budgets: budget.split(/\s*(?:,|\/|\bor\b)\s*/i).filter(Boolean),
        links: fullAddress.match(/https?:\/\/\S+/g) ?? [],
        inBLR: inBLR === undefined ? null : inBLR,
        zone: detectedZone,
        rawSource: rawSource || raw || `[Paste] ${name} ${phone}`,
      },
      {
        quality,
        stage,
        zoneCategory: zoneBucket,
        assigneeId: selectedAssignee?.id ?? null,
        assigneeName: selectedAssignee?.name ?? null,
      },
    );

    // Optimistically add to the main app store for immediate visibility
    const now = new Date().toISOString();
    addLead({
      id: newLeadId || identityLead.id,
      name: name.trim(),
      phone: `+91${phoneClean}`,
      source: "paste",
      budget: budgetNum,
      budgetText: budget.trim(),
      moveInDate: moveIn,
      preferredArea: areasArr[0] ?? areasText.trim(),
      assignedTcmId: selectedAssignee?.id ?? "",
      assigneeId: selectedAssignee?.id ?? null,
      createdBy: authUser?.id ?? null,
      stage: "new",
      intent: (quality === "hot" ? "hot" : quality === "bad" ? "cold" : "warm") as Intent,
      confidence: quality === "hot" ? 90 : quality === "good" ? 70 : quality === "bad" ? 30 : 50,
      tags: [],
      nextFollowUpAt: null,
      responseSpeedMins: 0,
      createdAt: now,
      updatedAt: now,
      email: emailClean,
      areas: areasArr,
      fullAddress: fullAddress.trim(),
      type, room, need,
      inBLR: inBLR === undefined ? null : inBLR,
      quality: quality || "good",
      specialReqs: specialReqs.trim(),
      notes: notes.trim(),
      zoneCategory: zoneBucket,
      stageLabel: stage,
    });
    toast.success(`Lead saved · assigned to ${selectedAssignee?.name ?? "Unassigned"}`);
    reset();
    onDone?.();
  };

  return (
    <div className="grid min-h-0 flex-1 items-stretch gap-3 overflow-hidden xl:grid-cols-[minmax(360px,1.05fr)_minmax(420px,1.2fr)_280px]">
      <div className="min-h-0">
        {/* Paste box */}
        <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-sm">
          <div className="border-b border-border bg-muted/25 px-3 py-2">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Paste the lead</h3>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Paste a WhatsApp, portal, or call note. Parsed fields appear on the right.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => setRaw(SAMPLE)}>
              <Sparkles className="h-3 w-3 mr-1" /> Try sample
            </Button>
            <Textarea
              ref={textRef}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste WhatsApp message, portal lead, email signature, anything..."
              rows={9}
              className="min-h-[360px] flex-1 resize-none rounded-lg bg-background font-mono text-sm leading-relaxed"
            />
            {parsingAI && (
              <p className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[11px] text-blue-500 animate-pulse">
                <Wand2 className="h-3 w-3" /> Parsing with AI...
              </p>
            )}
            {!parsingAI && parsedOnce && (
              parsedByAI ? (
                <p className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[11px] text-success">
                  <CheckCircle2 className="h-3 w-3" /> Parsed by AI ({lastParsedConfidence}%). Review before saving.
                </p>
              ) : (
                <p className="flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning-foreground">
                  <AlertCircle className="h-3 w-3 text-warning" /> AI Parsing unavailable. Regex fallback used.
                </p>
              )
            )}
          </div>
        </Card>
      </div>

      {/* Full Quick-Add field set (always visible so the person fills missing pieces) */}
      <Card className="flex min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-sm [&_input]:h-8 [&_input]:text-xs [&_button]:min-h-0 [&_button]:text-[11px] [&_textarea]:text-xs">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2">
          <div>
            <h3 className="font-semibold text-sm">Review & complete</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Confirm lead identity, requirement, preferences, and routing before it enters Inbox.
            </p>
          </div>
          {blocking ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> {errors.length} required
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Ready
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 p-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 items-start">
            <FormGroup title="Contact" invalid={isPending("name") || isPending("phone") || isPending("email") || isPending("areas")}>
              <Field label="Name *" invalid={isPending("name")} hint={fieldHint("name")}>
                <div className="relative">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" className={invalidInputClass("name")} />
                  {parsedOnce && lastParsedConfidence > 0 && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                      <Badge variant="outline" className={cn("text-[9px]", lastParsedConfidence > 80 ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30")}>
                        {lastParsedConfidence}%
                      </Badge>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Phone *" invalid={isPending("phone")} hint={fieldHint("phone")}>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhone(phoneClean.slice(-10))}
                  placeholder="98xxxxxxxx"
                  inputMode="tel"
                  className={cn(invalidInputClass("phone"), "transition-colors duration-200", phone.replace(/\D/g, "").length === 10 ? "text-foreground bg-background" : phone.length > 0 ? "text-destructive bg-destructive/10 border-destructive/50 font-medium" : "")}
                />
              </Field>
              <Field label="Email" invalid={isPending("email")} hint={isPending("email") ? <p className="text-[10px] font-medium text-destructive">Use name@example.com format</p> : null}>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail(emailClean)}
                  placeholder="name@example.com"
                  inputMode="email"
                  className={invalidInputClass("email")}
                />
              </Field>
              <Field label="Areas *" invalid={isPending("areas")} hint={fieldHint("areas")}>
                <div className="relative">
                  <Textarea
                    value={areasText}
                    onChange={(e) => setAreasText(e.target.value)}
                    placeholder="HSR, BTM, Koramangala"
                    rows={2}
                    className={cn("resize-none pr-12 min-h-[44px]", invalidInputClass("areas"))}
                  />
                  {detectedZone && (
                    <Badge variant="secondary" className="absolute right-1.5 bottom-1.5 text-[9px] px-1.5 py-0 pointer-events-none">
                      {detectedZone}
                    </Badge>
                  )}
                </div>
              </Field>
            </FormGroup>

            <FormGroup title="Requirement" invalid={isPending("budget") || isPending("moveIn") || isPending("moveInFuture") || isPending("type")}>
              <Field label="Budget" invalid={isPending("budget")} hint={fieldHint("budget")}>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="8-12k" className={invalidInputClass("budget")} />
              </Field>
              <Field label="Move-in" invalid={isPending("moveIn") || isPending("moveInFuture")} hint={isPending("moveInFuture") ? <p className="text-[10px] font-medium text-destructive">Move-in must be today or later</p> : fieldHint("moveIn")}>
                <Input
                  type="date"
                  min={todayIso()}
                  value={moveIn}
                  onChange={(e) => setMoveIn(e.target.value)}
                  className={cn(invalidInputClass("moveIn"), invalidInputClass("moveInFuture"))}
                />
              </Field>
              <Field label="Address / map">
                <Textarea
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder="Door, landmark or Maps URL"
                  rows={2}
                  className="resize-none min-h-[44px]"
                />
              </Field>
              <Field label="Type" invalid={isPending("type")} hint={fieldHint("type")}>
                <ChipGroup options={QUICKAD_TYPE_OPTIONS} value={type} onChange={setType} invalid={isPending("type")} />
              </Field>
            </FormGroup>

            <FormGroup title="Preferences" invalid={isPending("room") || isPending("need") || isPending("inBLR") || isPending("quality")}>
              <Field label="Room" invalid={isPending("room")} hint={fieldHint("room")}>
                <ChipGroup options={QUICKAD_ROOM_OPTIONS} value={room} onChange={setRoom} invalid={isPending("room")} />
              </Field>
              <Field label="Need" invalid={isPending("need")} hint={fieldHint("need")}>
                <ChipGroup options={QUICKAD_NEED_OPTIONS} value={need} onChange={setNeed} invalid={isPending("need")} />
              </Field>
              <Field label="Currently in Bangalore?" invalid={isPending("inBLR")} hint={fieldHint("inBLR")}>
                <ChipGroup
                  options={BLR_OPTS.map((o) => o.label)}
                  value={BLR_OPTS.find((o) => o.v === inBLR)?.label ?? ""}
                  invalid={isPending("inBLR")}
                  onChange={(label) => {
                    const opt = BLR_OPTS.find((o) => o.label === label);
                    if (opt !== undefined) setInBLR(opt.v);
                  }}
                />
              </Field>
              <Field label="Lead Quality" invalid={isPending("quality")} hint={fieldHint("quality")}>
                <ChipGroup
                  options={QUALITY_OPTS.map((o) => o.label)}
                  value={QUALITY_OPTS.find((o) => o.v === quality)?.label ?? ""}
                  invalid={isPending("quality")}
                  onChange={(label) => setQuality(QUALITY_OPTS.find((o) => o.label === label)?.v ?? null)}
                />
              </Field>
            </FormGroup>

            <FormGroup title="Notes">
              <Field label="Requests">
                <Textarea
                  value={specialReqs}
                  onChange={(e) => setSpecialReqs(e.target.value)}
                  rows={1}
                  placeholder="Veg, attached washroom, top floor..."
                  className="min-h-[38px] resize-none"
                />
              </Field>
              <Field label="Internal notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  placeholder="Internal notes for TCM..."
                  className="min-h-[38px] resize-none"
                />
              </Field>
            </FormGroup>
          </div>

          {blocking && (
            <div
              className="mt-2 line-clamp-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive"
              title={`Missing: ${errors.join(", ")}`}
            >
              Missing: {errors.join(", ")}
            </div>
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-sm [&_button]:min-h-0 [&_button]:text-[11px]">
        <div className="border-b border-border bg-muted/25 px-3 py-2">
          <h3 className="font-semibold text-sm">Manual setup</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Choose routing, assignee, and stage before saving.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <LeftField label="Zone *" invalid={isPending("zone")} hint={fieldHint("zone")}>
            <Select value={zoneBucket} onValueChange={(v) => setZoneBucket(v)}>
              <SelectTrigger className={cn("h-8 w-full text-xs", invalidInputClass("zone"))}>
                <SelectValue placeholder={orgZones.length ? "Select zone..." : "No zones configured"} />
              </SelectTrigger>
              <SelectContent>
                {sortedZones.map((z) => <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </LeftField>

          <LeftField label="Assign member *" invalid={isPending("assignee")} hint={fieldHint("assignee")}>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v)}>
              <SelectTrigger className={cn("h-8 w-full text-xs", invalidInputClass("assignee"))}>
                <SelectValue placeholder={orgMembers.length ? "Select member..." : "No members yet"} />
              </SelectTrigger>
              <SelectContent>
                {sortedMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{memberOptionLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LeftField>

          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-[11px]">
            <div className="text-muted-foreground">Lead will be assigned to</div>
            <div className="font-semibold text-foreground">{memberShortLabel(selectedAssignee)}</div>
          </div>

          <LeftField label="Lead stage" invalid={isPending("stage")} hint={fieldHint("stage")}>
            <Select value={stage} onValueChange={(v) => setStage(v)}>
              <SelectTrigger className={cn("h-8 w-full text-xs", invalidInputClass("stage"))}>
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {sortedStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </LeftField>
        </div>

        <div className="space-y-2 border-t bg-muted/15 p-3">
          {blocking ? (
            <div
              className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive"
              title={`Missing: ${errors.join(", ")}`}
            >
              <span className="font-semibold">{errors.length} pending:</span> {errors.slice(0, 4).join(", ")}{errors.length > 4 ? "…" : ""}
            </div>
          ) : (
            <div className="rounded-md border border-success/20 bg-success/10 px-2 py-1.5 text-[11px] text-success">
              Ready to save into Inbox.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={saving}>Clear</Button>
            <Button size="sm" disabled={blocking || saving} onClick={save}>{saving ? "Saving..." : "Save lead"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, invalid, hint }: { label: string; children: React.ReactNode; invalid?: boolean; hint?: React.ReactNode }) {
  return (
    <div className={cn("space-y-0.5 rounded-md", invalid && "text-destructive")}>
      <Label className={cn("text-[10px] uppercase tracking-wide text-muted-foreground", invalid && "text-destructive")}>{label}</Label>
      {children}
      {hint}
    </div>
  );
}

function LeftField({ label, children, invalid, hint }: { label: string; children: React.ReactNode; invalid?: boolean; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={cn("text-[10px] uppercase tracking-wider text-muted-foreground", invalid && "text-destructive")}>{label}</Label>
      {children}
      {hint}
    </div>
  );
}

function FormGroup({
  title,
  children,
  invalid,
}: {
  title: string;
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <section className={cn(
      "rounded-xl border border-border/80 bg-background/70 p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]",
      invalid && "border-destructive/35 bg-destructive/[0.03]",
    )}>
      <div className={cn("mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground", invalid && "text-destructive")}>
        {title}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {children}
      </div>
    </section>
  );
}

function ChipGroup<T extends string>({ options, value, onChange, invalid }: {
  options: readonly T[];
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-md", invalid && "ring-1 ring-destructive/40")}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(value === o ? "" : o)}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] transition-colors",
            value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
