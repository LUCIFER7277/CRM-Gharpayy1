import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Circle, IndianRupee, Sparkles, AlertTriangle,
  Share2, Eye, Home, CalendarDays, ClipboardList, MessageSquare,
  History, X, User, FileText, Phone, Building2, BedDouble, Clock,
  ArrowRight, ChevronRight, Lock, Bell, Hash,
} from "lucide-react";
import type { OwnerBooking, OwnerDecision, ReadinessKey } from "@/lib/owner-bookings/types";
import { LIFECYCLE_LABEL, READINESS_LABEL } from "@/lib/owner-bookings/types";
import { computeTotals, useOwnerBookings } from "@/lib/owner-bookings/store";
import { useQuotationsQuery, formatINR } from "@/lib/crm10x/quotations";
import type { Quotation } from "@/lib/crm10x/quotations";
import { QuotationDetailDialog } from "./QuotationDetailDialog";
import { useShareBookingWithOwner } from "@/lib/owner-bookings/api";

interface Props {
  booking: OwnerBooking;
  mode: "sales" | "owner";
  submode?: "approval" | "operations";
  compact?: boolean;
  onClose?: () => void;
}

const READINESS_KEYS: ReadinessKey[] = [
  "cleaning", "furniture", "internet", "electricity", "water", "inspection",
];

const statusTone: Record<OwnerBooking["status"], string> = {
  created: "bg-muted text-muted-foreground border-muted",
  shared_with_owner: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  viewed_by_owner: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  acknowledged: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  room_ready: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  move_in_approved: "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/30",
  completed: "bg-green-700/20 text-green-800 dark:text-green-200 border-green-700/30",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground line-through border-muted",
};

const LIFECYCLE_STEPS: { status: OwnerBooking["status"]; label: string }[] = [
  { status: "created", label: "Created" },
  { status: "shared_with_owner", label: "Shared" },
  { status: "viewed_by_owner", label: "Viewed" },
  { status: "acknowledged", label: "Acknowledged" },
  { status: "room_ready", label: "Room Ready" },
  { status: "move_in_approved", label: "Move-in" },
  { status: "completed", label: "Completed" },
];

function lifecycleIndex(b: OwnerBooking): number {
  if (b.status === "rejected" || b.status === "cancelled") return -1;
  return LIFECYCLE_STEPS.findIndex((s) => s.status === b.status);
}

function sharingLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export function OwnerBookingCard({ booking: b, mode, submode, onClose }: Props) {
  const totals = computeTotals(b);
  const store = useOwnerBookings();
  const { data: quotes = [] } = useQuotationsQuery(b.leadId);
  const shareWithOwnerMutation = useShareBookingWithOwner();

  const [decideOpen, setDecideOpen] = useState(false);
  const [decision, setDecision] = useState<OwnerDecision>("approve");
  const [decisionNote, setDecisionNote] = useState("");
  const [readinessNote, setReadinessNote] = useState(b.readinessNote ?? "");
  const [detailQuote, setDetailQuote] = useState<Quotation | null>(null);

  const idx = lifecycleIndex(b);
  const isRejected = b.status === "rejected" || b.status === "cancelled";

  function applyDecision() {
    store.recordOwnerDecision(b.id, decision, decisionNote);
    setDecideOpen(false);
    setDecisionNote("");
  }

  function toggleReadiness(key: ReadinessKey) {
    const current = b.readiness[key];
    store.setReadiness(b.id, key, current === "ready" ? "pending" : "ready", mode === "owner" ? "owner" : "sales");
  }

  return (
    <div className="space-y-3">

      {/* A: Header Card */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base truncate">{b.customer.name}</span>
              <Badge variant="outline" className="text-[10px] font-mono">{b.customer.phone}</Badge>
              <Badge className={`text-[10px] ${statusTone[b.status]}`}>
                {LIFECYCLE_LABEL[b.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Building2 className="h-3 w-3" />
              <span>{b.inventory.propertyName}</span>
              <span className="text-muted/50">|</span>
              <BedDouble className="h-3 w-3" />
              <span>{sharingLabel(b.inventory.sharing)}</span>
              <span className="text-muted/50">|</span>
              <span>Room {b.inventory.roomNumber || "—"} / Bed {b.inventory.bedNumber}</span>
            </div>
          </div>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Move-in</span>
            <span className="ml-1.5 font-medium">{formatDate(b.moveIn.date)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Stay</span>
            <span className="ml-1.5 font-medium">{b.moveIn.stayMonths}mo</span>
          </div>
          <div>
            <span className="text-muted-foreground">Expected</span>
            <span className="ml-1.5 font-medium">₹{totals.expected.toLocaleString("en-IN")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pending</span>
            <span className={`ml-1.5 font-medium ${totals.pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              ₹{totals.pending.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">

        {/* B: Customer Card */}
        <Card className="p-3">
          <SectionTitle icon={<User className="h-3.5 w-3.5" />} title="Customer" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-1.5">
            <InfoRow label="Gender" value={sharingLabel(b.customer.gender)} />
            <InfoRow label="Occupation" value={sharingLabel(b.customer.occupation)} />
            {b.customer.companyOrCollege && <InfoRow label="Company/College" value={b.customer.companyOrCollege} />}
            {b.customer.emergencyName && (
              <InfoRow label="Emergency" value={`${b.customer.emergencyName} · ${b.customer.emergencyPhone ?? "—"}`} />
            )}
          </div>
        </Card>

        {/* C: Stay / Allocation Card */}
        <Card className="p-3">
          <SectionTitle icon={<CalendarDays className="h-3.5 w-3.5" />} title="Stay & Allocation" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-1.5">
            <InfoRow label="Sharing" value={sharingLabel(b.inventory.sharing)} />
            <InfoRow label="Category" value={sharingLabel(b.inventory.category)} />
            <InfoRow label="Floor / Room" value={`${b.inventory.floor} / ${b.inventory.roomNumber || "—"}`} />
            <InfoRow label="Bed" value={b.inventory.bedNumber} />
            <InfoRow label="Move-in" value={`${formatDate(b.moveIn.date)} at ${b.moveIn.time}`} />
            <InfoRow label="Expected Stay" value={`${b.moveIn.stayMonths} months`} />
            <InfoRow label="Lock-in" value={`${b.moveIn.lockInMonths} months`} />
            <InfoRow label="Notice" value={`${b.moveIn.noticeDays} days`} />
          </div>
        </Card>

        {/* D: Financials Card */}
        <Card className="p-3">
          <SectionTitle icon={<IndianRupee className="h-3.5 w-3.5" />} title="Financials" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-1.5">
            <InfoRow label="Monthly Rent" value={`₹${b.rent.toLocaleString("en-IN")}`} />
            <InfoRow label="Security Deposit" value={`₹${b.deposit.toLocaleString("en-IN")}`} />
            <div className="col-span-2 border-t border-border/50 my-1" />
            <InfoRow label="Total Expected" value={`₹${totals.expected.toLocaleString("en-IN")}`} strong />
            <InfoRow label="Received" value={`₹${totals.received.toLocaleString("en-IN")}`} tone={totals.received > 0 ? "good" : undefined} />
            <InfoRow label="Pending" value={`₹${totals.pending.toLocaleString("en-IN")}`} tone={totals.pending > 0 ? "warn" : "good"} />
          </div>
          <div className="mt-2 space-y-1">
            {b.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-border bg-card px-2.5 py-1.5 text-xs">
                <span className="truncate">{p.label}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-mono">₹{p.amount.toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    p.status === "received" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
                    p.status === "waived" ? "border-muted text-muted-foreground" :
                    "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  }`}>{p.status}</Badge>
                  {mode === "sales" && p.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                      onClick={() => store.markPaymentReceived(b.id, p.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark received
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* E: Quotation Card */}
        <Card className="p-3">
          <SectionTitle icon={<FileText className="h-3.5 w-3.5" />}
            title={`Quotation${quotes.length > 0 ? ` (${quotes.length})` : ""}`} />
          {!b.leadId ? (
            <p className="text-xs text-muted-foreground mt-1.5 italic">No quotation linked to this booking.</p>
          ) : quotes.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1.5 italic">Loading quotation data…</p>
          ) : (
            <div className="space-y-1.5 mt-1.5">
              {quotes.map((q, i) => {
                const isLatest = i === 0;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setDetailQuote(q)}
                    className="w-full text-left rounded border border-border p-2 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                        <span className="font-medium truncate">{q.propertyName} · {q.roomType}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] ${
                          q.status === "paid" ? "border-emerald-500/40 text-emerald-700" :
                          q.status === "sent" ? "border-accent/30 text-accent" :
                          "border-muted text-muted-foreground"
                        }`}>{q.status}</Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                      <span>{formatINR(q.discountedPrice)}
                        {q.discountedPrice < q.actualRent && <span className="line-through ml-1">{formatINR(q.actualRent)}</span>}
                      </span>
                      <span className="text-muted/50">·</span>
                      <span>Deposit {formatINR(q.deposit)}</span>
                      <span className="text-muted/50">·</span>
                      <span>{formatTime(q.sentAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* F: Readiness & Confirmation Card (Hidden in Approval Submode) */}
        {submode !== "approval" && (
          <Card className="p-3">
            <SectionTitle icon={<ClipboardList className="h-3.5 w-3.5" />}
              title={`Room Readiness · ${totals.readyCount}/${totals.totalReadiness}`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
            {READINESS_KEYS.map((k) => {
              const ready = b.readiness[k] === "ready";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleReadiness(k)}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs transition cursor-pointer hover:border-emerald-500/70 ${
                    ready
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/20"
                  }`}
                >
                  {ready ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left">{READINESS_LABEL[k]}</span>
                </button>
              );
            })}
          </div>
          {mode === "owner" && (
            <div className="flex items-center gap-2 mt-2">
              <Textarea rows={2} placeholder="Notes for sales team (optional)…"
                value={readinessNote}
                onChange={(e) => setReadinessNote(e.target.value)}
                onBlur={() => readinessNote !== (b.readinessNote ?? "") && store.updateBooking(b.id, { readinessNote })} />
              <Button size="sm" variant="outline" onClick={() => store.markAllReady(b.id)} className="shrink-0">All ready</Button>
            </div>
          )}

          <Separator className="my-3" />

          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Confirmation Gates
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Gate ok={!!b.ownerDecision && b.ownerDecision !== "reject"} label="Owner ack" />
            <Gate ok={!!b.inventory.roomNumber} label="Room assigned" />
            <Gate ok={!!b.moveIn.date} label="Move-in date" />
            <Gate ok={totals.isFullyReady} label="Room ready" />
          </div>

          {!isRejected && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {idx >= 0 && idx < LIFECYCLE_STEPS.length - 1
                  ? `Next: ${LIFECYCLE_STEPS[idx + 1]?.label ?? "Complete"}`
                  : idx === LIFECYCLE_STEPS.length - 1
                  ? "All gates passed"
                  : "Booking issue"}
              </span>
            </div>
          )}
        </Card>
        )}
        {/* G: Activity Card */}
        <Card className="p-3">
          <SectionTitle icon={<History className="h-3.5 w-3.5" />} title={`Activity (${b.history.length})`} />
          <ol className="space-y-1.5 text-xs mt-1.5 max-h-48 overflow-y-auto">
            {[...b.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground tabular-nums shrink-0 w-28">
                  {formatTime(h.ts)}
                </span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="font-medium shrink-0">{h.actor}</span>
                <span className="text-muted-foreground">{h.text}</span>
              </li>
            ))}
            {b.history.length === 0 && (
              <li className="text-muted-foreground italic">No activity recorded.</li>
            )}
          </ol>
        </Card>

      </div>

      {/* Action Buttons */}
      <Card className="p-3 flex flex-wrap items-center justify-end gap-2">
        {mode === "sales" && b.status === "created" && (
          <Button size="sm" onClick={() => {
            store.shareWithOwner(b.id);
            shareWithOwnerMutation.mutate(b.id);
          }}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share with owner
          </Button>
        )}
        {mode === "owner" && b.status === "shared_with_owner" && submode === "approval" && (
          <Button size="sm" variant="outline" onClick={() => store.markViewed(b.id)}>
            <Eye className="h-4 w-4 mr-1.5" /> Mark as viewed
          </Button>
        )}
        {mode === "owner" && submode === "approval" && !b.ownerDecision && b.status !== "cancelled" && (
          <Button size="sm" onClick={() => setDecideOpen(true)}>Owner action…</Button>
        )}
        {mode === "owner" && submode === "operations" && b.ownerDecision !== "reject" && totals.isFullyReady && b.status === "room_ready" && (
          <Button size="sm" onClick={() => store.approveMoveIn(b.id)}>Approve move-in</Button>
        )}
        {mode === "sales" && b.status === "move_in_approved" && (
          <Button size="sm" onClick={() => store.completeBooking(b.id)}>Mark checked in</Button>
        )}
        {mode === "sales" && b.status !== "completed" && b.status !== "cancelled" && (
          <Button size="sm" variant="outline" onClick={() => {
            const r = prompt("Cancel reason?");
            if (r) store.cancelBooking(b.id, r);
          }}>Cancel</Button>
        )}
      </Card>

      {/* Special Requests */}
      {b.specialRequests.length > 0 && (
        <Card className="p-3">
          <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />} title="Special Requests" />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {b.specialRequests.map((r) => (
              <Badge key={r.id} variant="secondary" className="text-[10px] flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                {r.text}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Owner Decision */}
      {b.ownerDecision && (
        <Card className="p-3">
          <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title="Owner Decision" />
          <div className="text-xs mt-1">
            <Badge variant="outline" className={`text-[10px] capitalize ${
              b.ownerDecision === "reject" ? "border-red-400/50 text-red-600" : "border-emerald-500/40 text-emerald-700"
            }`}>
              {b.ownerDecision.replace(/_/g, " ")}
            </Badge>
            {b.ownerConditionNote && <div className="text-muted-foreground mt-1">{b.ownerConditionNote}</div>}
            {b.ownerRejectionReason && <div className="text-red-600 dark:text-red-400 mt-1">Reason: {b.ownerRejectionReason}</div>}
          </div>
        </Card>
      )}

      {/* Owner Decision Dialog */}
      <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Owner decision</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["approve", "approve_with_conditions", "reject"] as OwnerDecision[]).map((d) => (
                <button key={d}
                  onClick={() => setDecision(d)}
                  className={`text-xs rounded border px-2 py-2 capitalize ${
                    decision === d ? "border-primary bg-primary/10 font-medium" : "border-border"
                  }`}>
                  {d.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              placeholder={
                decision === "reject"
                  ? "Reason for rejection (room occupied / under maintenance / wrong assignment)…"
                  : decision === "approve_with_conditions"
                  ? "Condition (e.g. room ready tomorrow, cleaning pending)…"
                  : "Optional note for the sales team…"
              }
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideOpen(false)}>Cancel</Button>
            <Button onClick={applyDecision}
              disabled={decision === "reject" && !decisionNote.trim()}>
              Submit decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuotationDetailDialog quotation={detailQuote} open={!!detailQuote} onOpenChange={(o) => { if (!o) setDetailQuote(null); }} />
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
      {icon}<span>{title}</span>
    </div>
  );
}

function InfoRow({ label, value, strong, tone, className }: { label: string; value: string; strong?: boolean; tone?: "good" | "warn"; className?: string }) {
  const toneCls = tone === "good" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`rounded border px-2 py-1.5 flex items-center gap-2 text-xs ${
      ok ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
         : "border-border bg-card text-muted-foreground"
    }`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}
