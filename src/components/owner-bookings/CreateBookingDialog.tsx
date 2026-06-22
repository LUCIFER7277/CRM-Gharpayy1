import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, FileText, Zap } from "lucide-react";
import { useOwnerBookings } from "@/lib/owner-bookings/store";
import { useApp } from "@/lib/store";
import { PGS } from "@/property-genius/data/pgs";
import { ownerCodeForPG, pgsForOwner } from "@/property-genius/lib/roles";
import { PropertyHubPicker, pgQuoteDefaults } from "@/property-genius/components/PropertyHubPicker";
import { QuotationBuilder } from "@/components/crm10x/QuotationBuilder";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/lib/auth-store";
import type { Gender, Occupation, SharingType, RoomCategory } from "@/lib/owner-bookings/types";
import type { Lead } from "@/lib/types";
import type { PG } from "@/property-genius/data/types";
import {
  emptyDraft, draftToCreateInput, type BookingDraft,
} from "@/lib/owner-bookings/sync";

const SUGGESTED = [
  "Lower floor", "Quiet room", "Near window", "Early check-in",
  "Extra mattress", "AC room", "Attached washroom", "Veg-only floor",
];

const PHONE_RE = /^[+]?[\d\s-]{10,15}$/;
const NAME_RE = /^[a-zA-Z\s.'-]{2,80}$/;
const ROOM_RE = /^[a-zA-Z0-9\s/-]{1,20}$/;
const BED_RE = /^[a-zA-Z0-9]{1,5}$/;

function validate(d: BookingDraft): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!NAME_RE.test(d.customer.name.trim())) errs.name = "Full name required (2+ letters)";
  if (!PHONE_RE.test(d.customer.phone.trim())) errs.phone = "Valid phone required (10-15 digits)";
  if (d.customer.emergencyPhone && !PHONE_RE.test(d.customer.emergencyPhone.trim())) errs.emergencyPhone = "Invalid emergency phone";
  if (!d.inventory.propertyName.trim()) errs.property = "Select a property";
  if (!d.inventory.roomNumber?.trim()) errs.room = "Room number required";
  else if (!ROOM_RE.test(d.inventory.roomNumber.trim())) errs.room = "Invalid room number";
  if (!d.inventory.sharing) errs.sharing = "Sharing type required";
  if (d.inventory.bedNumber && !BED_RE.test(d.inventory.bedNumber.trim())) errs.bed = "Invalid bed number";
  if (d.rent < 1000) errs.rent = `Rent must be ₹1,000+`;
  if (d.deposit < d.rent) errs.deposit = `Deposit (₹${d.deposit}) must be ≥ 1 month's rent (₹${d.rent})`;
  if (d.bookingAmt < 0) errs.bookingAmt = "Booking amount cannot be negative";
  if (!d.moveIn.date) errs.moveDate = "Move-in date required";
  if (d.moveIn.stayMonths < 1) errs.stay = "Stay must be 1+ months";
  return errs;
}

interface Props {
  trigger?: React.ReactNode;
  ownerId?: string;
  propertyId?: string;
  leadId?: string;
  filterToOwnerId?: string;
}

