import type { CheckIn } from "./store";
import { formatINR } from "./store";

export function waBookingConfirm(name: string, property?: string): string {
  return [
    `Hi ${name}! 🎉`,
    `Your booking${property ? ` at *${property}*` : ""} is confirmed.`,
    `Please reply *YES* to confirm and we'll share the token payment link.`,
  ].join("\n");
}

export function waTokenRequest(amount: number, upi = "gharpayy@upi"): string {
  return [
    `Quick step to lock your room 🔒`,
    `Pay token: *${formatINR(amount)}*`,
    `UPI: \`${upi}\``,
    `Send the screenshot once paid. Room blocks the moment we receive it.`,
  ].join("\n");
}

export function waTokenReceipt(c: CheckIn): string {
  return [
    `✅ Received ${formatINR(c.tokenAmount ?? 0)}${c.tokenUpiRef ? ` (Ref: ${c.tokenUpiRef})` : ""}.`,
    `Balance due at check-in: *${formatINR(c.balanceDue)}*`,
    `Blocking your room now — details coming up.`,
  ].join("\n");
}

export function waRoomAssigned(c: CheckIn): string {
  return [
    `🏠 Room assigned!`,
    `${c.propertyName ?? "Property"}${c.roomNumber ? ` · Room ${c.roomNumber}` : ""}`,
    `Rent: ${formatINR(c.rent)}/mo · Deposit: ${formatINR(c.deposit)}`,
    `Pick your check-in date — we'll send the address and key handover details.`,
  ].join("\n");
}

export function waDateConfirm(c: CheckIn): string {
  const d = c.checkInDate ? new Date(c.checkInDate).toDateString() : "your selected date";
  return [
    `📅 Check-in scheduled for *${d}*.`,
    `Balance ${formatINR(c.balanceDue)} payable on arrival.`,
    `We'll send a reminder 24h before.`,
  ].join("\n");
}

export function waMoveInReminder(c: CheckIn): string {
  const d = c.checkInDate ? new Date(c.checkInDate).toDateString() : "tomorrow";
  return [
    `Reminder: check-in on *${d}* 🏠`,
    `Carry: ID proof, ${formatINR(c.balanceDue)} balance, your smile.`,
    `Need to reschedule? Reply RESCHEDULE.`,
  ].join("\n");
}

export function waRescheduleCheckIn(c: CheckIn, reason?: string): string {
  const d = c.checkInDate ? new Date(c.checkInDate).toDateString() : "the new date";
  return [
    `No problem — your check-in is now shifted to *${d}*.`,
    reason ? `Reason noted: ${reason}.` : `Reason noted by our team.`,
    `Room remains blocked as per your token. Balance due: *${formatINR(c.balanceDue)}*.`,
    `Please reply YES to acknowledge the updated check-in date.`,
  ].join("\n");
}

export function waMovedIn(name: string): string {
  return [
    `Welcome home, ${name}! 🥳`,
    `Any issue in the next 7 days — just reply here. We'll fix it fast.`,
  ].join("\n");
}

export function waSettleCheck(name: string): string {
  return [
    `Hi ${name}, one week in! ✨`,
    `Rate your stay so far (1-5) and let us know if anything needs attention.`,
  ].join("\n");
}
