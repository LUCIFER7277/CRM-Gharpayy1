import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, FileWarning, Zap, Plus, ArrowLeft, X, Wand2, AlertCircle } from "lucide-react";
import { parseLead, detectZone, detectDirection } from "@/lib/lead-identity/parser";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { useOrgMembers, useOrgZones, useActiveTcMs, resolveMemberPrimaryZone } from "@/hooks/useOrgDirectory";
import { useAuthUser } from "@/lib/auth-store";
import { dispatch } from "@/lib/api/command-bus";
import { parseBudgetAmount } from "@/lib/quickad-shared";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadParsingService } from "@/lib/lead-identity/LeadParsingService";

type Step = "paste" | "review" | "success";
type LocalLead = { id: string; name: string; phone: string; addedAt: number };

function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border border-border/60 rounded-md p-2 bg-muted/5 shadow-sm">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-1">{title}</div>
      {children}
    </div>
  );
}

export function CompactLeadPasteParser() {
  const [step, setStep] = useState<Step>("paste");
  const [raw, setRaw] = useState("");
  
  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [areasText, setAreasText] = useState("");
  const [gender, setGender] = useState(""); // Need
  const [occupation, setOccupation] = useState(""); // Type
  const [propertyType, setPropertyType] = useState(""); // Room
  const [specialReqs, setSpecialReqs] = useState("");
  const [notes, setNotes] = useState("");
  const [zoneBucket, setZoneBucket] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const [confidenceInfo, setConfidenceInfo] = useState<{
    quality: string;
    score: number;
    found: Record<string, boolean>;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [lastSavedLead, setLastSavedLead] = useState<{name: string; phone: string; id: string; owner: string} | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<LocalLead[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const [parsingAI, setParsingAI] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [parsedByAI, setParsedByAI] = useState(false);
  const [rawSource, setRawSource] = useState("");
  const [isEditingExpanded, setIsEditingExpanded] = useState(false);

  const leads = useApp((s) => s.leads);
  const addLead = useApp((s) => s.addLead);
  const createIdentityLead = useIdentityStore((s) => s.createLead);
  const authUser = useAuthUser((s) => s.user);
  const { zones: orgZones } = useOrgZones();
  const { members: orgMembers } = useOrgMembers();
  const { tcms: activeTcms } = useActiveTcMs();

  const textRef = useRef<HTMLTextAreaElement>(null);

  const detectedZone = useMemo(
    () => detectDirection(`${areasText}`),
    [areasText],
  );

  const sortedZones = useMemo(() => orgZones.slice().sort((a, b) => a.name.localeCompare(b.name)), [orgZones]);
  const sortedMembers = useMemo(() => {
    const base = (activeTcms && activeTcms.length > 0)
      ? activeTcms.map((a: any) => ({ id: a.id, name: a.fullName ?? a.name }))
      : orgMembers.filter((m) => m.role === 'member' || m.role === 'tcm').map((m: any) => ({ id: m.id, name: m.fullName ?? m.name }));
    if (authUser && !base.find((b: any) => b.id === authUser.id)) {
      base.unshift({ id: authUser.id, name: authUser.fullName ?? authUser.name });
    }
    return base.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers, activeTcms, authUser]);

  const normalizeArea = (rawArea: string) => {
    if (!rawArea) return "";
    let normalized = rawArea;
    const lower = rawArea.toLowerCase();
     for (const z of orgZones) {
       for (const kw of (z as any).keywords || []) {
         if (kw.length >= 4 && lower.includes(kw.toLowerCase())) {
           if (kw.toLowerCase() === "electronic city" && (lower.includes("ec phase") || lower.includes("ec 1"))) {
              normalized = "Electronic City Phase 1";
           } else {
             normalized = kw.charAt(0).toUpperCase() + kw.slice(1);
           }
         }
       }
    }
    return normalized;
  };

  const handleParse = async () => {
    if (!raw || raw.trim().length < 5) {
      toast.error("Please paste some text first.");
      return;
    }
    
    setParsingAI(true);
    const parsed = await LeadParsingService.parseLead(raw, orgZones);
    setParsingAI(false);
    
    if (!parsed) return;
    
    setParsedByAI(parsed.parsedByAI);
    setRawSource(parsed.rawSource);
    setMissingFields(parsed.missing);

    const pName = parsed.fields.name || "";
    const pPhone = parsed.fields.phone || "";
    const pEmail = parsed.fields.email || "";
    let pArea = parsed.fields.area || "";
    pArea = normalizeArea(pArea);
    const pBudget = parsed.fields.budget || "";
    const pMoveIn = parsed.fields.moveIn || "";
    const pNeed = parsed.fields.need || "";
    const pType = parsed.fields.type || "";
    const pRoom = parsed.fields.room || "";
    const pSpecialReqs = parsed.fields.specialReqs || "";
    const pNotes = parsed.fields.internalNotes || "";

    setName(pName);
    setPhone(pPhone);
    setEmail(pEmail);
    setAreasText(pArea);
    setBudget(pBudget);
    setMoveIn(pMoveIn);
    setGender(pNeed);
    setOccupation(pType);
    setPropertyType(pRoom);
    setSpecialReqs(pSpecialReqs);
    setNotes(pNotes);

    // Assignment logic based on area and authUser
    const zCat = detectZone(pArea, orgZones) || "";
    setZoneBucket(zCat);
    if (authUser?.role === "member" || authUser?.role === "tcm") {
      setAssigneeId(authUser.id);
    } else {
      setAssigneeId("");
    }

    const found = {
      Name: !!pName,
      Phone: !!pPhone,
      Area: !!pArea,
      Budget: !!pBudget
    };
    const score = parsed.confidence;
    const quality = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
    
    setConfidenceInfo({ quality, score, found });
    setDuplicateWarning(null);
    setIsEditingExpanded(false); // reset expanded state for new lead
    setStep("review");
  };

  const handleDuplicateCheck = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) return null;
    
    // 1. Check local state immediately
    const existingLocal = leads.find(l => {
      const lPhone = (l.phone || "").replace(/\D/g, "");
      return lPhone && lPhone.endsWith(cleanPhone.slice(-10));
    });

    if (existingLocal) {
      const assignee = [...orgMembers, ...(activeTcms || [])].find(m => m.id === existingLocal.assignedTcmId || m.id === existingLocal.assigneeId);
      return {
        id: existingLocal.id,
        name: existingLocal.name || "Unknown",
        stage: existingLocal.stageLabel || existingLocal.stage || "new",
        owner: assignee?.name || "Unassigned"
      };
    }

    // 2. Check Backend
    try {
      const data = await api.leads.checkDuplicate(cleanPhone);
      if (data.exists) {
        return {
          id: data.leadId,
          name: data.name || "Unknown",
          stage: data.currentStage || "new",
          owner: data.owner || "Unassigned"
        };
      }
    } catch (err) {
      console.warn("Failed backend duplicate check", err);
    }
    
    return null;
  };

  const handleSave = async (forceSave = false) => {
    if (saving) return;

    if (!name.trim() || !phone.trim()) {
      toast.error("Name and Phone are required.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error("Valid 10-digit phone is required.");
      return;
    }

    setSaving(true);
    if (!forceSave) {
      const dup = await handleDuplicateCheck();
      if (dup) {
        setDuplicateWarning(dup);
        setSaving(false);
        return;
      }
    }

    try {
      const areasArr = areasText.split(",").map(a => a.trim()).filter(Boolean);
      const budgetNum = parseBudgetAmount(budget);
      
      const selectedAssignee = [...orgMembers, ...(activeTcms||[])].find((m:any) => m.id === assigneeId);
      const zoneObj = orgZones.find(z => z.name === zoneBucket);

      const payload = {
        name: name.trim(),
        phone: `+91${cleanPhone}`,
        email: email.trim(),
        source: "WhatsApp PiP",
        budget: budgetNum,
        budgetText: budget.trim(),
        moveInDate: moveIn,
        preferredArea: areasArr[0] || areasText.trim(),
        areas: areasArr,
        type: occupation,
        room: propertyType,
        need: gender,
        specialReqs: specialReqs.trim(),
        notes: notes.trim(),
        zoneId: zoneObj?.id || null,
        zoneCategory: zoneBucket,
        assigneeId: assigneeId || null,
        stageLabel: "new",
        rawSource: rawSource || raw,
        parsedByAI,
        aiConfidence: confidenceInfo?.score || 0,
        missingFields: missingFields,
      };

      const result = await dispatch({ type: "cmd.lead.create", payload });
      
      if (!result.ok) {
        toast.error(`Error saving lead: ${result.error}`);
        setSaving(false);
        return;
      }

      if ((result as any).data?.duplicate) {
        toast.error("Server rejected as duplicate.");
        setSaving(false);
        return;
      }

      const newLeadId = (result as any).data?.leadId;

      createIdentityLead({
        name: payload.name, phone: payload.phone, email: payload.email, location: payload.preferredArea, areas: payload.areas,
        budget: payload.budgetText, moveIn: payload.moveInDate, type: payload.type, room: payload.room, need: payload.need,
        specialReqs: payload.specialReqs, extraContent: payload.notes, zone: payload.zoneCategory, rawSource: `[WhatsApp PiP] ${payload.name} ${payload.phone}`,
        fullAddress: "", inBLR: null,
      }, {
        stage: "new", zoneCategory: payload.zoneCategory, assigneeId: payload.assigneeId, assigneeName: selectedAssignee?.name || null
      });

      const nowIso = new Date().toISOString();
      addLead({
        ...payload,
        id: newLeadId || `temp-${Date.now()}`,
        createdBy: authUser?.id || null,
        stage: "new",
        intent: "warm",
        confidence: 50,
        tags: [],
        nextFollowUpAt: null,
        responseSpeedMins: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        fullAddress: "",
        inBLR: null,
        quality: "good",
        assignedTcmId: assigneeId || "",
      });

      setLastSavedLead({
        name: payload.name,
        phone: payload.phone,
        id: newLeadId || "temp-id",
        owner: selectedAssignee?.name || "Unassigned"
      });

      setRecentlyAdded(prev => [{id: newLeadId||String(Date.now()), name: payload.name, phone: payload.phone, addedAt: Date.now()}, ...prev].slice(0, 5));
      setStep("success");

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnother = () => {
    setRaw("");
    setName(""); setPhone(""); setEmail(""); setAreasText(""); setBudget(""); setMoveIn("");
    setGender(""); setOccupation(""); setPropertyType(""); setSpecialReqs(""); setNotes("");
    setZoneBucket(""); setAssigneeId(authUser?.role === "member" || authUser?.role === "tcm" ? authUser.id : "");
    setConfidenceInfo(null);
    setDuplicateWarning(null);
    setIsEditingExpanded(false);
    setStep("paste");
    setTimeout(() => textRef.current?.focus(), 100);
  };

  const appendNote = (noteText: string) => {
    setNotes(prev => prev ? `${prev}\n${noteText}` : noteText);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (step === "paste") {
          e.preventDefault();
          handleParse();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        if (step === "review") {
          e.preventDefault();
          handleSave();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        if (step === "success") {
          e.preventDefault();
          handleAddAnother();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, raw, name, phone, areasText, budget, gender, occupation, propertyType, notes, duplicateWarning, saving, email, moveIn, specialReqs, zoneBucket, assigneeId]);

  const QuickNoteChip = ({ label }: { label: string }) => (
    <button
      onClick={() => appendNote(label)}
      className="text-[10px] bg-background hover:bg-primary hover:text-primary-foreground border border-border rounded-full px-2 py-0.5 transition-colors whitespace-nowrap shrink-0"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background text-foreground overflow-hidden pip-compact text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0 shadow-sm">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">WhatsApp Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 relative scrollbar-thin">
        {step === "paste" && (
          <div className="flex flex-col h-full gap-2 animate-in fade-in zoom-in-95 duration-200">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paste WhatsApp Chat</Label>
            <Textarea
              ref={textRef}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder="Paste lead info here..."
              className="flex-1 resize-none text-xs leading-relaxed font-mono bg-muted/20"
              autoFocus
            />
            <Button onClick={handleParse} disabled={parsingAI} className="w-full shrink-0 gap-2 font-semibold">
              {parsingAI ? (
                <><Wand2 className="h-4 w-4 animate-pulse" /> Parsing with AI...</>
              ) : (
                <><Zap className="h-4 w-4" /> Review Lead <span className="opacity-50 ml-auto font-mono text-[10px]">Ctrl+Enter</span></>
              )}
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* STICKY HEADER */}
            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-1.5 border-b mb-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setStep("paste")} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3 mr-1" /> Back
              </Button>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Review & Edit</Label>
            </div>

            {/* SCROLLABLE CENTER AREA */}
            <div className="flex-1 overflow-y-auto space-y-2.5 px-0.5 pb-2 scrollbar-thin">
              {confidenceInfo && (
                <div className={cn("rounded-md border p-2 shadow-sm text-[10px]", parsedByAI ? "border-border/80 bg-card" : "border-warning/30 bg-warning/10")}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold flex items-center gap-1">
                      {parsedByAI ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          AI Confidence: <span className={confidenceInfo.quality === "High" ? "text-success" : confidenceInfo.quality === "Medium" ? "text-warning" : "text-destructive"}>{confidenceInfo.score}%</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-warning" />
                          <span className="text-warning-foreground">AI Parsing unavailable. Regex fallback used.</span>
                        </>
                      )}
                    </span>
                  </div>
                  {missingFields.length > 0 && parsedByAI && (
                    <div className="text-[9px] text-destructive/80 font-medium mb-1.5">
                      Missing: {missingFields.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {duplicateWarning && (
              <div className="rounded-md border-2 border-destructive bg-destructive/10 p-2 shadow-sm animate-pulse">
                <div className="flex items-start gap-2">
                  <FileWarning className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-destructive">Potential Duplicate</h4>
                    <div className="text-[10px] mt-1 space-y-0.5 opacity-90 text-foreground">
                      <p>Name: <strong>{duplicateWarning.name}</strong></p>
                      <p>Stage: <strong>{duplicateWarning.stage}</strong></p>
                      <p>Owner: <strong>{duplicateWarning.owner}</strong></p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="h-7 flex-1 text-[10px] border-destructive text-destructive hover:bg-destructive/20" onClick={() => window.open(`/leads/${duplicateWarning.id}`, '_blank')}>
                    Open Existing
                  </Button>
                  <Button size="sm" className="h-7 flex-1 text-[10px] bg-destructive hover:bg-destructive/90 text-white" onClick={() => handleSave(true)} disabled={saving}>
                    {saving ? "Saving..." : "Create Anyway"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3 pb-2">
              {/* DEFAULT SUMMARY CARD */}
              <div className="bg-muted/10 border border-border/50 rounded-md p-3 space-y-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Phone</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} className={cn("h-7 text-xs transition-colors duration-200", phone.replace(/\D/g, "").length === 10 ? "text-foreground bg-background" : phone.length > 0 ? "text-destructive bg-destructive/10 border-destructive/50 font-medium" : "bg-background")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Area</Label>
                    <Input value={areasText} onChange={e => setAreasText(e.target.value)} className="h-7 text-xs bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Budget</Label>
                    <Input value={budget} onChange={e => setBudget(e.target.value)} className="h-7 text-xs bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] text-muted-foreground">Move-In</Label>
                    <Input type="date" value={moveIn} onChange={e => setMoveIn(e.target.value)} className="h-7 text-[10px] bg-background" />
                  </div>
                </div>
              </div>

              {!isEditingExpanded ? (
                <Button variant="outline" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border-dashed" onClick={() => setIsEditingExpanded(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Edit Additional Details
                </Button>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 border-t pt-2 mt-2">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Extended Details</Label>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={() => setIsEditingExpanded(false)}>Hide</Button>
                  </div>
                  
                  <FormGroup title="Contact & Basics">
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Email</Label>
                      <Input value={email} onChange={e => setEmail(e.target.value)} className="h-7 text-xs bg-background" placeholder="name@example.com" />
                    </div>
                  </FormGroup>

                  <FormGroup title="Preferences">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Need</Label>
                        <Input value={gender} onChange={e => setGender(e.target.value)} placeholder="Boys/Girls" className="h-7 text-xs bg-background" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Type</Label>
                        <Input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="Working/Student" className="h-7 text-xs bg-background" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Room</Label>
                        <Input value={propertyType} onChange={e => setPropertyType(e.target.value)} placeholder="Shared/Private" className="h-7 text-xs bg-background" />
                      </div>
                    </div>
                  </FormGroup>

                  <FormGroup title="Notes">
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Special Requirements</Label>
                      <Input value={specialReqs} onChange={e => setSpecialReqs(e.target.value)} className="h-7 text-xs bg-background" placeholder="Veg, Attached washroom..." />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Internal Notes</Label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[44px] resize-none text-xs bg-background" />
                      <div className="flex overflow-x-auto gap-1 mt-1 pb-1 scrollbar-none">
                        <QuickNoteChip label="Urgent" />
                        <QuickNoteChip label="Need Today" />
                        <QuickNoteChip label="Family Visit" />
                        <QuickNoteChip label="Premium Budget" />
                        <QuickNoteChip label="Corporate Client" />
                      </div>
                    </div>
                  </FormGroup>

                  <FormGroup title="Assignment">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Zone</Label>
                        <Select value={zoneBucket} onValueChange={setZoneBucket}>
                          <SelectTrigger className="h-7 text-xs bg-background"><SelectValue placeholder="Select zone..." /></SelectTrigger>
                          <SelectContent>
                            {sortedZones.map((z) => <SelectItem key={z.id} value={z.name}>{z.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Assigned To</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                          <SelectTrigger className="h-7 text-xs bg-background"><SelectValue placeholder="Assignee..." /></SelectTrigger>
                          <SelectContent>
                            {sortedMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </FormGroup>
                </div>
              )}
            </div>
          </div>

            {/* STICKY FOOTER */}
            {!duplicateWarning && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur z-10 pt-2 shrink-0 border-t mt-1">
                <Button onClick={() => handleSave(false)} disabled={saving} className="w-full gap-2 font-semibold shadow-sm">
                  {saving ? "Saving..." : "Save Lead"} <span className="opacity-50 ml-auto font-mono text-[10px]">Ctrl+S</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "success" && lastSavedLead && (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-14 w-14 rounded-full bg-success/20 flex items-center justify-center border border-success/30">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-lg">Lead Saved</h3>
              <p className="text-sm font-medium">{lastSavedLead.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{lastSavedLead.phone}</p>
            </div>

            <div className="w-full border rounded-lg p-3 bg-muted/20 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lead ID</span>
                <span className="font-mono">{lastSavedLead.id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-semibold text-primary">{lastSavedLead.owner}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full mt-4">
              <Button onClick={handleAddAnother} className="w-full gap-2 h-9 font-semibold">
                <Plus className="h-4 w-4" /> Add Another Lead <span className="opacity-50 ml-auto font-mono text-[10px]">Ctrl+N</span>
              </Button>
              <Button variant="outline" onClick={() => window.open(`/leads/${lastSavedLead.id}`, '_blank')} className="w-full h-9">
                Open Lead
              </Button>
            </div>
          </div>
        )}
      </div>

      {step !== "success" && (
        <div className="border-t border-border bg-muted/10 p-2 shrink-0 h-[80px]">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-1.5 px-1">Recently Added</h4>
          {recentlyAdded.length === 0 ? (
             <p className="text-[10px] text-muted-foreground/50 px-1 italic">No leads added in this session.</p>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto max-h-[50px] scrollbar-none px-1">
              {recentlyAdded.map((l, i) => (
                <div key={i} className="flex justify-between items-center text-[10px]">
                  <span className="font-medium truncate flex-1">{l.name}</span>
                  <span className="text-muted-foreground/60 font-mono text-[9px] shrink-0 ml-2">
                    {Math.floor((Date.now() - l.addedAt) / 60000)}m ago
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
