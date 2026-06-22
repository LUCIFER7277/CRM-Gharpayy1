/**
 * WhatsApp templates v2 - variable interpolation, language pack, A/B variants,
 * and quiet-hours-aware "send-or-defer" wrapping. Pure data + render.
 */
import type { Lead } from "@/contracts";
import { decideSend, fmtIST } from "./timing";

export type Lang = "en" | "hi" | "kn";

export interface Template {
  id: string;
  label: string;
  scenario: "intro" | "tour-confirm" | "tour-followup" | "negotiation-close" | "revival" | "no-show";
  variants: Record<Lang, string>;
}

export const TEMPLATES: Template[] = [
  {
    id: "intro",
    label: "First-touch intro",
    scenario: "intro",
    variants: {
      en: "Hi {{name}}! This is {{agent}} from Gharpayy. Saw you're looking for a place in {{area}} around ₹{{budget}}. I have 3 great options ready - when can we hop on a quick call?",
      hi: "Namaste {{name}}! Main {{agent}}, Gharpayy se. Aap {{area}} mein ₹{{budget}} ka kamra dhoond rahe ho - mere paas 3 zabardast options hain. Kab call kar sakte hain?",
      kn: "Hi {{name}}! Naanu {{agent}}, Gharpayy inda. Neevu {{area}}-nalli ₹{{budget}} kelage room hudukutiddera - nanage 3 olleya options ide. Yaavaaga maatadabeku?",
    },
  },
  {
    id: "tour-confirm",
    label: "Tour confirmation",
    scenario: "tour-confirm",
    variants: {
      en: "Hi {{name}}, confirming your visit to {{pgName}} ({{area}}) at {{tourTime}}. I'll meet you at the gate. Reply Y to confirm.",
      hi: "Hi {{name}}, {{tourTime}} ko {{pgName}} ({{area}}) ki visit confirm hai. Main gate pe milunga. Confirm ke liye Y bhejein.",
      kn: "Hi {{name}}, {{tourTime}} ge {{pgName}} ({{area}}) tour confirm aagide. Naanu gate-nalli sigthini. Confirm madalu Y kalisi.",
    },
  },
  {
    id: "revival",
    label: "Revival nudge",
    scenario: "revival",
    variants: {
      en: "Hi {{name}}, hope you're doing well! Still looking for a place near {{area}}? I just got 2 new options under ₹{{budget}} - want me to share?",
      hi: "Hi {{name}}! {{area}} mein ghar ki talaash abhi bhi hai? Mere paas ₹{{budget}} mein 2 naye options aaye hain - share karu?",
      kn: "Hi {{name}}, {{area}} hattira innu room hudukutiddera? Nange ₹{{budget}} olage 2 hosa options bandide - share maadalaa?",
    },
  },
];

export interface RenderCtx {
  name?: string; agent?: string; area?: string; budget?: number;
  pgName?: string; tourTime?: string;
  [k: string]: string | number | undefined;
}
export function renderTemplate(tplId: string, lang: Lang, ctx: RenderCtx): string {
  const tpl = TEMPLATES.find((t) => t.id === tplId);
  if (!tpl) return "";
  const raw = tpl.variants[lang] || tpl.variants.en;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = ctx[k];
    if (v == null) return `{{${k}}}`;
    if (typeof v === "number") return v.toLocaleString("en-IN");
    return String(v);
  });
}

export function pitchForLead(lead: Lead, tplId: string, lang: Lang = "en", agentName = "Gharpayy"): string {
  return renderTemplate(tplId, lang, {
    name: lead.name.split(" ")[0],
    agent: agentName,
    area: lead.preferredArea,
    budget: lead.budget,
  });
}

/** Decide if a message should be sent now or scheduled - IST quiet-hours aware. */
export function planSend(): { sendNow: boolean; banner: string } {
  const d = decideSend();
  if (d.send) return { sendNow: true, banner: "Within business hours - sending now" };
  return { sendNow: false, banner: `Quiet hours · will send at ${d.deferUntil ? fmtIST(d.deferUntil) : "-"} (${d.deferMins}m)` };
}
