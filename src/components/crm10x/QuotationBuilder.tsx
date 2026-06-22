import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { Lead } from "@/lib/types";
import type { PG } from "@/property-genius/data/types";
import { PropertyHubPicker, pgQuoteDefaults } from "@/property-genius/components/PropertyHubPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, FileText, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  renderQuotationMessage,
  formatINR,
  type Quotation,
  type QuotationStatus,
  useQuotationsQuery,
  useAddQuotation,
  useSetQuotationStatus,
} from "@/lib/crm10x/quotations";

const ROOM_TYPES = ["Shared", "Private", "Double Sharing", "Triple Sharing"];
const QUICK_VALIDITY = [
  { v: 15, label: "15 min" },
  { v: 20, label: "20 min" },
  { v: 30, label: "30 min" },
  { v: 60, label: "1 hr" },
  { v: 120, label: "2 hr" },
  { v: 360, label: "6 hr" },
  { v: 720, label: "12 hr" },
];

const STATUS_TONE: Record<QuotationStatus, string> = {
  sent: "bg-accent/15 text-accent border-accent/30",
  paid: "bg-success/15 text-success border-success/30",
  "not-paid": "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

type Props = {
  lead: Lead;
  /** When true, form is shown inline (Impact Queue dialog) — no nested New quote dialog */
  embedded?: boolean;
  onSent?: (quote?: Quotation) => void;
  onPaid?: () => void;
  /** Pre-fill from owner booking form — skips property re-selection */
  initialPg?: PG;
  initialRoomType?: string;
  initialActualRent?: number;
  initialDeposit?: number;
  initialRoomNumber?: string;
  initialLockIn?: string;
  initialNotice?: string;
  initialPrebook?: number;
};

export function QuotationBuilder({ lead, embedded, onSent, onPaid,
  initialPg, initialRoomType, initialActualRent, initialDeposit, initialRoomNumber, initialLockIn, initialNotice, initialPrebook,
}: Props) {
  const setLeadStage = useApp((s) => s.setLeadStage);
  const { mutate: add } = useAddQuotation();
  const { data: leadQuotes = [], isLoading } = useQuotationsQuery(lead.id);
  const { mutate: setStatus } = useSetQuotationStatus();

  const [open, setOpen] = useState(false);
  const [selectedPg, setSelectedPg] = useState<PG | null>(initialPg ?? null);

  const [roomType, setRoomType] = useState(initialRoomType ?? "Shared");
  const [roomNumber, setRoomNumber] = useState(initialRoomNumber ?? "");
  const [actualRent, setActualRent] = useState<number>(initialActualRent ?? 15000);
  const [discounted, setDiscounted] = useState<number>(initialActualRent ?? 12000);
  const [deposit, setDeposit] = useState<number>(initialDeposit ?? 5000);
  const [prebook, setPrebook] = useState<number>(initialPrebook ?? 5000);
  const [maintenance, setMaintenance] = useState<number>(3000);
  const [maintenanceType, setMaintenanceType] = useState<"One-Time" | "Monthly">("One-Time");
  const [lockIn, setLockIn] = useState(initialLockIn ?? "3 Months");
  const [notice, setNotice] = useState(initialNotice ?? "30 Days");
  const [validityMin, setValidityMin] = useState<number>(20);

  const applyPg = (pg: PG) => {
    const d = pgQuoteDefaults(pg);
    setSelectedPg(pg);
    setRoomType(d.roomType);
    setActualRent(d.actualRent);
    setDiscounted(d.discounted);
    setDeposit(d.deposit);
    setPrebook(Math.min(d.deposit, d.discounted));
    setLockIn(d.lockIn);
  };

  const clearPg = () => setSelectedPg(null);

  const resolvedPropertyName = selectedPg?.name ?? "";
  const validUntilISO = useMemo(
    () => new Date(Date.now() + validityMin * 60_000).toISOString(),
    [validityMin],
  );

  const draft = {
    propertyName: resolvedPropertyName || "[Property Name]",
    roomType,
    roomNumber: roomNumber.trim() || undefined,
    actualRent,
    discountedPrice: discounted,
    deposit,
    prebook,
    maintenance,
    maintenanceType,
    lockIn,
    notice,
    validUntilISO,
  };

  const message = renderQuotationMessage(draft);
  const canSend = resolvedPropertyName.length > 0 && discounted > 0;

  const handleCopy = async (text = message) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleSend = () => {
    if (!canSend) {
      toast.error("Select a property from Property Hub and set a discounted price");
      return;
    }
    add({
      leadId: lead.id,
      tcmId: lead.assignedTcmId || "tcm-current",
      propertyId: selectedPg?.id,
      propertyName: resolvedPropertyName,
      roomType,
      roomNumber: roomNumber.trim() || undefined,
      actualRent,
      discountedPrice: discounted,
      deposit,
      prebook,
      maintenance,
      maintenanceType,
      lockIn,
      notice,
      validityMinutes: validityMin,
      validUntilISO,
      message,
    }, {
      onSuccess: (quote) => {
        void setLeadStage(lead.id, "quote-sent");
        void navigator.clipboard.writeText(message);
        if (quote) toast.success(`Quotation copied · ${formatINR(quote.discountedPrice)}`);
        if (embedded) onSent?.(quote);
        else setOpen(false);
      },
      onError: () => {
        toast.error("Failed to save quotation");
      },
    });
  };

  const form = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-3 space-y-2">
          <PropertyHubPicker
            selected={selectedPg}
            onSelect={applyPg}
            onClear={clearPg}
            preferredArea={lead.preferredArea}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Room type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Room # (optional)</Label>
            <Input
              className="h-8 text-xs"
              placeholder="504"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Actual rent</Label>
            <Input type="number" className="h-8 text-xs" value={actualRent}
              onChange={(e) => setActualRent(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Discounted</Label>
            <Input type="number" className="h-8 text-xs" value={discounted}
              onChange={(e) => setDiscounted(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Deposit</Label>
            <Input type="number" className="h-8 text-xs" value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Prebook</Label>
            <Input type="number" className="h-8 text-xs" value={prebook}
              onChange={(e) => setPrebook(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Maintenance</Label>
            <Input type="number" className="h-8 text-xs" value={maintenance}
              onChange={(e) => setMaintenance(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Type</Label>
            <Select value={maintenanceType} onValueChange={(v) => setMaintenanceType(v as "One-Time" | "Monthly")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="One-Time" className="text-xs">One-Time</SelectItem>
                <SelectItem value="Monthly" className="text-xs">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Lock-in</Label>
            <Input className="h-8 text-xs" value={lockIn} onChange={(e) => setLockIn(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Notice</Label>
            <Input className="h-8 text-xs" value={notice} onChange={(e) => setNotice(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Offer valid for</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {QUICK_VALIDITY.map((q) => (
              <button
                key={q.v}
                type="button"
                onClick={() => setValidityMin(q.v)}
                className={`text-[11px] px-2 py-1 rounded border ${
                  validityMin === q.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          WhatsApp preview
        </div>
        <div className="rounded-lg p-3" style={{ background: "#075E54" }}>
          <div
            className="rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words font-mono"
            style={{ background: "#DCF8C6", color: "#111", borderRadius: "12px 12px 2px 12px" }}
          >
            {message}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => void handleCopy()}>
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleSend} disabled={!canSend}>
            <Copy className="h-3 w-3" /> Save + copy quote
          </Button>
        </div>
      </div>
    </div>
  );

  const history = (
    <PreviousQuotesList
      lead={lead}
      quotes={leadQuotes}
      loading={isLoading}
      onSetStatus={(payload) => {
        setStatus(payload, {
          onSuccess: () => {
            if (payload.status === "paid") {
              void setLeadStage(lead.id, "booked");
              toast.success("Quote paid. Check-in unlocked.");
              onPaid?.();
            }
          },
          onError: () => {
            toast.error("Could not update quote status");
          },
        });
      }}
    />
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {history}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-xs font-semibold flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" /> New quote
          </div>
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> Quotation
          {leadQuotes.length > 0 && (
            <span className="text-[10px] text-muted-foreground">· {leadQuotes.length} sent</span>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> New quote
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Create quotation for {lead.name}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">{form}</div>
          </DialogContent>
        </Dialog>
      </div>
      {history}
    </div>
  );
}

function PreviousQuotesList({
  lead,
  quotes,
  loading,
  onSetStatus,
}: {
  lead: Lead;
  quotes: Quotation[];
  loading: boolean;
  onSetStatus: ReturnType<typeof useSetQuotationStatus>["mutate"];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <div className="text-[11px] text-muted-foreground italic">Loading quotations…</div>;
  }

  if (quotes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-[11px] text-muted-foreground italic">
        No quotations sent to this lead yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        Previous quotes ({quotes.length})
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {quotes.map((q) => {
          const expired = q.status === "sent" && new Date(q.validUntilISO).getTime() < Date.now();
          const effective: QuotationStatus = expired ? "expired" : q.status;
          const expanded = expandedId === q.id;
          return (
            <div key={q.id} className="rounded border border-border p-2 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate min-w-0">
                  {q.propertyName} · {q.roomType}
                  {q.roomNumber ? ` #${q.roomNumber}` : ""}
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_TONE[effective]}`}>
                  {effective}
                </Badge>
              </div>
              <div className="text-muted-foreground">
                {formatINR(q.discountedPrice)}{" "}
                <span className="line-through">{formatINR(q.actualRent)}</span>
                {" · "}prebook {formatINR(q.prebook)}
                {" · "}
                {new Date(q.sentAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => void navigator.clipboard.writeText(q.message).then(() => toast.success("Copied"))}
                >
                  <Copy className="h-2.5 w-2.5" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => void navigator.clipboard.writeText(q.message).then(() => toast.success("Quote copied"))}
                >
                  <Copy className="h-2.5 w-2.5" /> Copy again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => setExpandedId(expanded ? null : q.id)}
                >
                  {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  {expanded ? "Hide" : "View"}
                </Button>
                {q.status === "sent" && !expired && (
                  <>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1"
                      onClick={() => onSetStatus({ id: q.id, leadId: lead.id, status: "paid" })}>
                      <Check className="h-2.5 w-2.5" /> Paid
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1"
                      onClick={() => onSetStatus({ id: q.id, leadId: lead.id, status: "not-paid" })}>
                      <X className="h-2.5 w-2.5" /> Not paid
                    </Button>
                  </>
                )}
              </div>
              {expanded && (
                <pre className="mt-1 rounded bg-muted/50 p-2 text-[10px] whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                  {q.message}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
