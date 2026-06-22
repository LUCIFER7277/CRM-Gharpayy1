import type { Lead, Property, TCM, Tour } from "@/lib/types";

export const OFFICE_PHONE = "+91 98800 77033";

function fmtINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export function tourScheduledMessage(p: Property, whenISO: string) {
  return [
    `Your tour is *scheduled* ✅`,
    ``,
    `🏠 ${p.name}`,
    `📍 ${p.area}`,
    `🗓 ${fmtWhen(whenISO)}`,
    `💰 ${fmtINR(p.pricePerBed)}/mo onwards`,
    ``,
    `Please *call us 20 min prior* on ${OFFICE_PHONE} so we can keep the room ready for you.`,
    ``,
    `— Team Gharpayy`,
  ].join("\n");
}

export function tourReminderMessage(p: Property, whenISO: string) {
  return [
    `Reminder ⏰`,
    ``,
    `Your tour at *${p.name}* (${p.area}) is at ${fmtWhen(whenISO)}.`,
    `Please call ${OFFICE_PHONE} 20 min before reaching.`,
  ].join("\n");
}

export function quoteMessage(p: Property, monthly: number) {
  return [
    `Quotation for *${p.name}* (${p.area})`,
    ``,
    `Monthly: ${fmtINR(monthly)}`,
    `Deposit: ${fmtINR(monthly)}`,
    ``,
    `To confirm or visit, call ${OFFICE_PHONE}.`,
  ].join("\n");
}

export function negotiateMessage(p: Property, offer: number) {
  return [
    `Special hold for *${p.name}* (${p.area})`,
    ``,
    `Rate: *${fmtINR(offer)}/mo* — valid 24h.`,
    ``,
    `Call ${OFFICE_PHONE} to lock the room.`,
  ].join("\n");
}

export function checkinMessage(p: Property) {
  return [
    `Your *check-in* at ${p.name} (${p.area}) is being scheduled.`,
    ``,
    `Please share your preferred date & time, or call ${OFFICE_PHONE}.`,
  ].join("\n");
}

export function leadLine(lead: Lead, tcm?: TCM) {
  return [
    lead.name,
    lead.phone,
    lead.preferredArea || "—",
    fmtINR(lead.budget) + "/mo",
    lead.stage,
    tcm ? `TCM: ${tcm.name}` : "",
  ].filter(Boolean).join(" · ");
}

export function leadsBlock(leads: Lead[], tcms: TCM[], title = "Leads") {
  const rows = leads.map((l, i) => {
    const tcm = tcms.find((t) => t.id === l.assignedTcmId);
    return `${i + 1}. ${leadLine(l, tcm)}`;
  });
  return [`*${title}* (${leads.length})`, ...rows].join("\n");
}

export function tourLine(t: Tour, lead?: Lead, p?: Property, tcm?: TCM) {
  return [
    lead?.name ?? "Lead",
    lead?.phone ?? "",
    p?.name ?? "Property",
    p?.area ?? "",
    fmtWhen(t.scheduledAt),
    tcm ? `TCM: ${tcm.name}` : "",
  ].filter(Boolean).join(" · ");
}

