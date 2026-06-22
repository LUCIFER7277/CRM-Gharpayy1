import { useMemo, useState } from "react";
import { parseLead, detectDirection } from "@/lib/lead-identity/parser";
import { useIdentityStore } from "@/lib/lead-identity/store";
import type { MatchResult, ParsedLeadDraft, UnifiedLead } from "@/lib/lead-identity/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, Search, CheckCircle2, AlertCircle, Sparkles, MapPin, Link2 } from "lucide-react";
import { toast } from "sonner";
import { DuplicateModal } from "./DuplicateModal";
import { useOrgZones } from "@/hooks/useOrgDirectory";

interface Props {
  onCreated?: (lead: UnifiedLead) => void;
}

const emptyDraft = (): ParsedLeadDraft => ({
  name: "", phone: "", email: "", location: "", areas: [], fullAddress: "",
  budget: "", moveIn: "",
  type: "", room: "", need: "", specialReqs: "", extraContent: "", summary: "", budgets: [], links: [], inBLR: null, zone: "", rawSource: "",
});

export function PasteToLead({ onCreated }: Props) {
  const checkDuplicates = useIdentityStore((s) => s.checkDuplicates);
  const createLead = useIdentityStore((s) => s.createLead);
  const { zones: orgZones } = useOrgZones();

  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<ParsedLeadDraft>(emptyDraft());
  const [parsed, setParsed] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  const detected = useMemo(() => ({
    name: !!draft.name, phone: !!draft.phone, email: !!draft.email,
    location: !!draft.location, budget: !!draft.budget, moveIn: !!draft.moveIn,
    zone: !!draft.zone,
  }), [draft]);

  const onParse = () => {
    const p = parseLead(raw, orgZones);
    if (!p) {
      toast.error("Couldn't parse - need at least name, phone, or email.");
      return;
    }
    setDraft(p);
    setParsed(true);
    toast.success("Parsed - review fields and run duplicate check.");
  };

  const autoParse = (text: string) => {
    setRaw(text);
    const p = parseLead(text, orgZones);
    if (!p) return;
    setDraft(p);
    setParsed(true);
    toast.success("Auto-parsed paste");
  };

  const onPasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text);
      const p = parseLead(text, orgZones);
      if (p) { setDraft(p); setParsed(true); toast.success("Pasted & parsed"); }
    } catch {
      toast.error("Clipboard blocked - paste manually.");
    }
  };

  const updateField = (k: keyof ParsedLeadDraft, v: string) => {
    setDraft((d) => {
      const next = { ...d, [k]: v };
      // Re-detect zone when location/raw changes
      if (k === "location") {
        next.zone = detectDirection(`${v} ${d.rawSource}`);
      }
      return next;
    });
  };

  const onCheckAndSave = () => {
    const r = checkDuplicates(draft);
    setMatch(r);
    setShowModal(true);
  };

  const onForceCreate = () => {
    const lead = createLead(draft);
    toast.success(`Lead created · ULID ${lead.id.slice(0, 12)}…`);
    setShowModal(false);
    setRaw(""); setDraft(emptyDraft()); setParsed(false); setMatch(null);
    onCreated?.(lead);
  };

  const onUseExisting = (lead: UnifiedLead) => {
    toast.info(`Opening existing lead: ${lead.name}`);
    setShowModal(false);
    onCreated?.(lead);
  };

  const Dot = ({ on }: { on: boolean }) => (
    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${on ? "bg-primary" : "bg-muted-foreground/30"}`} />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Paste lead
            </h3>
            <p className="text-[11px] text-muted-foreground">WhatsApp form, plain text, spreadsheet row - anything works.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onPasteFromClipboard}>
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={onParse} disabled={!raw.trim()}>
              Parse
            </Button>
          </div>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => autoParse(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text) return;
            e.preventDefault();
            autoParse(text);
          }}
          placeholder={`Paste anything…\n\n📝 GHARPAYY FORM\nName: Rahul Sharma\nPhone: 9876543210\nLocation: Koramangala\nBudget: 8-12k\nMove-in: 1 May`}
          className="min-h-32 font-mono text-xs"
        />
      </div>

      {parsed && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-sm">Review parsed fields</h3>
            {draft.zone && <Badge variant="secondary" className="text-[10px]">Zone · {draft.zone}</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]"><Dot on={detected.name} />Name</Label>
              <Input value={draft.name} onChange={(e) => updateField("name", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]"><Dot on={detected.phone} />Phone</Label>
              <Input value={draft.phone} onChange={(e) => updateField("phone", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]"><Dot on={detected.email} />Email</Label>
              <Input value={draft.email} onChange={(e) => updateField("email", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]"><Dot on={detected.location} />Location / Area</Label>
              <Input value={draft.location} onChange={(e) => updateField("location", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]"><Dot on={detected.budget} />Budget</Label>
              <Input value={draft.budget} onChange={(e) => updateField("budget", e.target.value)} className="h-9 text-sm" placeholder="e.g. 8-12k" />
            </div>
            <div>
              <Label className="text-[11px]"><Dot on={detected.moveIn} />Move-in</Label>
              <Input value={draft.moveIn} onChange={(e) => updateField("moveIn", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-[11px]">Type</Label>
              <Input value={draft.type} onChange={(e) => updateField("type", e.target.value)} className="h-9 text-sm" placeholder="Student / Working" />
            </div>
            <div>
              <Label className="text-[11px]">Room</Label>
              <Input value={draft.room} onChange={(e) => updateField("room", e.target.value)} className="h-9 text-sm" placeholder="Private / Shared / Both" />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Geo-intelligence</div>
              {draft.geoIntel && <Badge variant="outline" className="text-[10px]">{draft.geoIntel.confidence} · {draft.geoIntel.syncStatus}</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground">{draft.geoIntel?.distanceHint || "Paste location or map link to prepare distance sync."}</p>
            {!!draft.links?.length && <div className="space-y-1">{draft.links.map((link) => <div key={link} className="text-[11px] text-primary truncate flex items-center gap-1"><Link2 className="h-3 w-3 shrink-0" />{link}</div>)}</div>}
          </div>

          <div>
            <Label className="text-[11px]">Extra content kept with lead</Label>
            <Textarea value={draft.extraContent ?? ""} onChange={(e) => updateField("extraContent", e.target.value)} className="min-h-20 text-xs" />
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            {Object.values(detected).filter(Boolean).length >= 3 ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Enough signals to dedup safely</>
            ) : (
              <><AlertCircle className="h-3.5 w-3.5 text-warning" /> Add more fields for stronger dedup confidence</>
            )}
          </div>

          <Button onClick={onCheckAndSave} className="w-full h-10 gap-2" disabled={!draft.name && !draft.phone && !draft.email}>
            <Search className="h-4 w-4" /> Check duplicates & save
          </Button>
        </div>
      )}

      <DuplicateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        result={match}
        onForceCreate={onForceCreate}
        onUseExisting={onUseExisting}
      />
    </div>
  );
}
