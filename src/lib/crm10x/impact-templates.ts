/**
 * Impact Queue — multi-variant WhatsApp templates.
 * Every scenario carries at least 3 voice/tone variants so the TCM can
 * pick the line that matches the lead's mood and never sends a stale message.
 *
 * All templates accept the same context bag and resolve {placeholders} at
 * render time. Anything unresolved is cleared so messages never leak tokens.
 */
export type ImpactScenario =
  | "tour-confirm"
  | "tour-reminder"
  | "tour-noshow"
  | "quote-followup"
  | "negotiate-hold"
  | "negotiate-alt"
  | "negotiate-floor"
  | "booking-confirm"
  | "revival"
  | "first-touch";

export interface ImpactTplCtx {
  leadName?: string;
  agentName?: string;
  agentPhone?: string;
  propertyName?: string;
  propertyAddress?: string;
  tourWhen?: string;        // human-readable date+time
  roomType?: string;
  price?: number | string;
  altPrice?: number | string;
  area?: string;
  budget?: number | string;
  moveIn?: string;
}

export interface ImpactTpl {
  id: string;
  label: string;     // short pitch like "Warm & friendly"
  vibe: "warm" | "direct" | "urgent" | "premium" | "casual";
  body: string;
}

const fmt = (s: string, ctx: ImpactTplCtx) => {
  const dict = ctx as unknown as Record<string, unknown>;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    dict[k] === undefined || dict[k] === null || dict[k] === ""
      ? ""
      : String(dict[k]),
  );
};

/* ------------------------------------------------------------------ */

