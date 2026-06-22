import type { LangPref } from "./types";

export type TemplateStage =
  | "first-intro"
  | "follow-up"
  | "visit-confirm"
  | "post-visit"
  | "price-offer"
  | "booking-confirm"
  | "check-in-welcome"
  | "revival-30d"
  | "revival-60d"
  | "revival-90d"
  // ── Non-responder / scenario library ──
  | "ghost-1-soft"
  | "ghost-2-direct"
  | "ghost-3-final"
  | "no-pickup-1"
  | "no-pickup-callback"
  | "switched-off"
  | "comparing-others"
  | "price-stall"
  | "weekend-nudge"
  | "late-night-recap"
  | "shifting-postponed"
  | "parents-pending"
  | "visit-noshow"
  | "visit-rescheduled"
  | "shortlist-final-2"
  | "scarcity-last-bed"
  | "festive-offer";

interface TemplateBody {
  en: string;
  hi: string;
}

export type TemplateGroup = "core" | "non-responder" | "scenario" | "revival";

export const WA_TEMPLATES: Record<
  TemplateStage,
  { label: string; group: TemplateGroup; body: TemplateBody }
> = {
  // ── Core lifecycle ──
  "first-intro": {
    label: "First intro",
    group: "core",
    body: {
      en: "Hi {name}, this is {agent} from Gharpayy. We have great PG options near {area} within ₹{budget}. Free for a quick call?",
      hi: "नमस्ते {name}, मैं {agent} Gharpayy से। {area} के पास ₹{budget} में बढ़िया PG हैं। क्या call कर सकते हैं?",
    },
  },
  "follow-up": {
    label: "Follow-up",
    group: "core",
    body: {
      en: "Hi {name}, just checking in. Want me to share 2 strong options that fit your budget?",
      hi: "नमस्ते {name}, क्या PG ढूंढ़ रहे हैं? 2 बढ़िया options भेज दूँ?",
    },
  },
  "visit-confirm": {
    label: "Visit confirm",
    group: "core",
    body: {
      en: "Hi {name}, confirming your visit at {property} on {date} at {time}. Reply YES to confirm.",
      hi: "नमस्ते {name}, {date} को {time} बजे {property} में visit confirm है। YES reply करें।",
    },
  },
  "post-visit": {
    label: "Post-visit check-in",
    group: "core",
    body: {
      en: "Hi {name}, hope you liked {property}. Any questions? I can hold a bed for 24h if you're decided.",
      hi: "नमस्ते {name}, {property} पसंद आया? कोई सवाल हो तो बताएं। 24 घंटे के लिए bed hold कर दूँ?",
    },
  },
  "price-offer": {
    label: "Price offer",
    group: "core",
    body: {
      en: "{name}, special offer for you at {property}: ₹{price}/mo all-inclusive. Valid till tomorrow only.",
      hi: "{name}, {property} में special offer: ₹{price}/महीना all-inclusive। कल तक valid।",
    },
  },
  "booking-confirm": {
    label: "Booking confirm",
    group: "core",
    body: {
      en: "Welcome aboard, {name}! Your room at {property} is booked. Receipt + agreement coming on email.",
      hi: "स्वागत है {name}! {property} में room book हो गया। Receipt और agreement email पर आएगा।",
    },
  },
  "check-in-welcome": {
    label: "Check-in welcome",
    group: "core",
    body: {
      en: "Hi {name}, your check-in at {property} is today. Manager: {phone}. Anything you need?",
      hi: "नमस्ते {name}, आज {property} में check-in है। Manager: {phone}। कुछ चाहिए तो बताएं।",
    },
  },

  // ── Non-responder ladder (3 escalating touches) ──
  "ghost-1-soft": {
    label: "Ghost #1 · soft",
    group: "non-responder",
    body: {
      en: "Hi {name}, didn't hear back - totally fine if timing changed. Should I pause or keep options ready?",
      hi: "नमस्ते {name}, reply नहीं आया - कोई बात नहीं। options रखूँ या pause कर दूँ?",
    },
  },
  "ghost-2-direct": {
    label: "Ghost #2 · direct",
    group: "non-responder",
    body: {
      en: "{name}, last 2 messages went unread. One reply (Yes / No / Later) and I'll act accordingly. Saves both of us time 🙏",
      hi: "{name}, पिछले 2 messages unread हैं। बस एक reply (Yes / No / Later) - आगे उसी से चलूँगा/चलूँगी।",
    },
  },
  "ghost-3-final": {
    label: "Ghost #3 · final",
    group: "non-responder",
    body: {
      en: "{name}, closing your file today unless I hear back. If you're still searching just reply 1 - I'll reopen.",
      hi: "{name}, आज file close कर रहा/रही हूँ। अब भी search कर रहे हैं तो बस 1 reply करें - फिर से खोल दूँगा/दूँगी।",
    },
  },
  "no-pickup-1": {
    label: "Call not picked",
    group: "non-responder",
    body: {
      en: "Hi {name}, tried calling - couldn't reach. Sharing options on WhatsApp so you can see them anytime.",
      hi: "नमस्ते {name}, call try की - uthi नहीं। WhatsApp पर options भेज रहा/रही हूँ, कभी भी देख लीजिए।",
    },
  },
  "no-pickup-callback": {
    label: "Suggest callback time",
    group: "non-responder",
    body: {
      en: "Hi {name}, what's a good time to call you today? Even 5 minutes is enough.",
      hi: "नमस्ते {name}, आज call के लिए कौन सा time ठीक रहेगा? 5 मिनट काफी है।",
    },
  },
  "switched-off": {
    label: "Phone off",
    group: "non-responder",
    body: {
      en: "Hi {name}, your number was unreachable. Drop me a 👍 here when you're free and I'll call back.",
      hi: "नमस्ते {name}, आपका number switched-off था। free हों तो 👍 भेज दीजिए, मैं call करूँगा/करूँगी।",
    },
  },

  // ── Scenario-specific ──
  "comparing-others": {
    label: "Comparing other PGs",
    group: "scenario",
    body: {
      en: "{name}, fair to compare. Send me the other PG's price + room and I'll do an honest side-by-side - no pressure.",
      hi: "{name}, compare करना सही है। दूसरे PG का price + room भेजिए, मैं honest comparison बना दूँगा/दूँगी।",
    },
  },
  "price-stall": {
    label: "Price stall",
    group: "scenario",
    body: {
      en: "{name}, on price - what number works for you for the room you liked? Let me see what I can do at {property}.",
      hi: "{name}, बजट कितना तक comfortable है? {property} पर कोशिश करता/करती हूँ।",
    },
  },
  "weekend-nudge": {
    label: "Weekend nudge",
    group: "scenario",
    body: {
      en: "Hi {name}, weekend is the best time to visit - quiet, manager available. Slot at {property} on Sat or Sun?",
      hi: "नमस्ते {name}, weekend visit के लिए best रहता है। Sat या Sun {property} में slot लूँ?",
    },
  },
  "late-night-recap": {
    label: "Late-night recap",
    group: "scenario",
    body: {
      en: "Hi {name}, sending today's options before you sleep so you can decide tomorrow morning. Sweet dreams!",
      hi: "नमस्ते {name}, आज के options भेज रहा/रही हूँ - सुबह decide कर लीजिए। शुभ रात्रि!",
    },
  },
  "shifting-postponed": {
    label: "Shifting moved to next month",
    group: "scenario",
    body: {
      en: "Hi {name}, no problem if shifting moved - I've updated your file to {date}. Same options will be re-checked closer to date.",
      hi: "नमस्ते {name}, shifting date {date} पर update कर दी है। उस वक़्त options फिर check कर लूँगा/लूँगी।",
    },
  },
  "parents-pending": {
    label: "Awaiting parents",
    group: "scenario",
    body: {
      en: "Hi {name}, totally fine to discuss with parents. Want me to share a 2-min property video they can see?",
      hi: "नमस्ते {name}, parents से बात कर लीजिए। एक 2 मिनट का video भेज दूँ - वो भी देख लें?",
    },
  },
  "visit-noshow": {
    label: "Visit no-show",
    group: "scenario",
    body: {
      en: "Hi {name}, missed you at {property} today. Everything okay? Want to reschedule for tomorrow?",
      hi: "नमस्ते {name}, आज {property} में visit miss हो गई। सब ठीक है? कल reschedule कर दूँ?",
    },
  },
  "visit-rescheduled": {
    label: "Visit rescheduled",
    group: "scenario",
    body: {
      en: "Done - your visit is now on {date} at {time}. Manager will be ready. See you then!",
      hi: "Done - visit अब {date} {time} पर है। Manager तैयार रहेंगे। मिलते हैं!",
    },
  },
  "shortlist-final-2": {
    label: "Final-2 shortlist",
    group: "scenario",
    body: {
      en: "{name}, narrowed it to 2 winners for you. Tell me which one resonates and I'll lock the bed.",
      hi: "{name}, आपके लिए 2 final options हैं। बताइए कौन सा पसंद है, bed lock कर दूँ।",
    },
  },
  "scarcity-last-bed": {
    label: "Last-bed scarcity",
    group: "scenario",
    body: {
      en: "{name}, {property} has only 1 bed left in your room type. Want me to hold it for 24h on your name?",
      hi: "{name}, {property} में आपके room type की सिर्फ़ 1 bed बची है। 24 घंटे hold कर दूँ?",
    },
  },
  "festive-offer": {
    label: "Festive offer",
    group: "scenario",
    body: {
      en: "Hi {name}, festive offer this week: 1 month deposit waived at {property}. Worth a quick visit?",
      hi: "नमस्ते {name}, इस week festive offer है: {property} पर 1 month deposit waive। visit करें?",
    },
  },

  // ── Revival ladder ──
  "revival-30d": {
    label: "Revival 30d",
    group: "revival",
    body: {
      en: "Hi {name}, it's been a month. Still looking? Prices in {area} just dropped - worth another look?",
      hi: "नमस्ते {name}, एक महीना हो गया। PG ढूंढ़ रहे हैं? {area} में rates कम हुए हैं।",
    },
  },
  "revival-60d": {
    label: "Revival 60d",
    group: "revival",
    body: {
      en: "Hi {name}, 2 fresh options in {area} just opened up under ₹{budget}. Want to see them?",
      hi: "नमस्ते {name}, {area} में ₹{budget} में 2 नए options हैं। देखना चाहेंगे?",
    },
  },
  "revival-90d": {
    label: "Revival 90d",
    group: "revival",
    body: {
      en: "{name}, last check - if you still need a PG, I have a verified place in {area} for ₹{budget}.",
      hi: "{name}, आख़िरी बार - अगर PG चाहिए तो {area} में ₹{budget} में verified जगह है।",
    },
  },
};

export interface TemplateContext {
  name: string;
  agent: string;
  area: string;
  budget: number | string;
  property?: string;
  date?: string;
  time?: string;
  price?: number | string;
  phone?: string;
}

export function renderTemplate(
  stage: TemplateStage,
  lang: LangPref = "english",
  ctx: TemplateContext,
): string {
  const tpl = WA_TEMPLATES[stage];
  const body = lang === "hindi" ? tpl.body.hi : tpl.body.en;
  const dict = ctx as unknown as Record<string, unknown>;
  return body.replace(/\{(\w+)\}/g, (_, k) => String(dict[k] ?? `{${k}}`));
}

export function waLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
