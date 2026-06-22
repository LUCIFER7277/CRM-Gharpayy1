/**
 * 100X Date-Anchored Lead Execution — script template library.
 * Every message from the spec is encoded here. Templates are matched by
 * (phase, anchor, dayOffset, condition) by the execution engine.
 *
 * Variables: {{name}} {{agent}} {{area}} {{portal}} {{budget}} {{property}}
 *            {{time}} {{address}} {{date}} {{month}} {{altArea}} {{altProperty}}
 *            {{price}} {{strength}}
 */

export type ScriptAnchor = "L" | "T" | "CI";
export type ScriptTimeBucket = "morning" | "afternoon" | "evening" | "any";
export type ScriptCondition =
  | "first-touch"
  | "from-portal"
  | "budget-known"
  | "replied"
  | "no-reply"
  | "shortlist"
  | "objection-photos"
  | "objection-thinking"
  | "objection-rates"
  | "objection-price"
  | "objection-location"
  | "objection-size"
  | "objection-family"
  | "no-show"
  | "no-show-3h"
  | "post-visit-good"
  | "post-visit-unsure"
  | "post-visit-comparing"
  | "post-visit-eod"
  | "hot"
  | "warm"
  | "cold"
  | "last-window"
  | "final-close"
  | "ci-drip";

export type ScriptFollowUpKind =
  | "message"
  | "call"
  | "visit-confirm"
  | "close-attempt"
  | "escalation";

export interface ScriptTemplate {
  id: string;
  phase: 1 | 2 | 3 | 4;
  anchor: ScriptAnchor;
  dayOffset: number;             // L+0, T-2, CI-7 → 0, -2, -7
  timeBucket: ScriptTimeBucket;
  condition?: ScriptCondition;
  label: string;
  body: string;
  followUpKind: ScriptFollowUpKind;
}