export function toursBlock(
  tours: Tour[],
  leads: Lead[],
  properties: Property[],
  tcms: TCM[],
  title = "Tours today",
) {
  const rows = tours.map((t, i) => {
    const l = leads.find((x) => x.id === t.leadId);
    const p = properties.find((x) => x.id === t.propertyId);
    const tcm = tcms.find((x) => x.id === t.tcmId);
    return `${i + 1}. ${tourLine(t, l, p, tcm)}`;
  });
  return [`*${title}* (${tours.length})`, ...rows].join("\n");
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function waLink(phone: string, text: string) {
  const clean = phone.replace(/\D/g, "");
  const num = clean.length === 10 ? `91${clean}` : clean;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/* =====================================================================
   VISIT WAR ROOM — copy-paste blocks (one per lifecycle moment).
   ===================================================================== */

export interface VisitCopyCtx {
  leadName?: string;
  leadPhone?: string;
  propertyName: string;
  propertyArea: string;
  scheduledAt: number;
  mapsLink?: string;
  pricePerBed?: number;
}

function mapsLinkFor(area: string, propertyName: string) {
  const q = encodeURIComponent(`${propertyName} ${area} Bangalore`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function whenIN(ms: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(ms));
}

export function visitBlock(c: VisitCopyCtx) {
  return [
    `🏠 *${c.propertyName}* · ${c.propertyArea}`,
    `🗓 ${whenIN(c.scheduledAt)}`,
    c.pricePerBed ? `💰 ${fmtINR(c.pricePerBed)}/mo onwards` : "",
    ``,
    `📍 ${c.mapsLink ?? mapsLinkFor(c.propertyArea, c.propertyName)}`,
    `📞 Please call ${OFFICE_PHONE} 20 min before reaching.`,
    ``,
    `— Team Gharpayy`,
  ].filter(Boolean).join("\n");
}

export function visitReminderBlock(c: VisitCopyCtx, kind: "t60" | "t15") {
  const head = kind === "t15"
    ? `⏰ Your visit starts in ~15 min`
    : `⏰ Reminder · visit in ~1 hour`;
  return [
    head, ``,
    `🏠 ${c.propertyName} · ${c.propertyArea}`,
    `🗓 ${whenIN(c.scheduledAt)}`,
    `📍 ${c.mapsLink ?? mapsLinkFor(c.propertyArea, c.propertyName)}`,
    `📞 ${OFFICE_PHONE}`,
  ].join("\n");
}

export function visitReachedBlock(c: VisitCopyCtx) {
  return [
    `We're at *${c.propertyName}* gate now ✅`,
    `Come over whenever you reach — we'll keep the room ready.`,
    ``, `📞 ${OFFICE_PHONE}`,
  ].join("\n");
}

export function visitOngoingBlock(c: VisitCopyCtx) {
  return [
    `Hope you're liking the tour at *${c.propertyName}* 🏠`,
    `Anything you'd like us to show you again — rooms, common area, kitchen?`,
    ``, `📞 ${OFFICE_PHONE}`,
  ].join("\n");
}

export function visitDoneBlock(c: VisitCopyCtx) {
  return [
    `Thanks for visiting *${c.propertyName}* today! 🙏`,
    ``,
    `If you'd like, we can lock the room with a 2-hour hold — just call ${OFFICE_PHONE}.`,
    `Happy to share quote or alternative options too.`,
  ].join("\n");
}

export function hotLeadBlock(c: VisitCopyCtx) {
  return [
    `Quick check on *${c.propertyName}* —`,
    `we still have your room blocked. Want us to confirm it?`,
    ``,
    `📞 ${OFFICE_PHONE} · we can wrap this up in 2 min.`,
  ].join("\n");
}

export function tokenRequestBlock(c: VisitCopyCtx, amount = 2000) {
  return [
    `To lock your room at *${c.propertyName}*:`,
    `💳 Pre-book token: ${fmtINR(amount)}`,
    `Fully adjusted in your first month's rent.`,
    ``,
    `Call ${OFFICE_PHONE} and we'll share the payment link.`,
  ].join("\n");
}

export function revivalBlock(c: VisitCopyCtx) {
  return [
    `Quick one 👋`,
    `New rooms just opened at *${c.propertyName}* (${c.propertyArea}) this week.`,
    `Still on the lookout? Call ${OFFICE_PHONE} — we'll line up 2-3 options.`,
  ].join("\n");
}

export function ownerNotifyBlock(args: {
  propertyName: string;
  event: "scheduled" | "started" | "reached" | "completed" | "booked" | "objection";
  whenMs: number;
  reaction?: string;
  objectionCategory?: string;
}) {
  const tag = ({
    scheduled: "📅 New visit scheduled",
    started:   "🚶 Customer on the way",
    reached:   "✅ Customer reached property",
    completed: "🏁 Visit complete",
    booked:    "🎉 Room booked",
    objection: "⚠️ Concern raised",
  } as const)[args.event];
  return [
    `${tag} · *${args.propertyName}*`,
    `🕒 ${whenIN(args.whenMs)}`,
    args.reaction ? `Customer reaction: ${args.reaction}` : "",
    args.objectionCategory ? `Concern category: ${args.objectionCategory}` : "",
    ``,
    `(Customer identity withheld — Team Gharpayy)`,
  ].filter(Boolean).join("\n");
}

export function hrCoachBlock(args: {
  tcmName: string;
  leadName: string;
  propertyName: string;
  issue: string;
  suggestion?: string;
}) {
  return [
    `👋 ${args.tcmName} — quick coach note`,
    `Lead: ${args.leadName} · ${args.propertyName}`,
    ``,
    `Issue: ${args.issue}`,
    args.suggestion ? `Try: ${args.suggestion}` : "",
  ].filter(Boolean).join("\n");
}