export const IMPACT_TEMPLATES: Record<ImpactScenario, ImpactTpl[]> = {
  "first-touch": [
    {
      id: "ft-warm", label: "Warm intro", vibe: "warm",
      body:
        "Hi {leadName}! 👋 This is {agentName} from Gharpayy. I saw you're looking near {area} around ₹{budget}. " +
        "I have 2 strong options that would suit you — want me to share?",
    },
    {
      id: "ft-direct", label: "Get-to-the-point", vibe: "direct",
      body:
        "Hi {leadName}, {agentName} here from Gharpayy. Quick one — are you still looking for a PG in {area}? " +
        "If yes, I can pull 3 vacant rooms in your budget right now.",
    },
    {
      id: "ft-casual", label: "Casual nudge", vibe: "casual",
      body:
        "Hey {leadName}! {agentName} from Gharpayy 🙌 — saw your enquiry. Free for 5 mins on call, or should I drop options on WhatsApp?",
    },
  ],

  "tour-confirm": [
    {
      id: "tc-formal", label: "Confirmation card", vibe: "premium",
      body:
        "Hi {leadName}, your visit is confirmed ✅\n\n📍 {propertyName}\n🗓️ {tourWhen}\n\nYour tour coordinator:\n👤 {agentName}\n📞 {agentPhone}\n\nThey'll receive you at the property. Reply here to reschedule.\n— Team Gharpayy",
    },
    {
      id: "tc-friendly", label: "Friendly heads-up", vibe: "warm",
      body:
        "Hi {leadName}! Just to confirm — {agentName} (📞 {agentPhone}) will be waiting for you at {propertyName} on {tourWhen}. " +
        "Anything you'd like them to keep ready? 🏠",
    },
    {
      id: "tc-direct", label: "Short & direct", vibe: "direct",
      body:
        "{leadName} — visit confirmed.\n{propertyName} · {tourWhen}\nCoordinator: {agentName} ({agentPhone})\nReply STOP to cancel.",
    },
  ],

  "tour-reminder": [
    {
      id: "tr-soft", label: "Soft reminder", vibe: "warm",
      body:
        "Hey {leadName}, looking forward to your visit at {propertyName} on {tourWhen}. {agentName} will be there. " +
        "Ping me if anything changes 🙏",
    },
    {
      id: "tr-urgent", label: "Day-of nudge", vibe: "urgent",
      body:
        "Hi {leadName}! Your visit at {propertyName} is in a few hours ({tourWhen}). " +
        "{agentName} (📞 {agentPhone}) is keeping a slot for you. See you there!",
    },
    {
      id: "tr-route", label: "Route + parking", vibe: "premium",
      body:
        "Hi {leadName}, quick info before your visit at {propertyName} ({tourWhen}):\n• Address: {propertyAddress}\n• Coordinator: {agentName} ({agentPhone})\n• Parking available at the gate.\nSee you soon!",
    },
  ],

  "tour-noshow": [
    {
      id: "ns-empathy", label: "Empathy check-in", vibe: "warm",
      body:
        "Hi {leadName}, we missed you at {propertyName} today. Hope everything's okay 🤞 " +
        "Want me to lock a slot for tomorrow same time?",
    },
    {
      id: "ns-direct", label: "Reschedule prompt", vibe: "direct",
      body:
        "{leadName}, you couldn't make it to {propertyName} today. Should I move you to a new slot or close the file?",
    },
    {
      id: "ns-scarcity", label: "Scarcity nudge", vibe: "urgent",
      body:
        "Hi {leadName}, only 1 room of your type left at {propertyName}. I held it through today's slot — can do one more reschedule, reply YES.",
    },
  ],

  "quote-followup": [
    {
      id: "qf-soft", label: "Soft check-in", vibe: "warm",
      body:
        "Hi {leadName}, did the quotation for {propertyName} make sense? Happy to walk through anything — deposit, lock-in, anything 🙏",
    },
    {
      id: "qf-direct", label: "Direct ask", vibe: "direct",
      body:
        "{leadName} — quick one. Are we moving ahead with {propertyName} at ₹{price}/mo, or should I look at alternates?",
    },
    {
      id: "qf-scarcity", label: "Hold expires", vibe: "urgent",
      body:
        "Hi {leadName}, the room hold at {propertyName} expires soon. If you want it, just reply YES and I'll lock it on your name today.",
    },
  ],

  "negotiate-hold": [
    {
      id: "nh-value", label: "Hold price · add value", vibe: "premium",
      body:
        "{leadName}, I can keep the rent at ₹{price}/mo at {propertyName} — and I'll ensure you get a ground-floor room + priority move-in slot. Fair?",
    },
    {
      id: "nh-warm", label: "Warm hold", vibe: "warm",
      body:
        "Hi {leadName}, I hear you on price. Honestly ₹{price} is the best at {propertyName} for this room — but I'll throw in early check-in and one waived utility bill 🙌",
    },
    {
      id: "nh-direct", label: "Firm but kind", vibe: "direct",
      body:
        "{leadName}, ₹{price} is what I can hold at {propertyName} — anything below changes the room type. Want me to lock this one?",
    },
  ],

  "negotiate-alt": [
    {
      id: "na-warm", label: "Alternate room", vibe: "warm",
      body:
        "{leadName}, I found a smaller room at {propertyName} for ₹{altPrice}/mo — same amenities, just a notch smaller. Want pictures?",
    },
    {
      id: "na-direct", label: "Swap pitch", vibe: "direct",
      body:
        "{leadName}, if ₹{price} is tight — I can shift you to a {roomType} at ₹{altPrice}. Same property, lower rent. Yes or no?",
    },
    {
      id: "na-premium", label: "Nearby property", vibe: "premium",
      body:
        "Hi {leadName}, I have a nearby property in {area} at ₹{altPrice}/mo with similar feel. Sharing details — should I lock a visit?",
    },
  ],

  "negotiate-floor": [
    {
      id: "nf-honest", label: "Honest floor offer", vibe: "direct",
      body:
        "{leadName}, lowest I can go at {propertyName} for this room is ₹{altPrice}/mo. After this it's the floor — beyond my hands. Are we set?",
    },
    {
      id: "nf-warm", label: "One-time courtesy", vibe: "warm",
      body:
        "Hi {leadName}, took it up internally — best they'd agree at {propertyName} is ₹{altPrice}. One-time courtesy because you've been patient. Lock it?",
    },
    {
      id: "nf-urgent", label: "Today only", vibe: "urgent",
      body:
        "{leadName} — ₹{altPrice}/mo at {propertyName}, valid today only. Manager approved. Reply YES and I'll send the booking link.",
    },
  ],

  "booking-confirm": [
    {
      id: "bc-celebrate", label: "Welcome aboard 🎉", vibe: "warm",
      body:
        "Welcome to Gharpayy, {leadName}! 🎉\nYour room at {propertyName} is booked — move-in {moveIn}.\nCoordinator: {agentName} ({agentPhone}).\nReceipt + agreement coming to your email.",
    },
    {
      id: "bc-formal", label: "Formal confirmation", vibe: "premium",
      body:
        "Hi {leadName}, your booking at {propertyName} is confirmed.\nRoom: {roomType}\nMove-in: {moveIn}\nProperty manager: {agentName} ({agentPhone}).\nReply to this thread for anything you need.",
    },
    {
      id: "bc-direct", label: "Quick receipt", vibe: "direct",
      body:
        "Booked ✅ {propertyName} · {roomType} · move-in {moveIn}.\nManager: {agentName} ({agentPhone}). Receipt coming on email.",
    },
  ],

  revival: [
    {
      id: "rv-warm", label: "Soft revival", vibe: "warm",
      body:
        "Hi {leadName}, hope you're well! Wanted to check — still looking for a PG in {area}? Prices have eased a bit, worth another look 🙌",
    },
    {
      id: "rv-direct", label: "Fresh inventory", vibe: "direct",
      body:
        "{leadName}, 2 fresh options in {area} under ₹{budget} just opened. Want me to send?",
    },
    {
      id: "rv-final", label: "Last check", vibe: "urgent",
      body:
        "{leadName}, last check from my side — closing your file today unless you reply. If you're still searching, just say 1 and I'll reopen.",
    },
  ],
};

export function renderImpactTemplate(t: ImpactTpl, ctx: ImpactTplCtx): string {
  return fmt(t.body, ctx);
}

export function impactWaLink(phone: string | undefined, text: string): string {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}
