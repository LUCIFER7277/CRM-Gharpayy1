// Quick Add Lead - full lead schema in a single floating panel.
// Designed for the "WhatsApp + PiP dashboard" workflow:
//  • Paste an entire WhatsApp message into ANY field → auto-parse every column
//  • Manual edit any auto-filled field
//  • Save + Next keeps panel open for rapid one-handed entry
//  • ⌘/Ctrl+Enter saves and closes
//  • Works identically inside the PiP window and the main tab
//
// Captures: Name · Phone · Email · Areas (multi) · Full Address · Budget ·
// Move-in · Type · Room · Need · Special Reqs · In-BLR · Lead Quality ·
// Zone (categorical) · Assign Member · Lead Stage · Notes
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { detectZone, parseLead, detectDirection } from "@/lib/lead-identity/parser";
import { memberOptionLabel, resolveMemberPrimaryZone, useOrgMembers, useOrgZones, useActiveTcMs } from "@/hooks/useOrgDirectory";
import { useAuthUser } from "@/lib/auth-store";
import { dispatch } from "@/lib/api/command-bus";
import { toast } from "sonner";
import { Save, Repeat2, Phone, MapPin, Sparkles, X, CalendarPlus, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { bestInventoryFits, detectAreaZone, recommendedFlowOps, recommendedTcm } from "@/myt/lib/inventory-intelligence";
import { QUICKAD_NEED_OPTIONS, QUICKAD_ROOM_OPTIONS, QUICKAD_TYPE_OPTIONS, parseBudgetAmount } from "@/lib/quickad-shared";
import type { ParsedLeadDraft } from "@/lib/lead-identity/types";
import { PGS } from "@/property-genius/data/pgs";
import { searchPGs } from "@/property-genius/lib/search";
import type { PG } from "@/property-genius/data/types";
import { formatINR } from "@/lib/utils";

interface Props { open: boolean; onClose: () => void; }

const todayIso = () => new Date().toISOString().slice(0, 10);


import { useApp } from "@/lib/store";
import type { LeadStage, Intent } from "@/lib/types";

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

const TYPE_OPTS = QUICKAD_TYPE_OPTIONS;
const ROOM_OPTS = QUICKAD_ROOM_OPTIONS;
const NEED_OPTS = QUICKAD_NEED_OPTIONS;
const QUALITY_OPTS = [
  { v: "hot" as const, label: "🔥 Hot" },
  { v: "good" as const, label: "✅ Good" },
  { v: "bad" as const, label: "❌ Bad" },
];
const BLR_OPTS = [
  { v: true as const, label: "🏙 In" },
  { v: false as const, label: "✈️ Out" },
  { v: null, label: "❓ Unknown" },
];

export function QuickAddLeadPanel({ open, onClose }: Props) {
  const checkDup = useIdentityStore((s) => s.checkDuplicates);
  const create = useIdentityStore((s) => s.createLead);
  const { rooms, blocks, tours } = useAppState();
  const navigate = useNavigate();
  const addLead = useApp((s) => s.addLead);
  const { members: orgMembers } = useOrgMembers();
  const { tcms: activeTcms } = useActiveTcMs();
  const { zones: orgZones } = useOrgZones();

  const authUser = useAuthUser((s) => s.user);
  const sortedZones = useMemo(() => orgZones.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgZones]);
  const sortedMembers = useMemo(() => {
    const base = (activeTcms && activeTcms.length > 0)
      ? activeTcms.map((a: any) => ({ id: a.id, name: a.fullName ?? a.name, role: a.role ?? 'tcm', zones: a.zones ?? (a.zone ? [a.zone] : []) }))
      : orgMembers.filter((m) => m.role === 'member' || m.role === 'tcm').map((m: any) => ({ id: m.id, name: m.fullName ?? m.name, role: m.role, zones: m.zones ?? (m.zone ? [m.zone] : []) }));
    // Ensure current user appears in the assignee list so they can assign to themselves
    if (authUser && !base.find((b: any) => b.id === authUser.id)) {
      base.unshift({ id: authUser.id, name: authUser.fullName ?? authUser.name, role: authUser.role ?? 'member', zones: (authUser as any).zones ?? ((authUser as any).zone ? [(authUser as any).zone] : []) });
    }
    return base.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, activeTcms, authUser]);
  const sortedStages = useMemo(() => Array.from(STAGES).slice().sort((a, b) => a.localeCompare(b)), []);

  // Core
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [areasText, setAreasText] = useState("");        // comma-separated areas
  const [selectedPG, setSelectedPG] = useState<PG | null>(null);
  const [hubQuery, setHubQuery] = useState("");
  const [showHubResults, setShowHubResults] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [otherPropertyName, setOtherPropertyName] = useState("");
  const [propertySelection, setPropertySelection] = useState<ParsedLeadDraft["propertySelection"] | undefined>();
  const [fullAddress, setFullAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [type, setType] = useState("");
  const [room, setRoom] = useState("");
  const [need, setNeed] = useState("");
  const [specialReqs, setSpecialReqs] = useState("");
  // Editorial
  const [inBLR, setInBLR] = useState<boolean | null | undefined>(undefined);
  const [quality, setQuality] = useState<"hot" | "good" | "bad" | null>(null);
  const [zoneBucket, setZoneBucket] = useState<string>("");
  // Default to the current member when a regular member is adding a lead
  const defaultAssigneeId = authUser?.role === "member" || authUser?.role === "tcm" ? authUser.id : "";
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId);
  const [stage, setStage] = useState<string>(STAGES[0]);
  const [notes, setNotes] = useState("");
  const [lastParsed, setLastParsed] = useState<ParsedLeadDraft | null>(null);

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

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => nameRef.current?.focus(), 50); }, [open]);

  const hubResults = useMemo(() => {
    const q = hubQuery.trim();
    if (!q && selectedPG) return [];
    if (q) return searchPGs(q, 10);
    if (areasText) {
      const byArea = PGS.filter((p) =>
        p.area.toLowerCase().includes(areasText.toLowerCase()) ||
        areasText.toLowerCase().includes(p.area.toLowerCase()),
      );
      return byArea.slice(0, 10).map((pg) => ({ pg, score: 1, matched: [] }));
    }
    return [...PGS].sort((a, b) => b.iq - a.iq).slice(0, 10).map((pg) => ({ pg, score: 1, matched: [] }));
  }, [hubQuery, selectedPG, areasText]);

  const detectedZone = useMemo(
    () => detectDirection(`${areasText} ${fullAddress}`),
    [areasText, fullAddress],
  );
  const areaFit = useMemo(() => {
    const areaText = `${areasText} ${fullAddress}`.trim();
    if (!areaText) return null;
    const budgetNum = parseBudgetAmount(budget);
    const zone = detectAreaZone(areaText);
    const fits = bestInventoryFits({ areaText, budget: budgetNum, room, rooms, blocks, limit: 3 });
    return { zone, fits, flowOps: recommendedFlowOps(zone.id), tcm: recommendedTcm(tours, zone.id) };
  }, [areasText, fullAddress, budget, room, rooms, blocks, tours]);

  const reset = () => {
    setName(""); setPhone(""); setEmail("");
    setAreasText(""); setFullAddress(""); setSelectedPG(null); setHubQuery("");
    setBudget(""); setMoveIn("");
    setType(""); setRoom(""); setNeed(""); setSpecialReqs("");
    setInBLR(null); setQuality(null); setZoneBucket("");
    setAssigneeId(defaultAssigneeId); setStage(STAGES[0]); setNotes("");
    setLastParsed(null); setPropertySelection(undefined); setOtherPropertyName("");
    setTimeout(() => nameRef.current?.focus(), 30);
  };

  const buildScheduleLead = (source?: ParsedLeadDraft | null) => ({
    name: source?.name || name,
    phone: source?.phone || phone,
    email: source?.email || email,
    location: source?.location || areasText,
    area: source?.areas?.length ? source.areas.join(", ") : source?.location || areasText,
    areas: source?.areas?.length ? source.areas : areasText.split(",").map((a) => a.trim()).filter(Boolean),
    fullAddress: source?.fullAddress || fullAddress,
    budget: source?.budget || budget,
    moveInDate: source?.moveIn || moveIn,
    room: source?.room || room,
    type: source?.type || type,
    need: source?.need || need,
    specialReqs: source?.specialReqs || specialReqs,
    extraContent: source?.extraContent || notes || specialReqs,
    links: source?.links ?? (fullAddress.match(/https?:\/\/\S+/g) ?? []),
    geoIntel: source?.geoIntel,
    rawSource: source?.rawSource,
  });

  const scheduleExisting = (lead: ReturnType<typeof checkDup>["candidates"][number]["lead"], parsedOverride?: ParsedLeadDraft | null) => {
    onClose();
    navigate("/myt/schedule", { state: { lead, pastedLead: buildScheduleLead(parsedOverride ?? lastParsed), inventoryFit: areaFit?.fits[0] } });
    toast.info(`Scheduling tour for ${lead.name}`);
  };

  const scheduleDraft = () => {
    if (!name.trim() || !phone.trim()) { toast.error("Need name and phone before scheduling"); return; }
    const dup = checkDup({ name, phone, email, location: areasText });
    const existing = dup.candidates[0]?.lead;
    if (existing && (dup.type === "exact" || dup.type === "strong")) {
      scheduleExisting(existing);
      return;
    }
    onClose();
    navigate("/myt/schedule", {
      state: {
        lead: buildScheduleLead(lastParsed),
        inventoryFit: areaFit?.fits[0],
      },
    });
  };

  const save = async (keepOpen: boolean) => {
    const phoneClean = phone.replace(/\D/g, "");
    const missing: string[] = [];
    if (!name.trim()) missing.push("Name");
    if (!phoneClean.match(/^[6-9]\d{9}$/)) missing.push("Valid 10-digit phone");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.push("Valid email");
    if (!areasText.trim()) missing.push("Areas");
    if (!budget.trim()) missing.push("Budget");
    if (!moveIn) missing.push("Move-in date");
    if (!type) missing.push("Type");
    if (!room) missing.push("Room");
    if (!need) missing.push("Need");
    if (inBLR === undefined) missing.push("In Bangalore?");
    if (!quality) missing.push("Lead Quality");
    if (!zoneBucket) missing.push("Zone");
    if (!assigneeId) missing.push("Assigned member");
    if (!stage) missing.push("Lead stage");
    if (missing.length) {
      toast.error(`Fill all required fields: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
      return;
    }
    const dup = checkDup({ name, phone, email, location: areasText });
    if (dup.type === "exact" || dup.type === "strong") {
      const existing = dup.candidates[0]?.lead;
      toast.warning(`Duplicate detected: ${existing?.name}`, {
        action: existing
          ? { label: "Schedule tour", onClick: () => scheduleExisting(existing) }
          : undefined,
      });
    }
    const areasArr = areasText.split(",").map((a) => a.trim()).filter(Boolean);
    const assignee = sortedMembers.find((m: any) => m.id === assigneeId)
      ?? orgMembers.find((m) => m.id === assigneeId)
      ?? (activeTcms || []).find((a: any) => a.id === assigneeId);
    const zoneObj = orgZones.find((z) => z.name === zoneBucket);
    const budgetNum = parseBudgetAmount(budget);

    // Dispatch to backend (Mongo). Server validates, dedups by phone, and
    // emits evt.lead.created → useLiveLeads picks it up everywhere.
    const result = await dispatch({
      type: "cmd.lead.create",
      payload: {
        name: name.trim(),
        phone: `+91${phoneClean}`,
        source: "quick-add",
        budget: budgetNum,
        budgetText: budget.trim(),
        moveInDate: moveIn,
        preferredArea: areasArr[0] ?? areasText.trim(),
        zoneId: zoneObj?.id ?? null,
        email: email.trim(),
        areas: areasArr,
        fullAddress: fullAddress.trim(),
        type, room, need,
        inBLR: inBLR === undefined ? null : inBLR,
        quality,
        specialReqs: specialReqs.trim(),
        notes: notes.trim(),
        zoneCategory: zoneBucket,
        assigneeId: assignee?.id ?? null,
        stageLabel: stage,
        propertySelection,
      },
    });
    if (!result.ok) {
      toast.error(`Could not save: ${result.error}`);
      return;
    }

    const isServerDuplicate = Boolean((result as any).data?.duplicate);
    if (isServerDuplicate) {
      const existingLeadId = (result as any).data?.leadId;
      toast.warning(`Lead already exists${existingLeadId ? ` (ID: ${existingLeadId})` : ""}. No new lead was created.`);
      if (!keepOpen) onClose();
      return;
    }
    
    const newLeadId = (result as any).data?.leadId;

    // Mirror into the local identity store so dedup hints stay current
    // for the rest of this session.
    const identityLead = create(
      {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
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
        rawSource: `[QuickAdd] ${name} ${phone}`,
      },
      {
        quality,
        stage,
        zoneCategory: zoneBucket,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? null,
      },
    );

    // Optimistically add to the main app store for immediate visibility
    const now = new Date().toISOString();
    addLead({
      id: newLeadId || identityLead.id,
      name: name.trim(),
      phone: `+91${phoneClean}`,
      source: "quick-add",
      budget: budgetNum,
      budgetText: budget.trim(),
      moveInDate: moveIn,
      preferredArea: areasArr[0] ?? areasText.trim(),
      assignedTcmId: assignee?.id ?? "",
      stage: "new",
      intent: (quality === "hot" ? "hot" : quality === "bad" ? "cold" : "warm") as Intent,
      confidence: quality === "hot" ? 90 : quality === "good" ? 70 : quality === "bad" ? 30 : 50,
      tags: [],
      nextFollowUpAt: null,
      responseSpeedMins: 0,
      createdAt: now,
      updatedAt: now,
      email: email.trim(),
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

    toast.success(`Lead saved · ${name.trim()}`);
    if (keepOpen) reset(); else onClose();
  };

  // Paste WhatsApp message into ANY input → auto-fill everything we can
  const onAnyPaste = (e: React.ClipboardEvent) => {
    const txt = e.clipboardData.getData("text");
    if (!txt || txt.length < 30) return;
    const parsed = parseLead(txt, orgZones);
    if (!parsed) return;
    e.preventDefault();
    setLastParsed(parsed);
    setSelectedPG(null);
    setPropertySelection(undefined);
    if (parsed.name) setName(parsed.name);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.areas?.length) setAreasText(parsed.areas.join(", "));
    else if (parsed.location) setAreasText(parsed.location);
    if (parsed.fullAddress) setFullAddress(parsed.fullAddress);
    if (parsed.budget) setBudget(parsed.budget);
    if (parsed.moveIn && /^\d{4}-\d{2}-\d{2}$/.test(parsed.moveIn)) setMoveIn(parsed.moveIn);
    if (parsed.type) setType(parsed.type);
    if (parsed.room) setRoom(parsed.room);
    if (parsed.need) setNeed(parsed.need.split(" / ")[0] ?? parsed.need);
    if (parsed.specialReqs) setSpecialReqs(parsed.specialReqs);
    if (parsed.inBLR !== null) setInBLR(parsed.inBLR);
    const dup = checkDup({ name: parsed.name, phone: parsed.phone, email: parsed.email, location: parsed.areas?.join(", ") || parsed.location });
    const existing = dup.candidates[0]?.lead;
    if (existing && (dup.type === "exact" || dup.type === "strong")) {
      toast.warning(`Existing lead found: ${existing.name}`, {
        action: { label: "Open Tour", onClick: () => scheduleExisting(existing, parsed) },
      });
      return;
    }
    toast.success("Auto-filled from paste · Tour action is ready");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(false); }
        }}
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Quick Add Lead
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">
            Paste a WhatsApp message into <strong>any</strong> field → auto-fills every column ·
            ⌘/Ctrl + Enter saves
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" onPaste={onAnyPaste}>
          {areaFit && (
            <div className="rounded-md border border-primary/25 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Area Inventory Fit</div>
          <div className="text-sm font-semibold text-foreground">{areaFit.zone.areas[0] || ''} · {areaFit.fits[0]?.availableBeds ?? 0} Supply Hub beds live</div>
                </div>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={scheduleDraft} disabled={!areaFit.fits[0]}>
                  <CalendarPlus className="h-3 w-3 mr-1" /> Best Tour
                </Button>
              </div>
              <div className="grid gap-1.5">
                {areaFit.fits.slice(0, 2).map((fit, i) => (
                  <div key={fit.propertyId} className="rounded border border-border bg-background/70 px-2 py-1.5 text-[11px] flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{i === 0 ? 'Best' : 'Normal'} · {fit.propertyName}</span>
                    <span className="text-muted-foreground shrink-0">{fit.availableBeds} beds · {fit.distanceKm !== null ? `${fit.distanceKm} km` : fit.area} · ₹{(fit.basePrice / 1000).toFixed(0)}k · {fit.score}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Flow Ops: {areaFit.flowOps?.name ?? 'Auto'} · TCM: {areaFit.tcm?.name ?? 'Auto'} · {areaFit.fits[0]?.reason ?? 'No matching inventory yet'}
              </div>
            </div>
          )}

          {/* Name + Phone */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="👤 Name *">
              <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" />
            </Field>
            <Field label="📱 Phone *">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" className={cn("transition-colors duration-200", phone.replace(/\D/g, "").length === 10 ? "text-foreground bg-background" : phone.length > 0 ? "text-destructive bg-destructive/10 border-destructive/50 font-medium" : "")} />
            </Field>
          </div>

          <Field label="✉️ Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" inputMode="email" />
          </Field>

          {/* Property Hub */}
          <Field label="📍 Preferred Property (from Property Hub)">
            <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setShowHubResults(false), 200); }}>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={selectedPG ? selectedPG.name : hubQuery}
                  onChange={(e) => {
                    setHubQuery(e.target.value);
                    setShowHubResults(true);
                    if (selectedPG) {
                      setSelectedPG(null);
                      setAreasText("");
                      setPropertySelection(undefined);
                    }
                  }}
                  onFocus={() => setShowHubResults(true)}
                  placeholder="Search Property Hub — name, area, landmark…"
                  className="pl-7"
                />
                {detectedZone && !selectedPG && (
                  <Badge variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]">
                    {detectedZone}
                  </Badge>
                )}
              </div>
              {selectedPG && (
                <div className="mt-1.5 rounded-md border border-primary/40 bg-primary/5 p-2">
                  <div className="text-xs font-semibold">{selectedPG.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {selectedPG.area} · {selectedPG.gender} · IQ {selectedPG.iq}
                  </div>
                </div>
              )}
              {showHubResults && !selectedPG && propertySelection?.type !== "other" && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-56 flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {hubResults.map(({ pg }) => (
                      <button
                        key={pg.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedPG(pg);
                          setAreasText(pg.area);
                          setPropertySelection({ type: "hub", propertyId: pg.id, propertyName: pg.name });
                          setHubQuery("");
                          setShowHubResults(false);
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border last:border-0"
                      >
                        <Building2 className="h-3 w-3 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{pg.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
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
              {propertySelection?.type === "other" && propertySelection.propertyName && (
                <div className="mt-1.5 rounded-md border border-primary/40 bg-primary/5 p-2 flex justify-between items-center">
                  <div className="text-sm font-semibold">Other: {propertySelection.propertyName}</div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { 
                    e.preventDefault();
                    setOtherPropertyName(propertySelection?.propertyName || "");
                    setShowOtherModal(true);
                  }}>Change</Button>
                </div>
              )}
            </div>
          </Field>

          {/* Full Address */}
          <Field label="🏠 Full Address / Map link">
            <Textarea
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              rows={2}
              placeholder="Door no, street, landmark or Google Maps URL"
              className="resize-none"
            />
          </Field>

          {/* Budget + Move-in */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="💰 Budget">
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="8-12k" />
            </Field>
            <Field label="📅 Move-in">
              <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            </Field>
          </div>

          {/* Type + Room + Need (chips) */}
          <Field label="💼 Type">
            <ChipGroup options={TYPE_OPTS} value={type} onChange={setType} />
          </Field>
          <Field label="🛏 Room">
            <ChipGroup options={ROOM_OPTS} value={room} onChange={setRoom} />
          </Field>
          <Field label="👥 Need">
            <ChipGroup options={NEED_OPTS} value={need} onChange={setNeed} />
          </Field>

          {/* Special requests */}
          <Field label="⭐ Special Requests">
            <Textarea
              value={specialReqs}
              onChange={(e) => setSpecialReqs(e.target.value)}
              rows={2}
              placeholder="Veg only · attached washroom · top floor…"
              className="resize-none"
            />
          </Field>

          {/* In-BLR */}
          <Field label="Currently in Bangalore?">
            <ChipGroup
              options={BLR_OPTS.map((o) => o.label)}
              value={BLR_OPTS.find((o) => o.v === inBLR)?.label ?? ""}
              onChange={(label) => {
                const opt = BLR_OPTS.find((o) => o.label === label);
                if (opt !== undefined) setInBLR(opt.v);
              }}
            />
          </Field>

          {/* Quality */}
          <Field label="Lead Quality">
            <ChipGroup
              options={QUALITY_OPTS.map((o) => o.label)}
              value={QUALITY_OPTS.find((o) => o.v === quality)?.label ?? ""}
              onChange={(label) => setQuality(QUALITY_OPTS.find((o) => o.label === label)?.v ?? null)}
            />
          </Field>

          {/* Zone */}
          <Field label="Zone *">
            <Select value={zoneBucket} onValueChange={(v) => setZoneBucket(v)}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder={orgZones.length ? "Select zone…" : "No zones configured"} />
              </SelectTrigger>
              <SelectContent>
                {sortedZones.map((z) => (
                  <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Assignee */}
          <Field label="Assign Member *">
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v)}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder={orgMembers.length ? "Select member…" : "No members yet"} />
              </SelectTrigger>
              <SelectContent>
                {sortedMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{memberOptionLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Stage */}
          <Field label="Lead Stage">
            <Select value={stage} onValueChange={(v) => setStage(v)}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder="Select stage…" />
              </SelectTrigger>
              <SelectContent>
                {sortedStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* Notes */}
          <Field label="📝 Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Free notes…"
              className="resize-none"
            />
          </Field>
        </div>

        <div className="border-t border-border px-5 py-3 flex flex-col gap-2 bg-background">
          <div className="flex gap-2">
            <Button onClick={() => save(true)} variant="outline" size="sm" className="flex-1 gap-1.5">
              <Repeat2 className="h-3.5 w-3.5" /> Save + Next
            </Button>
            <Button onClick={() => save(false)} size="sm" className="flex-1 gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const dup = checkDup({ name, phone, email, location: areasText });
                const existing = dup.candidates[0]?.lead;
                if (existing) scheduleExisting(existing);
                else scheduleDraft();
              }}
              className="gap-1.5"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Tour
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Tip: paste a WhatsApp message anywhere → all fields auto-fill · ⌘/Ctrl + Enter to save
          </p>
        </div>
      </SheetContent>

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
              setPropertySelection({ type: "other", propertyName: cleanName });
              setShowOtherModal(false);
            }}>Save Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ChipGroup({ options, value, onChange }: {
  options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          className={cn(
            "px-2 py-1 text-[11px] rounded-md border transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