export function CreateBookingDialog({ trigger, propertyId: initialPropertyId, filterToOwnerId }: Props) {
  const { createBooking } = useOwnerBookings();
  const leads = useApp((s) => s.leads);
  const addLead = useApp((s) => s.addLead);
  const user = useAuthUser((s) => s.user);

  const [pgId, setPgId] = useState<string>(initialPropertyId ?? "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDraft>(() => emptyDraft());
  const [reqDraft, setReqDraft] = useState("");

  const [propSearchOpen, setPropSearchOpen] = useState(false);
  const [propQuery, setPropQuery] = useState("");

  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [quoteLead, setQuoteLead] = useState<Lead | null>(null);
  const [quoteInit, setQuoteInit] = useState<{
    pg: PG; roomType: string; rent: number; deposit: number; roomNumber: string;
    lockIn: string; notice: string; prebook?: number;
  } | null>(null);

  const availablePgs = useMemo(() => {
    let list = PGS;
    if (filterToOwnerId) {
      const code = filterToOwnerId.startsWith("GP-OWN-") ? filterToOwnerId : null;
      if (code) list = pgsForOwner(code);
    }
    const q = propQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.actualName || p.name).toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 80);
  }, [filterToOwnerId, propQuery]);

  const selectedPg = useMemo(() => PGS.find((p) => p.id === pgId), [pgId]);

  const sharingOptions = useMemo(() => {
    const pg = selectedPg;
    return [
      { value: "single" as const, label: "Single Sharing", show: !pg || pg.prices.single > 0 },
      { value: "double" as const, label: "Double Sharing", show: !pg || pg.prices.double > 0 },
      { value: "triple" as const, label: "Triple Sharing", show: !pg || pg.prices.triple > 0 },
      { value: "quad" as const, label: "Quad Sharing", show: true },
      { value: "studio" as const, label: "Studio", show: true },
    ].filter((o) => o.show);
  }, [selectedPg]);

  useEffect(() => {
    if (!sharingOptions.find((o) => o.value === draft.inventory.sharing)) {
      handleSharingChange(sharingOptions[0]?.value ?? "double");
    }
  }, [sharingOptions]);

  function sharingPrice(pg: typeof selectedPg, sharing: string): number {
    if (!pg) return 0;
    if (sharing === "single") return pg.prices.single;
    if (sharing === "double") return pg.prices.double;
    if (sharing === "triple") return pg.prices.triple;
    // quad, studio: no explicit price in PG data — return 0 to keep current value unchanged
    return 0;
  }

  function selectPg(id: string) {
    setPgId(id);
    setPropSearchOpen(false);
    const pg = PGS.find((p) => p.id === id);
    if (pg) {
      setDraft((d) => {
        const defaults = pgQuoteDefaults(pg);
        const rent = defaults.discounted;
        const deposit = defaults.deposit;
        return {
          ...d,
          ownerId: ownerCodeForPG(id) || "GP-OWN-UNASSIGNED",
          rent: rent,
          deposit: deposit,
          bookingAmt: 5000,
          inventory: { ...d.inventory, propertyId: id, propertyName: pg.actualName || pg.name },
        };
      });
    }
  }

  function handlePropertyHubSelect(pg: PG) {
    selectPg(pg.id);
  }

  function handlePropertyHubClear() {
    setPgId("");
    setDraft((d) => ({
      ...d,
      inventory: { ...d.inventory, propertyId: "", propertyName: "" },
      ownerId: "",
    }));
  }

  function handleSharingChange(sharing: string) {
    setDraft((d) => {
      const pg = PGS.find((p) => p.id === pgId);
      if (!pg) return { ...d, inventory: { ...d.inventory, sharing: sharing as SharingType } };
      const rent = sharingPrice(pg, sharing);
      const newRent = rent > 0 ? rent : d.rent;
      const depositMatch = /one\s*month|1\s*month/i.test(pg.deposit ?? "");
      const newDeposit = depositMatch ? newRent : Math.round(newRent * 0.5) || 5000;
      return {
        ...d,
        rent: newRent,
        deposit: newDeposit,
        inventory: { ...d.inventory, sharing: sharing as SharingType },
      };
    });
  }

  function patch<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function patchCustomer<K extends keyof BookingDraft["customer"]>(key: K, value: BookingDraft["customer"][K]) {
    setDraft((d) => ({ ...d, customer: { ...d.customer, [key]: value } }));
  }
  function patchInventory<K extends keyof BookingDraft["inventory"]>(key: K, value: BookingDraft["inventory"][K]) {
    setDraft((d) => ({ ...d, inventory: { ...d.inventory, [key]: value } }));
  }
  function patchMoveIn<K extends keyof BookingDraft["moveIn"]>(key: K, value: BookingDraft["moveIn"][K]) {
    setDraft((d) => ({ ...d, moveIn: { ...d.moveIn, [key]: value } }));
  }

  function addReq(text: string) {
    const t = text.trim();
    if (t && !draft.specialRequests.includes(t)) {
      setDraft((d) => ({ ...d, specialRequests: [...d.specialRequests, t] }));
    }
    setReqDraft("");
  }

  const errors = useMemo(() => validate(draft), [draft]);
  const isValid = Object.keys(errors).length === 0;

  function submit() {
    if (!isValid) return;
    const input = draftToCreateInput(
      { ...draft, inventory: { ...draft.inventory, roomNumber: draft.inventory.roomNumber || "TBD" } },
      { leadId: draft.leadId, createdBy: user?.name ?? "ops" },
    );
    createBooking(input);
    setOpen(false);
    setPgId("");
    setDraft(emptyDraft());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuoteBuilderOpen(false); setQuoteLead(null); setQuoteInit(null); } }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Owner Booking</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Create Owner Booking
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 mt-2">
          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Customer</div>
            <Field label="Name" error={errors.name}>
              <Input value={draft.customer.name} onChange={(e) => patchCustomer("name", e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input value={draft.customer.phone} onChange={(e) => patchCustomer("phone", e.target.value)} placeholder="+91 98765 43210" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Gender">
                <Select value={draft.customer.gender} onValueChange={(v) => patchCustomer("gender", v as Gender)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Occupation">
                <Select value={draft.customer.occupation} onValueChange={(v) => patchCustomer("occupation", v as Occupation)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working">Working Pro</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Company / College">
              <Input value={draft.customer.companyOrCollege} onChange={(e) => patchCustomer("companyOrCollege", e.target.value)} placeholder="e.g. Google / Christ University" />
            </Field>
            <Field label="Alternate Phone" error={errors.emergencyPhone}>
              <Input value={draft.customer.emergencyPhone} onChange={(e) => patchCustomer("emergencyPhone", e.target.value)} placeholder="+91 98765 43210" />
            </Field>
          </Card>

          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Room & Property</div>
            <Field label="Property" error={errors.property}>
              <PropertyHubPicker
                selected={selectedPg || null}
                onSelect={handlePropertyHubSelect}
                onClear={handlePropertyHubClear}
                placeholder="Search Property Hub..."
              />
            </Field>
            <Field label="Sharing" error={errors.sharing}>
              <Select value={draft.inventory.sharing} onValueChange={handleSharingChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select sharing…" />
                </SelectTrigger>
                <SelectContent>
                  {sharingOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Room" error={errors.room}>
                <Input value={draft.inventory.roomNumber} onChange={(e) => patchInventory("roomNumber", e.target.value)} placeholder="e.g. 101" />
              </Field>
              <Field label="Bed" error={errors.bed}>
                <Input value={draft.inventory.bedNumber} onChange={(e) => patchInventory("bedNumber", e.target.value)} placeholder="e.g. A" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Rent (₹)" error={errors.rent}>
                <Input type="number" value={draft.rent || ""} onChange={(e) => patch("rent", Number(e.target.value))} placeholder="8000" />
              </Field>
              <Field label="Deposit (₹)" error={errors.deposit}>
                <Input type="number" value={draft.deposit || ""} onChange={(e) => patch("deposit", Number(e.target.value))} placeholder="15000" />
              </Field>
            </div>
            <Field label="Booking Amount (₹)" error={errors.bookingAmt}>
              <Input type="number" value={draft.bookingAmt || ""} onChange={(e) => patch("bookingAmt", Number(e.target.value))} placeholder="5000" />
            </Field>
          </Card>
        </div>

        <Card className="p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Move-in</div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Date" error={errors.moveDate}>
              <Input type="date" value={draft.moveIn.date} onChange={(e) => patchMoveIn("date", e.target.value)} />
            </Field>
            <Field label="Stay (months)" error={errors.stay}>
              <Input type="number" value={draft.moveIn.stayMonths || ""} onChange={(e) => patchMoveIn("stayMonths", Number(e.target.value))} placeholder="12" />
            </Field>
          </div>
        </Card>

        <Card className="p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Special Requests</div>
          <div className="flex flex-wrap gap-1.5">
            {draft.specialRequests.map((r, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                {r}
                <button onClick={() => setDraft((d) => ({ ...d, specialRequests: d.specialRequests.filter((_, j) => j !== i) }))}>
                  <Plus className="h-2.5 w-2.5 rotate-45" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1">
            <Input value={reqDraft} onChange={(e) => setReqDraft(e.target.value)}
              placeholder="Add request…" className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") addReq(reqDraft); }} />
            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => addReq(reqDraft)}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED.filter((s) => !draft.specialRequests.includes(s)).map((s) => (
              <button key={s} onClick={() => addReq(s)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition">
                + {s}
              </button>
            ))}
          </div>
        </Card>

        {Object.keys(errors).length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {Object.values(errors).map((e, i) => <p key={i}>• {e}</p>)}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={!draft.customer.name.trim() || !draft.customer.phone.trim() || !draft.inventory.propertyName.trim()}
            onClick={() => {
              const pg = PGS.find((p) => p.id === pgId);
              const lead = addLead({
                name: draft.customer.name.trim(),
                phone: draft.customer.phone.trim(),
                preferredArea: pg?.area ?? "",
                budget: draft.rent,
                source: "manual",
              });
              setQuoteLead(lead);
              setDraft((d) => ({ ...d, leadId: lead.id }));
              if (pg) {
                const sharingToRoom: Record<string, string> = {
                  single: "Single Sharing", double: "Double Sharing", triple: "Triple Sharing",
                  quad: "Shared", studio: "Private",
                };
                setQuoteInit({
                  pg,
                  roomType: sharingToRoom[draft.inventory.sharing] ?? "Shared",
                  rent: draft.rent,
                  deposit: draft.deposit,
                  roomNumber: draft.inventory.roomNumber,
                  lockIn: `${draft.moveIn.lockInMonths} Months`,
                  notice: `${draft.moveIn.noticeDays} Days`,
                  prebook: draft.bookingAmt,
                });
              }
              setQuoteBuilderOpen(true);
            }} className="h-8 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1" /> Add Quotation
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!isValid} onClick={submit}>Create Booking</Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={quoteBuilderOpen} onOpenChange={(o) => { if (!o) { setQuoteBuilderOpen(false); setQuoteLead(null); setQuoteInit(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
          </DialogHeader>
          {quoteLead && (
            <QuotationBuilder key={quoteInit?.pg?.id ?? "none"} lead={quoteLead} embedded
              initialPg={quoteInit?.pg}
              initialRoomType={quoteInit?.roomType}
              initialActualRent={quoteInit?.rent}
              initialDeposit={quoteInit?.deposit}
              initialRoomNumber={quoteInit?.roomNumber}
              initialLockIn={quoteInit?.lockIn}
              initialNotice={quoteInit?.notice}
              initialPrebook={quoteInit?.prebook}
              onSent={(quote) => { 
                if (quote) {
                  setDraft((d) => ({
                    ...d,
                    rent: quote.discountedPrice || quote.actualRent || d.rent,
                    deposit: quote.deposit || d.deposit,
                    bookingAmt: quote.prebook || d.bookingAmt,
                    inventory: {
                      ...d.inventory,
                      roomNumber: quote.roomNumber || d.inventory.roomNumber,
                    }
                  }));
                }
                setQuoteBuilderOpen(false); 
                setQuoteLead(null); 
                setQuoteInit(null); 
              }} />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