export const SCRIPTS: ScriptTemplate[] = [
  // ───────── PHASE 1 ─────────
  {
    id: "L0-1A",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "any",
    condition: "first-touch",
    label: "L+0 · Standard opener",
    body:
      "Hi {{name}}, this is {{agent}} from Gharpayy. You were looking for a PG in {{area}} — I have a few options ready that match your budget and move-in date. Can I share them?",
    followUpKind: "message",
  },
  {
    id: "L0-1B",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "any",
    condition: "from-portal",
    label: "L+0 · Portal-sourced opener",
    body:
      "Hi {{name}}, saw your enquiry on {{portal}} for a PG in {{area}}. I'm {{agent}} from Gharpayy — we have verified PGs in that area with immediate availability. Want me to shortlist 3 options for you right now?",
    followUpKind: "message",
  },
  {
    id: "L0-1C",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "any",
    condition: "budget-known",
    label: "L+0 · Budget-aware opener",
    body:
      "Hi {{name}}, this is {{agent}} from Gharpayy. You mentioned a budget of ₹{{budget}} for {{area}} — I have exactly what you're looking for. Sharing options in a moment.",
    followUpKind: "message",
  },
  {
    id: "L0-shortlist",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "any",
    condition: "replied",
    label: "L+0 · Send 3 shortlisted options",
    body:
      "Here are the best 3 options for you in {{area}}:\n\n[Property A] — ₹{{price}}/month | 1 differentiating line\n[Property B] — ₹{{price}}/month | 1 differentiating line\n[Property C] — ₹{{price}}/month | 1 differentiating line\n\nAll are verified, move-in ready. Want to visit any of these today or tomorrow?",
    followUpKind: "close-attempt",
  },
  {
    id: "L0-no-reply",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "afternoon",
    condition: "no-reply",
    label: "L+0 · 1hr nudge (no reply)",
    body:
      "{{name}}, whenever you get a chance — I've shortlisted some PGs in {{area}} that fit your budget. Takes 2 minutes to look. Want me to send them over?",
    followUpKind: "message",
  },
  {
    id: "L0-eod",
    phase: 1, anchor: "L", dayOffset: 0, timeBucket: "evening",
    label: "L+0 · End-of-day check",
    body:
      "{{name}}, quick check before I wrap up — are you still looking for a PG in {{area}}? I can hold a visit slot for you for tomorrow morning if that works. Just say yes and I'll confirm it.",
    followUpKind: "close-attempt",
  },
  {
    id: "L1-morning-replied",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "morning",
    condition: "replied",
    label: "L+1 · Morning (had replied)",
    body:
      "{{name}}, good morning. Did you get a chance to check the options I sent? Which one caught your eye? I can book your visit for today itself.",
    followUpKind: "close-attempt",
  },
  {
    id: "L1-morning-never",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "morning",
    condition: "no-reply",
    label: "L+1 · Morning (never replied)",
    body:
      "{{name}}, good morning. I know you're probably busy — just wanted to make sure the options I have for {{area}} are still relevant. Your move-in is {{month}}, right? I have rooms available for that date.",
    followUpKind: "message",
  },
  {
    id: "L1-afternoon",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "afternoon",
    label: "L+1 · Afternoon scarcity push",
    body:
      "{{name}}, I'll be straight — I have 2 other people looking at the same properties in {{area}} this week. I'd hate for you to miss out because of timing. Can we fix a visit for tomorrow? Takes 20 minutes, you'll know immediately if it's right for you.",
    followUpKind: "close-attempt",
  },
  {
    id: "L1-obj-photos",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "any",
    condition: "objection-photos",
    label: "L+1 · Objection: send photos first",
    body:
      "I'll send photos right now — but just so you know, photos don't show the actual room size, the building, the neighborhood feel. The visit is what actually helps you decide. Let me send photos and book the visit simultaneously?",
    followUpKind: "message",
  },
  {
    id: "L1-obj-thinking",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "any",
    condition: "objection-thinking",
    label: "L+1 · Objection: I'll let you know",
    body:
      "Of course. Can I ask — what are you figuring out in the meantime? Budget, location, timing? If I know what's holding you back, I can sort it before the visit itself.",
    followUpKind: "message",
  },
  {
    id: "L1-obj-rates",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "any",
    condition: "objection-rates",
    label: "L+1 · Objection: share your rates",
    body:
      "Sharing them right now. The range in {{area}} is ₹X to ₹Y depending on the room type. What's your max comfortable number? I'll filter accordingly.",
    followUpKind: "message",
  },
  {
    id: "L1-evening",
    phase: 1, anchor: "L", dayOffset: 1, timeBucket: "evening",
    label: "L+1 · Last touch of day",
    body:
      "{{name}}, last message from me today. If tomorrow works for a visit, just reply with a time — morning or evening — and I'll confirm everything. If your situation changed and you're no longer looking, just let me know. Either way works for me.",
    followUpKind: "message",
  },
  {
    id: "L2-morning",
    phase: 1, anchor: "L", dayOffset: 2, timeBucket: "morning",
    label: "L+2 · Last active push",
    body:
      "{{name}}, good morning. Two days since we connected — I want to give this one more shot before I stop following up. Are you still looking for a PG in {{area}}?\n\nIf yes — let me book a visit for you today.\nIf not — just say so and I won't bother you again.",
    followUpKind: "close-attempt",
  },
  {
    id: "L2-afternoon",
    phase: 1, anchor: "L", dayOffset: 2, timeBucket: "afternoon",
    condition: "replied",
    label: "L+2 · Afternoon — fix a time",
    body:
      "{{name}}, let's just fix a time right now. Today evening or tomorrow morning — which works? I'll send the address and everything once you confirm.",
    followUpKind: "close-attempt",
  },
  {
    id: "L3-cold",
    phase: 1, anchor: "L", dayOffset: 7, timeBucket: "any",
    condition: "ci-drip",
    label: "L+7 · Cold re-touch (warm only)",
    body:
      "{{name}}, checking in after some time. Still looking for a PG in {{area}}? Availability changes week to week — I can give you a fresh list if you're still in the market.",
    followUpKind: "message",
  },

  // ───────── PHASE 2 ─────────
  {
    id: "T-confirm",
    phase: 2, anchor: "T", dayOffset: -99, timeBucket: "any",
    label: "Tour confirmation (immediate)",
    body:
      "Confirmed! Your visit to {{property}} is scheduled for {{date}} at {{time}}.\n\nAddress: {{address}}\n\nI'll be your point of contact for the visit. Save this number. If anything comes up, message me directly and we'll sort it.",
    followUpKind: "visit-confirm",
  },
  {
    id: "T-2",
    phase: 2, anchor: "T", dayOffset: -2, timeBucket: "any",
    label: "T-2 · Two days before",
    body:
      "{{name}}, your visit to {{property}} is in 2 days — {{date}} at {{time}}. Just checking in to make sure nothing changed on your end. If you need to reschedule, better to do it now so we can lock another slot quickly.",
    followUpKind: "visit-confirm",
  },
  {
    id: "T-1",
    phase: 2, anchor: "T", dayOffset: -1, timeBucket: "evening",
    label: "T-1 · Day before (6-8 PM)",
    body:
      "{{name}}, see you tomorrow at {{time}} at {{property}}. Here's the address one more time: {{address}}.\n\nA few things to keep in mind:\nParking is available [yes/no].\nThe visit takes about 20-25 minutes.\nBring your ID if you want to proceed with booking on the spot — we can sort the paperwork same day.\n\nLooking forward to showing you the place.",
    followUpKind: "visit-confirm",
  },
  {
    id: "T0-morning",
    phase: 2, anchor: "T", dayOffset: 0, timeBucket: "morning",
    label: "T-0 morning · 2h before",
    body:
      "{{name}}, good morning. See you today at {{time}} at {{property}}. I'll be there — message me if you're running late or need directions. {{address}}",
    followUpKind: "visit-confirm",
  },
  {
    id: "T0-no-show-30",
    phase: 2, anchor: "T", dayOffset: 0, timeBucket: "any",
    condition: "no-show",
    label: "T-0 · No-show after 30 min",
    body:
      "{{name}}, I'm at {{property}} — did something come up? Happens. Want to reschedule for this evening or tomorrow? Just let me know and I'll lock it right now.",
    followUpKind: "escalation",
  },
  {
    id: "T0-no-show-3h",
    phase: 2, anchor: "T", dayOffset: 0, timeBucket: "any",
    condition: "no-show-3h",
    label: "T-0 · No-show after 3h",
    body:
      "{{name}}, no problem if today didn't work. I've kept your slot open — want to visit tomorrow? Takes 5 seconds to confirm.",
    followUpKind: "escalation",
  },

  // ───────── PHASE 3 ─────────
  {
    id: "T0-post-good",
    phase: 3, anchor: "T", dayOffset: 0, timeBucket: "any",
    condition: "post-visit-good",
    label: "T+0 · Post-visit (went well)",
    body:
      "{{name}}, great meeting you today. How did you find {{property}}? Most people decide the same day they visit — the room is still fresh, the price is locked, and the process takes about 10 minutes. Want to go ahead?",
    followUpKind: "close-attempt",
  },
  {
    id: "T0-post-unsure",
    phase: 3, anchor: "T", dayOffset: 0, timeBucket: "any",
    condition: "post-visit-unsure",
    label: "T+0 · Post-visit (unsure)",
    body:
      "{{name}}, I know you're still thinking it over. What was the one thing that didn't feel right? Tell me honestly — if it's fixable, I'll fix it. If it's not, I'd rather you know now than waste your time.",
    followUpKind: "close-attempt",
  },
  {
    id: "T0-post-comparing",
    phase: 3, anchor: "T", dayOffset: 0, timeBucket: "any",
    condition: "post-visit-comparing",
    label: "T+0 · Post-visit (comparing)",
    body:
      "{{name}}, totally makes sense. How many more places are you visiting? Once you've seen them, tell me what you found — I'll be straight with you about how {{property}} stacks up.",
    followUpKind: "message",
  },
  {
    id: "T0-post-eod",
    phase: 3, anchor: "T", dayOffset: 0, timeBucket: "evening",
    condition: "post-visit-eod",
    label: "T+0 · EOD if no response",
    body:
      "{{name}}, hope the visit was useful. If you have any questions about {{property}} — price, safety, rules, anything — just ask. I'd rather answer questions than have you decide without full information.",
    followUpKind: "message",
  },
  {
    id: "T1-hot",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "morning",
    condition: "hot",
    label: "T+1 · HOT lead",
    body:
      "{{name}}, good morning. Ready to lock the room? I can have everything sorted for you in one go — booking confirmation, agreement details, move-in logistics. Just say yes.",
    followUpKind: "close-attempt",
  },
  {
    id: "T1-warm",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "morning",
    condition: "warm",
    label: "T+1 · WARM lead",
    body:
      "{{name}}, good morning. Did you visit any other places yesterday? Where did things land? I want to make sure you have the full picture before you decide.",
    followUpKind: "message",
  },
  {
    id: "T1-cold",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "morning",
    condition: "cold",
    label: "T+1 · COLD lead",
    body:
      "{{name}}, just checking in. Is {{area}} still the right location for you, or did something change? Happy to explore other neighborhoods if needed.",
    followUpKind: "message",
  },
  {
    id: "T1-obj-price",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "afternoon",
    condition: "objection-price",
    label: "T+1 · Objection: price",
    body:
      "{{name}}, I hear you on the budget. Can I ask — what's the max you're genuinely comfortable with? Not the ideal, the actual max. Once I know that, I can see what I can do on my end.",
    followUpKind: "message",
  },
  {
    id: "T1-obj-location",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "afternoon",
    condition: "objection-location",
    label: "T+1 · Objection: location",
    body:
      "{{name}}, how important is the exact location vs the commute time? Because I have properties in {{altArea}} that are 10 minutes away and ₹X cheaper. Want me to show you?",
    followUpKind: "message",
  },
  {
    id: "T1-obj-size",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "afternoon",
    condition: "objection-size",
    label: "T+1 · Objection: room size/amenity",
    body:
      "{{name}}, the thing about {{property}} is {{strength}}. But if that specific issue is a dealbreaker, I have {{altProperty}} which fixes that — want to visit that one before you decide?",
    followUpKind: "message",
  },
  {
    id: "T1-obj-family",
    phase: 3, anchor: "T", dayOffset: 1, timeBucket: "afternoon",
    condition: "objection-family",
    label: "T+1 · Objection: family approval",
    body:
      "Completely understand. When's a good time for them to see the place? I can arrange a second visit — even a video call if they're in another city. Let's make it easy for them.",
    followUpKind: "message",
  },
  {
    id: "T2-morning",
    phase: 3, anchor: "T", dayOffset: 2, timeBucket: "morning",
    condition: "last-window",
    label: "T+2 · One-day hold warning",
    body:
      "{{name}}, I want to be direct with you. The room at {{property}} that you visited — I can hold it for one more day, but after that I have to open it up. If you're serious about {{area}} and {{month}} move-in, today or tomorrow is the decision point.\n\nWhat's the one thing that needs to be resolved for you to say yes?",
    followUpKind: "close-attempt",
  },
  {
    id: "T2-evening",
    phase: 3, anchor: "T", dayOffset: 2, timeBucket: "evening",
    label: "T+2 · Evening close-out",
    body:
      "{{name}}, last message on this room. Closing it out tomorrow morning. If you want it, reply tonight. If not — no hard feelings, I'll look for something else for you when you're ready.",
    followUpKind: "close-attempt",
  },
  {
    id: "T3-final",
    phase: 3, anchor: "T", dayOffset: 3, timeBucket: "any",
    condition: "final-close",
    label: "T+3 · Final ask",
    body:
      "{{name}}, I know I've been following up — I'll stop after this. But I want to ask you directly: is there something I got wrong? Wrong property, wrong price, wrong timing? If yes, tell me and I'll fix it. If everything was right and you just need more time — how much time?",
    followUpKind: "close-attempt",
  },

  // ───────── PHASE 4 — CI drip ─────────
  ...([
    [-30, "CI-30 · One month out",
      "{{name}}, your move-in month is coming up — {{month}}. Just checking if you've sorted your accommodation yet. If you're still looking in {{area}}, things are available now. Closer to the date, options narrow down fast."],
    [-21, "CI-21 · 3 weeks",
      "{{name}}, 3 weeks to {{month}}. Have you locked a place? I have fresh availability in {{area}} — if you want an updated list, I'll send it right now."],
    [-14, "CI-14 · 2 weeks",
      "{{name}}, 2 weeks to move-in. This is usually when people start getting anxious about not having a place locked. If you're still searching, tell me your non-negotiables — I'll match against what's available today and send you only the ones that actually fit."],
    [-10, "CI-10 · 10 days",
      "{{name}}, 10 days left. Rooms at your budget in {{area}} — I'm checking today's availability as I send this. This is genuinely the last window before it becomes a scramble. Want me to send what's open right now?"],
    [-7, "CI-7 · 1 week",
      "{{name}}, one week. If you haven't locked a place yet, this needs to happen today or tomorrow — not because I'm pushing you, but because move-in-ready rooms with your preferences in {{area}} are running thin. Reply and I'll sort it in one conversation."],
    [-5, "CI-5 · 5 days",
      "{{name}}, 5 days. I've been following up for a while and I respect your time — so I'll make this simple. If you need a PG in {{area}} for {{month}} move-in, reply right now. I'll handle everything. If your plans changed, just say so — I'll stop reaching out."],
    [-3, "CI-3 · 3 days",
      "{{name}}, 3 days to move-in. If you don't have a room yet, this is a real problem and I can help solve it today. What's your situation right now?"],
    [-1, "CI-1 · 1 day",
      "{{name}}, moving tomorrow? If you still need a room, reply now. I'll make it happen today."],
  ] as const).map(([off, label, body]) => ({
    id: `CI${off}`,
    phase: 4 as const, anchor: "CI" as const, dayOffset: off, timeBucket: "any" as const,
    condition: "ci-drip" as const,
    label, body,
    followUpKind: off <= -3 ? ("close-attempt" as const) : ("message" as const),
  })),
];

/** Fill `{{name}}` / `{{area}}` etc. against a lead-shaped record. */
export function renderScript(
  body: string,
  vars: Record<string, string | number | undefined>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null || v === "" ? `{{${key}}}` : String(v);
  });
}

export function findScript(id: string): ScriptTemplate | undefined {
  return SCRIPTS.find((s) => s.id === id);
}
