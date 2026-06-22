import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCheckin,
  useUpsertCheckin,
  useSetCheckinStage,
  usePatchCheckin,
  useAddCheckinDelay,
  useAddCheckinIssue,
  useSetCheckinIssueStatus,
  STAGE_LABEL,
  STAGE_ORDER,
  DELAY_REASONS,
  ISSUE_CATEGORIES,
  RISK_LABEL,
  RISK_CLASS,
  riskLevel,
  formatINR,
  type DelayReason,
  type IssueCategory,
} from "@/lib/checkins";
import {
  waBookingConfirm,
  waTokenRequest,
  waTokenReceipt,
  waRoomAssigned,
  waDateConfirm,
  waMoveInReminder,
  waMovedIn,
  waSettleCheck,
  waRescheduleCheckIn,
} from "@/lib/checkins/templates";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";
import { useQuotationsQuery } from "@/lib/crm10x/quotations";
import {
  CheckCircle2,
  MessageSquare,
  IndianRupee,
  Home,
  Calendar as CalendarIcon,
  AlertTriangle,
  KeyRound,
  Sparkles,
  Copy,
  RotateCcw,
  Wrench,
  ScrollText,
  ImagePlus,
  Search,
} from "lucide-react";
import type { Lead } from "@/lib/types";

function copyWA(msg: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(msg).catch(() => {});
  }
  toast.success("WhatsApp text copied");
}

