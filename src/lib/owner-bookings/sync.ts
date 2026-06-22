import type { Lead } from "@/lib/types";
import type { Quotation } from "@/lib/crm10x/quotations";
import { PGS } from "@/property-genius/data/pgs";
import type { PG } from "@/property-genius/data/types";
import { ownerCodeForPG } from "@/property-genius/lib/roles";
import type {
  Gender, Occupation, PaymentLine, SharingType, RoomCategory, SpecialRequest,
} from "./types";

export type SyncSource = "lead" | "property" | "quotation" | "manual" | "default";

export interface BookingDraft {
  customer: {
    name: string; phone: string; gender: Gender; occupation: Occupation;
    companyOrCollege: string; emergencyName: string; emergencyPhone: string;
  };
  inventory: {
    propertyId: string; propertyName: string; floor: string;
    roomNumber: string; bedNumber: string; sharing: SharingType; category: RoomCategory;
  };
  ownerId: string;
  rent: number;
  deposit: number;
  bookingAmt: number;
  otherCharges: number;
  moveIn: { date: string; time: string; stayMonths: number; lockInMonths: number; noticeDays: number };
  specialRequests: string[];
  source: Record<string, SyncSource>;
  leadId?: string;
}

export function emptyDraft(): BookingDraft {
  return {
    customer: { name: "", phone: "", gender: "male", occupation: "working",
      companyOrCollege: "", emergencyName: "", emergencyPhone: "" },
    inventory: { propertyId: "", propertyName: "", floor: "", roomNumber: "",
      bedNumber: "A", sharing: "double", category: "ac" },
    ownerId: "",
    rent: 12000, deposit: 12000, bookingAmt: 5000, otherCharges: 0,
    moveIn: {
      date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
      time: "11:00", stayMonths: 11, lockInMonths: 3, noticeDays: 30,
    },
    specialRequests: [],
    source: {},
    leadId: undefined,
  };
}

function parseSharing(roomType: string): SharingType {
  const r = roomType.toLowerCase();
  if (r.includes("single")) return "single";
  if (r.includes("double")) return "double";
  if (r.includes("triple")) return "triple";
  if (r.includes("quad")) return "quad";
  if (r.includes("studio")) return "studio";
  return "double";
}

export function applyLead(d: BookingDraft, lead: Lead | undefined): BookingDraft {
  if (!lead) return d;
  const next = { ...d, source: { ...d.source } };
  next.customer = {
    ...next.customer,
    name: lead.name,
    phone: lead.phone,
  };
  if (lead.moveInDate) {
    const iso = new Date(lead.moveInDate).toISOString().slice(0, 10);
    next.moveIn = { ...next.moveIn, date: iso };
    next.source["moveIn.date"] = "lead";
  }
  next.source["customer.name"] = "lead";
  next.source["customer.phone"] = "lead";
  return next;
}

export function applyProperty(d: BookingDraft, pg: PG | undefined): BookingDraft {
  if (!pg) return d;
  const next = { ...d, source: { ...d.source } };
  next.inventory = {
    ...next.inventory,
    propertyId: pg.id,
    propertyName: pg.actualName || pg.name,
  };
  next.ownerId = ownerCodeForPG(pg.id);
  const pickRent =
    next.inventory.sharing === "single" ? pg.prices.single :
    next.inventory.sharing === "double" ? pg.prices.double :
    next.inventory.sharing === "triple" ? pg.prices.triple :
    null;
  if (pickRent) {
    next.rent = pickRent;
    next.deposit = pickRent;
    next.source["rent"] = "property";
    next.source["deposit"] = "property";
  }
  next.source["inventory.propertyName"] = "property";
  next.source["inventory.propertyId"] = "property";
  next.source["ownerId"] = "property";
  return next;
}

export function applyQuotation(d: BookingDraft, q: Quotation | undefined): BookingDraft {
  if (!q) return d;
  const next = { ...d, source: { ...d.source } };
  next.rent = q.discountedPrice || q.actualRent || next.rent;
  next.deposit = q.deposit || next.deposit;
  next.bookingAmt = q.prebook || next.bookingAmt;
  if (q.roomNumber) next.inventory = { ...next.inventory, roomNumber: q.roomNumber };
  if (q.roomType) next.inventory = { ...next.inventory, sharing: parseSharing(q.roomType) };
  const lockMatch = q.lockIn?.match(/\d+/);
  const noticeMatch = q.notice?.match(/\d+/);
  if (lockMatch) next.moveIn = { ...next.moveIn, lockInMonths: parseInt(lockMatch[0], 10) };
  if (noticeMatch) next.moveIn = { ...next.moveIn, noticeDays: parseInt(noticeMatch[0], 10) };
  if (q.propertyId && !next.inventory.propertyId) {
    next.inventory = { ...next.inventory, propertyId: q.propertyId, propertyName: q.propertyName };
    next.source["inventory.propertyName"] = "quotation";
    next.ownerId = ownerCodeForPG(q.propertyId) || next.ownerId;
  }
  next.source["rent"] = "quotation";
  next.source["deposit"] = "quotation";
  next.source["bookingAmt"] = "quotation";
  if (q.roomNumber) next.source["inventory.roomNumber"] = "quotation";
  return next;
}

export function draftToCreateInput(
  d: BookingDraft, opts: { leadId?: string; createdBy?: string } = {},
) {
  const payments: PaymentLine[] = [
    { id: "p1", label: "Booking Amount", amount: d.bookingAmt, status: "received", receivedAt: new Date().toISOString() },
    { id: "p2", label: "Security Deposit", amount: d.deposit, status: "pending" },
    { id: "p3", label: "First Month Rent", amount: d.rent, status: "pending" },
  ];
  if (d.otherCharges > 0) payments.push({ id: "p4", label: "Other Charges", amount: d.otherCharges, status: "pending" });
  const sr: SpecialRequest[] = d.specialRequests.map((t, i) => ({ id: `sr-${i}`, text: t }));
  return {
    customer: d.customer,
    inventory: d.inventory,
    ownerId: d.ownerId || "own-1",
    rent: d.rent,
    deposit: d.deposit,
    payments,
    moveIn: {
      date: new Date(`${d.moveIn.date}T${d.moveIn.time}:00`).toISOString(),
      time: d.moveIn.time,
      stayMonths: d.moveIn.stayMonths,
      lockInMonths: d.moveIn.lockInMonths,
      noticeDays: d.moveIn.noticeDays,
    },
    specialRequests: sr,
    leadId: opts.leadId,
    createdBy: opts.createdBy ?? "ops",
  };
}

export const SOURCE_LABEL: Record<SyncSource, string> = {
  lead: "Lead",
  property: "Property Hub",
  quotation: "Quotation",
  manual: "Manual",
  default: "Default",
};

export const SOURCE_TONE: Record<SyncSource, string> = {
  lead: "border-sky-500/50 text-sky-700 dark:text-sky-300 bg-sky-500/10",
  property: "border-violet-500/50 text-violet-700 dark:text-violet-300 bg-violet-500/10",
  quotation: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  manual: "border-amber-500/50 text-amber-700 dark:text-amber-300 bg-amber-500/10",
  default: "border-border text-muted-foreground bg-muted/40",
};