export function CheckInPanel({ lead }: { lead: Lead }) {
  const properties = useApp((s) => s.properties);
  const setLeadStage = useApp((s) => s.setLeadStage);
  const closeDeal = useApp((s) => s.closeDeal);
  const addTenant = useApp((s) => s.addTenant);
  const existingBooking = useApp((s) => s.bookings.find((b) => b.leadId === lead.id));
  const existingTenant = useApp((s) => s.tenants.find((t) => t.leadId === lead.id));
  const { data: checkin } = useCheckin(lead.id);
  const { data: quotes = [] } = useQuotationsQuery(lead.id);
  const { mutate: upsert } = useUpsertCheckin();
  const { mutate: setStage } = useSetCheckinStage();
  const { mutate: patch } = usePatchCheckin();
  const { mutate: addDelay } = useAddCheckinDelay();
  const { mutate: addIssue } = useAddCheckinIssue();
  const { mutate: setIssueStatus } = useSetCheckinIssueStatus();
  const [, mounted] = useMountedNow();

  const risk = useMemo(() => (mounted && checkin ? riskLevel(checkin) : 0), [checkin, mounted]);
  const stageIdx = checkin ? STAGE_ORDER.indexOf(checkin.stage) : -1;

  // form state (stable hooks regardless of checkin presence)
  const [ackText, setAckText] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenRef, setTokenRef] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [reschedDate, setReschedDate] = useState("");
  const [reschedReason, setReschedReason] = useState<DelayReason>("finance");
  const [issueCat, setIssueCat] = useState<IssueCategory>("wifi");
  const [issueDesc, setIssueDesc] = useState("");
  const [nps, setNps] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const autoStartedLeadRef = useRef<string | null>(null);

  const paidQuote = useMemo(() => {
    return quotes
      .filter((quote) => quote.status === "paid")
      .sort((a, b) => {
        const aTime = new Date(a.paidAt || a.sentAt).getTime();
        const bTime = new Date(b.paidAt || b.sentAt).getTime();
        return bTime - aTime;
      })[0];
  }, [quotes]);

  const quoteProperty = useMemo(() => {
    if (!paidQuote) return null;
    return (
      properties.find((property) => property.id === paidQuote.propertyId) ??
      properties.find(
        (property) => property.name.toLowerCase() === paidQuote.propertyName.toLowerCase(),
      ) ??
      null
    );
  }, [paidQuote, properties]);

  const checkinSeed = useMemo(() => {
    const rent =
      paidQuote?.discountedPrice ||
      lead.quotedPrice ||
      lead.budget ||
      quoteProperty?.pricePerBed ||
      0;

    const safeDateIso = (dateStr?: string | null) => {
      if (!dateStr) return undefined;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString();
    };

    return {
      rent,
      deposit: 0,
      propertyId: paidQuote?.propertyId || quoteProperty?.id,
      propertyName: paidQuote?.propertyName || quoteProperty?.name,
      checkInDate: safeDateIso(lead.moveInDate),
    };
  }, [lead.budget, lead.moveInDate, lead.quotedPrice, paidQuote, quoteProperty]);

  const propertyOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; area?: string; price?: number }>();
    const add = (item?: { id: string; name: string; area?: string; price?: number } | null) => {
      if (!item?.id || !item.name) return;
      map.set(item.id, item);
    };
    add(
      paidQuote
        ? {
            id: paidQuote.propertyId || `quote-${paidQuote.id}`,
            name: paidQuote.propertyName,
            price: paidQuote.discountedPrice,
          }
        : null,
    );
    add(
      checkin?.propertyId && checkin.propertyName
        ? {
            id: checkin.propertyId,
            name: checkin.propertyName,
            price: checkin.rent,
          }
        : null,
    );
    properties.forEach((property) =>
      add({
        id: property.id,
        name: property.name,
        area: property.area,
        price: property.pricePerBed,
      }),
    );
    const query = propertySearch.trim().toLowerCase();
    return Array.from(map.values()).filter((property) =>
      query
        ? [property.name, property.area]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        : true,
    );
  }, [
    checkin?.propertyId,
    checkin?.propertyName,
    checkin?.rent,
    paidQuote,
    properties,
    propertySearch,
  ]);

  useEffect(() => {
    const shouldStart = lead.stage === "booked" || Boolean(paidQuote);
    if (checkin || !shouldStart || autoStartedLeadRef.current === lead.id) return;
    autoStartedLeadRef.current = lead.id;
    upsert({
      leadId: lead.id,
      rent: checkinSeed.rent,
      deposit: checkinSeed.deposit,
      propertyId: checkinSeed.propertyId,
      propertyName: checkinSeed.propertyName,
    });
  }, [checkin, checkinSeed, lead.id, lead.stage, paidQuote, upsert]);

  useEffect(() => {
    if (!checkin || !paidQuote) return;
    const patchData: Record<string, unknown> = {};
    if (checkinSeed.rent && checkin.rent !== checkinSeed.rent) patchData.rent = checkinSeed.rent;
    if (checkin.deposit !== checkinSeed.deposit) patchData.deposit = checkinSeed.deposit;
    if (checkinSeed.propertyId && checkin.propertyId !== checkinSeed.propertyId)
      patchData.propertyId = checkinSeed.propertyId;
    if (checkinSeed.propertyName && checkin.propertyName !== checkinSeed.propertyName)
      patchData.propertyName = checkinSeed.propertyName;
    if (!checkin.checkInDate && checkinSeed.checkInDate)
      patchData.checkInDate = checkinSeed.checkInDate;
    if (Object.keys(patchData).length === 0) return;
    patch({ id: checkin.id, leadId: lead.id, patch: patchData });
  }, [checkin, checkinSeed, lead.id, paidQuote, patch]);

  if (!checkin) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Preparing check-in from the paid quote.</div>
        <Button
          size="sm"
          onClick={() => {
            upsert({
              leadId: lead.id,
              rent: checkinSeed.rent,
              deposit: checkinSeed.deposit,
              propertyId: checkinSeed.propertyId,
              propertyName: checkinSeed.propertyName,
            });
            toast.success("Check-in record created");
          }}
        >
          Start check-in manually
        </Button>
      </div>
    );
  }

  const propertyName =
    propertyOptions.find((p) => p.id === propertyId)?.name ??
    properties.find((p) => p.id === propertyId)?.name ??
    checkin.propertyName;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {STAGE_LABEL[checkin.stage]}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${RISK_CLASS[risk]}`}>
              {risk >= 2 && <AlertTriangle className="h-3 w-3 mr-1" />}
              {RISK_LABEL[risk]}
            </Badge>
            {checkin.delays.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30"
              >
                {checkin.delays.length} reschedule{checkin.delays.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Balance due{" "}
            <span className="font-bold text-foreground">{formatINR(checkin.balanceDue)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`}
              title={STAGE_LABEL[s]}
            />
          ))}
        </div>
      </div>

      <StageCard
        active={checkin.stage === "booked"}
        done={stageIdx > STAGE_ORDER.indexOf("booked")}
        icon={MessageSquare}
        title="Paste customer's confirmation"
        helper="WhatsApp reply text. Optional: attach confirmation screenshot."
      >
        <Textarea
          value={ackText || checkin.ackText || ""}
          onChange={(e) => setAckText(e.target.value)}
          placeholder='e.g. "Yes confirmed, please proceed"'
          className="min-h-[64px] text-xs"
        />
        <ImageUploadInput
          label="Add confirmation screenshot image"
          value={checkin.ackScreenshotUrl}
          onChange={(value) =>
            patch({ id: checkin.id, leadId: lead.id, patch: { ackScreenshotUrl: value } })
          }
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs flex-1"
            onClick={() => copyWA(waBookingConfirm(lead.name, checkin.propertyName))}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy WA: confirm
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs flex-1"
            disabled={!ackText.trim() && !checkin.ackText}
            onClick={() => {
              patch({
                id: checkin.id,
                leadId: lead.id,
                patch: { ackText: ackText || checkin.ackText, ackAt: new Date().toISOString() },
              });
              setStage({ id: checkin.id, leadId: lead.id, stage: "ack_received" });
              toast.success("Ack received");
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark ack received
          </Button>
        </div>
      </StageCard>

      <StageCard
        active={checkin.stage === "ack_received"}
        done={stageIdx > STAGE_ORDER.indexOf("ack_received")}
        icon={IndianRupee}
        title="Token paid"
        helper="Enter amount + UPI ref number from the customer's screenshot."
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">
              Amount received (₹)
            </Label>
            <Input
              type="number"
              value={tokenAmount || String(checkin.tokenAmount ?? "")}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="5000"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">UPI ref#</Label>
            <Input
              value={tokenRef || checkin.tokenUpiRef || ""}
              onChange={(e) => setTokenRef(e.target.value)}
              placeholder="e.g. 4523XXX9871"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <ImageUploadInput
          label="Add payment screenshot image"
          value={checkin.tokenScreenshotUrl}
          onChange={(value) =>
            patch({ id: checkin.id, leadId: lead.id, patch: { tokenScreenshotUrl: value } })
          }
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs flex-1"
            onClick={() => copyWA(waTokenRequest(Number(tokenAmount) || 5000))}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy WA: ask token
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs flex-1"
            disabled={!tokenAmount || !tokenRef}
            onClick={() => {
              const amt = Number(tokenAmount);
              patch({
                id: checkin.id,
                leadId: lead.id,
                patch: {
                  tokenAmount: amt,
                  tokenUpiRef: tokenRef,
                  tokenAt: new Date().toISOString(),
                },
              });
              setStage({ id: checkin.id, leadId: lead.id, stage: "token_paid" });
              copyWA(
                waTokenReceipt({
                  ...checkin,
                  tokenAmount: amt,
                  tokenUpiRef: tokenRef,
                  balanceDue: Math.max(0, checkin.rent - amt),
                }),
              );
              toast.success("Token recorded");
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark token received
          </Button>
        </div>
      </StageCard>

      <StageCard
        active={checkin.stage === "token_paid"}
        done={stageIdx > STAGE_ORDER.indexOf("token_paid")}
        icon={Home}
        title="Assign room"
        helper="Pick property & room number. Blocks inventory."
      >
        <div className="grid grid-cols-2 gap-2">
          <Select value={propertyId || checkin.propertyId || ""} onValueChange={setPropertyId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-7 text-xs"
                    placeholder="Search property"
                    value={propertySearch}
                    onChange={(event) => setPropertySearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
              </div>
              {propertyOptions.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                  {p.area ? ` · ${p.area}` : ""}
                  {p.price ? ` · ${formatINR(p.price)}` : ""}
                </SelectItem>
              ))}
              {propertyOptions.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No property found.
                </div>
              )}
            </SelectContent>
          </Select>
          <Input
            value={roomNumber || checkin.roomNumber || ""}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="Room # (e.g. 204)"
            className="h-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs w-full"
          disabled={!(propertyId || checkin.propertyId) || !(roomNumber || checkin.roomNumber)}
          onClick={() => {
            const pid = propertyId || checkin.propertyId!;
            const rn = roomNumber || checkin.roomNumber!;
            const selectedProperty = propertyOptions.find((p) => p.id === pid);
            const pn = selectedProperty?.name ?? propertyName;
            patch({
              id: checkin.id,
              leadId: lead.id,
              patch: {
                propertyId: pid,
                propertyName: pn,
                roomNumber: rn,
                roomAssignedAt: new Date().toISOString(),
                ...(selectedProperty?.price ? { rent: selectedProperty.price } : {}),
              },
            });
            setStage({ id: checkin.id, leadId: lead.id, stage: "room_assigned" });
            copyWA(
              waRoomAssigned({ ...checkin, propertyId: pid, propertyName: pn, roomNumber: rn }),
            );
            toast.success(`Room ${rn} assigned`);
          }}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm & copy WA
        </Button>
      </StageCard>

      <StageCard
        active={checkin.stage === "room_assigned"}
        done={stageIdx > STAGE_ORDER.indexOf("room_assigned")}
        icon={CalendarIcon}
        title="Set check-in date"
      >
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={checkInDate || checkin.checkInDate?.slice(0, 10) || ""}
            onChange={(e) => setCheckInDate(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!checkInDate && !checkin.checkInDate}
            onClick={() => {
              const d = checkInDate || checkin.checkInDate!.slice(0, 10);
              patch({
                id: checkin.id,
                leadId: lead.id,
                patch: { checkInDate: new Date(d).toISOString() },
              });
              setStage({ id: checkin.id, leadId: lead.id, stage: "date_set" });
              copyWA(waDateConfirm({ ...checkin, checkInDate: new Date(d).toISOString() }));
              toast.success("Date set");
            }}
          >
            Set date
          </Button>
        </div>
      </StageCard>

      {checkin.checkInDate && checkin.stage !== "moved_in" && checkin.stage !== "settled" && (
        <StageCard
          active={false}
          done={false}
          icon={RotateCcw}
          title="Reschedule check-in"
          helper={`Current: ${new Date(checkin.checkInDate).toDateString()}. Delays so far: ${checkin.delays.length}`}
        >
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={reschedDate}
              onChange={(e) => setReschedDate(e.target.value)}
              className="h-8 text-xs"
            />
            <Select value={reschedReason} onValueChange={(v) => setReschedReason(v as DelayReason)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELAY_REASONS.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs w-full"
            disabled={!reschedDate}
            onClick={() => {
              const nextDate = new Date(reschedDate).toISOString();
              addDelay({
                id: checkin.id,
                leadId: lead.id,
                delay: { to: nextDate, reason: reschedReason },
              });
              copyWA(
                waRescheduleCheckIn(
                  { ...checkin, checkInDate: nextDate },
                  DELAY_REASONS.find((r) => r.id === reschedReason)?.label,
                ),
              );
              setReschedDate("");
              toast.warning(`Rescheduled. Risk re-scored and WhatsApp text copied.`);
            }}
          >
            Log reschedule + copy WA
          </Button>
        </StageCard>
      )}

      {(checkin.stage === "date_set" || checkin.stage === "moved_in") && checkin.balanceDue > 0 && (
        <StageCard active icon={IndianRupee} title="Collect remaining balance">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
            Balance pending: <span className="font-semibold">{formatINR(checkin.balanceDue)}</span>.
            Clear this before key handover/final check-in.
          </div>
          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => {
              patch({
                id: checkin.id,
                leadId: lead.id,
                patch: {
                  tokenAmount: checkin.rent,
                  tokenAt: new Date().toISOString(),
                },
              });
              toast.success("Balance marked collected");
            }}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" /> Mark full payment received
          </Button>
        </StageCard>
      )}

      <StageCard
        active={checkin.stage === "date_set"}
        done={stageIdx > STAGE_ORDER.indexOf("date_set")}
        icon={KeyRound}
        title="Key handover"
        helper="Hand over keys only after balance is clear. This marks the customer moved in."
      >
        <ImageUploadInput
          label="Add key handover photo"
          value={checkin.keyHandoverPhotoUrl}
          onChange={(value) =>
            patch({ id: checkin.id, leadId: lead.id, patch: { keyHandoverPhotoUrl: value } })
          }
        />
        <Button
          size="sm"
          className="h-8 text-xs w-full bg-success text-success-foreground hover:bg-success/90"
          disabled={checkin.balanceDue > 0}
          title={
            checkin.balanceDue > 0 ? "Collect remaining balance before key handover" : undefined
          }
          onClick={() => {
            if (!existingBooking) {
              closeDeal({
                leadId: lead.id,
                tourId: "checkin",
                propertyId: checkin.propertyId ?? "",
                tcmId: lead.assignedTcmId ?? "",
                amount: checkin.rent,
              });
            }
            void setLeadStage(lead.id, "booked");
            setStage({ id: checkin.id, leadId: lead.id, stage: "moved_in" });
            copyWA(waMovedIn(lead.name));
            toast.success("Keys handed over · moved-in recorded");
          }}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark keys handed over
        </Button>
      </StageCard>

      {(checkin.stage === "moved_in" ||
        checkin.stage === "settled" ||
        checkin.issues.length > 0) && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-semibold">Issues ({checkin.issues.length})</span>
          </div>
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <Select value={issueCat} onValueChange={(v) => setIssueCat(v as IssueCategory)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="One-line description"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!issueDesc.trim()}
              onClick={() => {
                addIssue({
                  id: checkin.id,
                  leadId: lead.id,
                  issue: { category: issueCat, description: issueDesc.trim() },
                });
                setIssueDesc("");
                toast.success("Issue logged");
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {checkin.issues.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-2 text-xs rounded border border-border p-2"
              >
                <Badge variant="outline" className="text-[10px]">
                  {i.category}
                </Badge>
                <span className="flex-1 truncate">{i.description}</span>
                <Select
                  value={i.status}
                  onValueChange={(v) =>
                    setIssueStatus({
                      id: checkin.id,
                      leadId: lead.id,
                      issueId: i.id,
                      status: v as any,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-[10px] w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open" className="text-xs">
                      Open
                    </SelectItem>
                    <SelectItem value="in_progress" className="text-xs">
                      In progress
                    </SelectItem>
                    <SelectItem value="resolved" className="text-xs">
                      Resolved
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {checkin.issues.length === 0 && (
              <div className="text-[11px] text-muted-foreground italic">No issues yet. 🎉</div>
            )}
          </div>
        </div>
      )}

      {checkin.stage === "moved_in" && (
        <StageCard active icon={Sparkles} title="Complete check-in">
          {checkin.balanceDue > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
              Cannot complete check-in while {formatINR(checkin.balanceDue)} is pending.
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={5}
              value={nps}
              onChange={(e) => setNps(e.target.value)}
              placeholder="NPS 1-5 optional"
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-8 text-xs flex-1"
              disabled={
                checkin.balanceDue > 0 || (Boolean(nps) && (Number(nps) < 1 || Number(nps) > 5))
              }
              onClick={() => {
                if (nps)
                  patch({ id: checkin.id, leadId: lead.id, patch: { npsScore: Number(nps) } });
                const booking = existingBooking ?? closeDeal({
                  leadId: lead.id,
                  tourId: "checkin",
                  propertyId: checkin.propertyId ?? "",
                  tcmId: lead.assignedTcmId ?? "",
                  amount: checkin.rent,
                });
                if (booking && !existingTenant) {
                  addTenant({
                    bookingId: booking.id,
                    leadId: lead.id,
                    propertyId: checkin.propertyId ?? "",
                    // propertyName: checkin.propertyName ?? "",
                    tcmId: lead.assignedTcmId ?? "",
                    name: lead.name,
                    phone: lead.phone,
                    roomNumber: checkin.roomNumber,
                    moveInDate: checkin.checkInDate ?? new Date().toISOString().slice(0, 10),
                    rent: checkin.rent,
                    deposit: checkin.deposit,
                    status: "active",
                  });
                }
                void setLeadStage(lead.id, "booked");
                setStage({ id: checkin.id, leadId: lead.id, stage: "settled" });
                copyWA(waSettleCheck(lead.name));
                toast.success("Check-in complete · booking created");
              }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete check-in
            </Button>
          </div>
        </StageCard>
      )}

      {checkin.stage === "settled" && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Check-in complete
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Booking is final, keys are handed over, and balance is {formatINR(checkin.balanceDue)}.
          </div>
        </div>
      )}

      {checkin.stage === "date_set" && checkin.checkInDate && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs w-full"
          onClick={() => copyWA(waMoveInReminder(checkin))}
        >
          <Copy className="h-3 w-3 mr-1" /> Copy 24h reminder WA
        </Button>
      )}

      <StageCard active={false} done={false} icon={ScrollText} title="Check-in audit report">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <AuditBox label="Stage" value={STAGE_LABEL[checkin.stage]} />
          <AuditBox label="Balance" value={formatINR(checkin.balanceDue)} />
          <AuditBox
            label="Delays"
            value={String(checkin.delays.length)}
            danger={checkin.delays.length >= 2}
          />
          <AuditBox
            label="Issues"
            value={String(checkin.issues.filter((i) => i.status !== "resolved").length)}
            danger={checkin.issues.some((i) => i.status !== "resolved")}
          />
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {checkin.history
            .slice()
            .reverse()
            .map((h, idx) => (
              <div
                key={`${h.at}-${idx}`}
                className="rounded border border-border p-1.5 text-[10px]"
              >
                <div className="font-medium">{h.note ?? STAGE_LABEL[h.stage]}</div>
                <div className="text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(h.at))}
                </div>
              </div>
            ))}
        </div>
      </StageCard>
    </div>
  );
}

function AuditBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={`rounded border p-2 ${danger ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/20"}`}
    >
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold truncate">{value}</div>
    </div>
  );
}

function ImageUploadInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const inputId = useMemo(() => `checkin-image-${Math.random().toString(36).slice(2, 9)}`, []);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
        toast.success("Image attached");
      }
    };
    reader.onerror = () => toast.error("Could not attach image");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 flex-1 cursor-pointer justify-center text-xs"
      >
        <label htmlFor={inputId}>
          <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          {value ? "Change image" : label}
        </label>
      </Button>
      {value && (
        <Badge
          variant="outline"
          className="h-8 shrink-0 border-success/40 bg-success/10 text-[10px] text-success"
        >
          Attached
        </Badge>
      )}
    </div>
  );
}

function StageCard({
  active,
  done,
  icon: Icon,
  title,
  helper,
  children,
}: {
  active?: boolean;
  done?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  helper?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : active
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground"}`}
        />
        <span className="text-xs font-semibold">{title}</span>
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
      </div>
      {helper && !done && <div className="text-[11px] text-muted-foreground">{helper}</div>}
      {!done && children}
    </div>
  );
}
