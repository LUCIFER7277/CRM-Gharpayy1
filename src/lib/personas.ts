/**
 * Persona registry - every named user (HR, Flow Ops, TCM, Owner) has a
 * deep behavioural profile. Coach reads this to tailor messages, and the
 * seed engine reads it to skew each user's day differently.
 *
 * Pure data; no runtime side-effects.
 */
import type { Role } from "./types";

export type CoachTone = "drill-sgt" | "warm-mentor" | "data-nerd" | "hype-friend" | "stoic";
export type Channel = "whatsapp" | "phone" | "email" | "sms" | "in-app";

export interface Persona {
  id: string;
  name: string;
  role: Role;
  /** zone or domain focus shown in HR dashboards */
  focus: string;
  /** how Coach should talk to this person */
  coachTone: CoachTone;
  /** what they already do well */
  strengths: string[];
  /** the gap to coach against */
  weakSpots: string[];
  /** what motivates them - used in greeting variations */
  motivators: string[];
  /** preferred outbound channels (most → least) */
  channels: Channel[];
  /** signature opening line for Coach to riff on */
  signature: string;
  /** their daily ritual sentence */
  ritual: string;
  /** the storyline arc they're in this week */
  arc: string;
  /** mission cap - how many cleared items per day = "complete" for them */
  missionCap: number;
}

const HR: Persona[] = [
  {
    id: "hr-1", name: "Anita Khanna", role: "hr", focus: "People & coaching",
    coachTone: "warm-mentor",
    strengths: ["1:1s", "spotting burnout", "calm under fire"],
    weakSpots: ["delays hard feedback", "lets revenue slip down list"],
    motivators: ["team growth", "retention"],
    channels: ["in-app", "phone", "whatsapp"],
    signature: "How is the team breathing today?",
    ritual: "Reads the war-room board with chai before the 9:30 standup.",
    arc: "Trying to lift Rohan out of his slump without spooking the floor.",
    missionCap: 8,
  },
  {
    id: "hr-2", name: "Vivek Sharma", role: "hr", focus: "Ops & SLAs",
    coachTone: "drill-sgt",
    strengths: ["SLA enforcement", "process design"],
    weakSpots: ["talks past empathy", "low patience for soft signals"],
    motivators: ["zero red boxes", "clean dashboards"],
    channels: ["in-app", "email"],
    signature: "Where are we bleeding minutes?",
    ritual: "Audits the previous day's SLA breaches at 8am sharp.",
    arc: "Rolling out a 90-second first-response rule team-wide.",
    missionCap: 10,
  },
  {
    id: "hr-3", name: "Sara Pillai", role: "hr", focus: "Revenue & forecast",
    coachTone: "data-nerd",
    strengths: ["pipeline math", "weekly forecast"],
    weakSpots: ["over-trusts hot tags", "skips on-the-floor color"],
    motivators: ["beat target", "clean cohorts"],
    channels: ["in-app", "email"],
    signature: "What does the curve say?",
    ritual: "Rebuilds the forecast every Tuesday morning.",
    arc: "Closing the month +12% if Aarav and Neha hold their pace.",
    missionCap: 9,
  },
  {
    id: "hr-4", name: "Kunal Bhatt", role: "hr", focus: "Owners & supply",
    coachTone: "stoic",
    strengths: ["owner relationships", "supply unlocks"],
    weakSpots: ["misses TCM-side fires", "buried in WhatsApp"],
    motivators: ["happy owners", "live inventory"],
    channels: ["whatsapp", "phone", "in-app"],
    signature: "Who needs a call from us today?",
    ritual: "Calls 3 owners every morning in rotation.",
    arc: "Recovering Meera's trust score after a missed visit last week.",
    missionCap: 7,
  },
];

const FLOW_OPS: Persona[] = [
  {
    id: "fo-1", name: "Riya Kapoor", role: "flow-ops", focus: "Inbound triage",
    coachTone: "hype-friend",
    strengths: ["fast routing", "clean handoffs"],
    weakSpots: ["over-routes to Aarav", "skimps on lead notes"],
    motivators: ["clean inbox", "TCMs thanking her"],
    channels: ["in-app", "whatsapp"],
    signature: "Inbox zero by lunch?",
    ritual: "Drains the inbound queue before her first coffee.",
    arc: "Defending a 15-day handoff streak.",
    missionCap: 12,
  },
  {
    id: "fo-2", name: "Aman Joshi", role: "flow-ops", focus: "Tour scheduling",
    coachTone: "warm-mentor",
    strengths: ["calendar Tetris", "owner coordination"],
    weakSpots: ["lets confirmations slide", "double-books in HSR"],
    motivators: ["full calendar", "happy owners"],
    channels: ["in-app", "phone"],
    signature: "What slot can I save today?",
    ritual: "Confirms every tour by 8pm the night before.",
    arc: "Rebuilding Whitefield's Saturday density.",
    missionCap: 10,
  },
  {
    id: "fo-3", name: "Pooja Nair", role: "flow-ops", focus: "Reassignment",
    coachTone: "data-nerd",
    strengths: ["spotting drift", "balance loads"],
    weakSpots: ["slow to escalate", "averse to confrontation"],
    motivators: ["fair loads", "no orphan leads"],
    channels: ["in-app"],
    signature: "Whose plate is too full?",
    ritual: "Runs the assignment heatmap at noon.",
    arc: "Lightening Rohan's load without insulting him.",
    missionCap: 9,
  },
  {
    id: "fo-4", name: "Tushar Rao", role: "flow-ops", focus: "Revival & cold leads",
    coachTone: "stoic",
    strengths: ["patient outreach", "revival sequences"],
    weakSpots: ["chases ghosts too long", "low energy on hot leads"],
    motivators: ["resurrect a cold lead", "cohort revival %"],
    channels: ["whatsapp", "email"],
    signature: "Who is one nudge away from coming back?",
    ritual: "Touches 10 cold leads every afternoon.",
    arc: "Resurrecting the 30-day-stale BTM cohort.",
    missionCap: 8,
  },
];

const TCMS: Persona[] = [
  {
    id: "tcm-1", name: "Aarav Mehta", role: "tcm", focus: "Koramangala · closer",
    coachTone: "hype-friend",
    strengths: ["closing", "objection handling", "reading rooms"],
    weakSpots: ["sloppy notes", "skips post-tour updates when hot"],
    motivators: ["leaderboard #1", "monthly cash bonus"],
    channels: ["whatsapp", "phone"],
    signature: "Who's signing today?",
    ritual: "Lines up 3 close-calls before lunch.",
    arc: "Five closes in the next 3 days = personal best month.",
    missionCap: 6,
  },
  {
    id: "tcm-2", name: "Priya Shah", role: "tcm", focus: "Indiranagar · nurturer",
    coachTone: "warm-mentor",
    strengths: ["second tours", "parents in the loop", "long nurturing"],
    weakSpots: ["over-nurtures past decision date", "soft on price"],
    motivators: ["happy clients", "5-star handoffs"],
    channels: ["whatsapp", "phone"],
    signature: "Who needs a gentle nudge today?",
    ritual: "Reads every lead's last 3 messages before calling.",
    arc: "Convert 2 of her 5 nurtured leads this week or HR will reassign.",
    missionCap: 6,
  },
  {
    id: "tcm-3", name: "Rohan Iyer", role: "tcm", focus: "HSR · improving",
    coachTone: "stoic",
    strengths: ["honest with leads", "good at site walkthroughs"],
    weakSpots: ["slow first-response", "lets follow-ups slip", "anxious closer"],
    motivators: ["one win to break the slump", "respect from peers"],
    channels: ["phone", "in-app"],
    signature: "What's the smallest next step?",
    ritual: "Writes tomorrow's plan before he leaves at 7pm.",
    arc: "Two overdue follow-ups today; Anita is watching closely.",
    missionCap: 5,
  },
  {
    id: "tcm-4", name: "Neha Verma", role: "tcm", focus: "Whitefield · hot streak",
    coachTone: "drill-sgt",
    strengths: ["high-velocity tours", "tight calendar", "no excuses"],
    weakSpots: ["doesn't share wins", "skips peer assists"],
    motivators: ["streak", "outscoring Aarav"],
    channels: ["whatsapp", "phone"],
    signature: "Lock the next slot.",
    ritual: "Books the next 48 hours of tours by 10am.",
    arc: "27-day streak; one missed mission and it resets.",
    missionCap: 7,
  },
];

const OWNERS: Persona[] = [
  {
    id: "own-1", name: "Rakesh Sharma", role: "owner", focus: "Koramangala 5B",
    coachTone: "warm-mentor",
    strengths: ["responsive", "fair pricing"],
    weakSpots: ["last-minute blocks", "hates phone calls"],
    motivators: ["full occupancy", "no surprises"],
    channels: ["whatsapp", "in-app"],
    signature: "Update me when something changes.",
    ritual: "Checks vacant beds twice a day.",
    arc: "Wants 100% occupancy before Diwali.",
    missionCap: 4,
  },
  {
    id: "own-2", name: "Meera Iyer", role: "owner", focus: "Indiranagar 100ft",
    coachTone: "stoic",
    strengths: ["deep maintenance knowledge"],
    weakSpots: ["slow to respond on blocks", "skeptical of TCMs"],
    motivators: ["asset value", "tenant quality"],
    channels: ["phone", "in-app"],
    signature: "Show me the tenant profile first.",
    ritual: "Visits the property every Friday afternoon.",
    arc: "Trust score recovering after a missed visit last week.",
    missionCap: 4,
  },
  {
    id: "own-3", name: "Ankit Verma", role: "owner", focus: "HSR Sector 2",
    coachTone: "data-nerd",
    strengths: ["analytical", "open to dynamic pricing"],
    weakSpots: ["over-negotiates", "blocks rooms for relatives"],
    motivators: ["yield per bed", "data dashboards"],
    channels: ["in-app", "email"],
    signature: "What does the yield look like this month?",
    ritual: "Compares his property to peers every Sunday.",
    arc: "Considering a 2-room block for his nephew - needs nudge.",
    missionCap: 4,
  },
  {
    id: "own-4", name: "Deepa Krishnan", role: "owner", focus: "Whitefield ITPL",
    coachTone: "hype-friend",
    strengths: ["fast block decisions", "tenant-friendly"],
    weakSpots: ["under-prices", "doesn't read the market"],
    motivators: ["smooth ops", "happy tenants"],
    channels: ["whatsapp", "in-app"],
    signature: "Send me the highlights.",
    ritual: "Reviews the dashboard every evening with her family.",
    arc: "Big block of 14 vacancies - needs price + push.",
    missionCap: 4,
  },
];

export const PERSONAS: Persona[] = [...HR, ...FLOW_OPS, ...TCMS, ...OWNERS];

export const PERSONA_BY_ID: Record<string, Persona> =
  Object.fromEntries(PERSONAS.map((p) => [p.id, p]));

/** Find the active persona for a (role, id) pair. Falls back to a synthetic one.
 *  Strict on role match - passing a tcm id while role==='hr' falls back to first hr persona.
 */
export function activePersona(role: Role, id: string | undefined): Persona {
  if (id && PERSONA_BY_ID[id] && PERSONA_BY_ID[id].role === role) return PERSONA_BY_ID[id];
  const first = PERSONAS.find((p) => p.role === role);
  if (first) return first;
  return {
    id: id ?? role,
    name: role,
    role,
    focus: "Generalist",
    coachTone: "warm-mentor",
    strengths: [],
    weakSpots: [],
    motivators: [],
    channels: ["in-app"],
    signature: "What's next?",
    ritual: "-",
    arc: "-",
    missionCap: 6,
  };
}

/* ============================================================== */
/*  Coach copy generators - keyed by tone + persona                */
/* ============================================================== */

export interface CoachVoice {
  greeting: string;
  subline: string;
  missionLine: string;
  playbookTip: string;
}

function pick<T>(arr: T[], seed: number): T { return arr[Math.abs(seed) % arr.length]; }
function dayKey(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 31 + d.getDate();
}

export function voiceFor(p: Persona, missionDone: number, missionTarget: number): CoachVoice {
  const seed = dayKey() + p.id.length;
  const ratio = missionTarget === 0 ? 0 : missionDone / missionTarget;

  const greetings: Record<CoachTone, string[]> = {
    "drill-sgt": [
      `${p.name.split(" ")[0]}. Get to it.`,
      `Stand up, ${p.name.split(" ")[0]}. Today doesn't run itself.`,
      `${p.name.split(" ")[0]} - the clock is on.`,
    ],
    "warm-mentor": [
      `Good to see you, ${p.name.split(" ")[0]}.`,
      `Take a breath, ${p.name.split(" ")[0]}. Then let's begin.`,
      `${p.name.split(" ")[0]}, here's what I noticed.`,
    ],
    "data-nerd": [
      `${p.name.split(" ")[0]}, the numbers want a word.`,
      `Pulled the diff, ${p.name.split(" ")[0]}. Have a look.`,
      `${p.name.split(" ")[0]} - variance is up.`,
    ],
    "hype-friend": [
      `Yo ${p.name.split(" ")[0]}!`,
      `Let's gooo, ${p.name.split(" ")[0]} 🔥`,
      `${p.name.split(" ")[0]}, today is yours.`,
    ],
    "stoic": [
      `${p.name.split(" ")[0]}.`,
      `One step at a time, ${p.name.split(" ")[0]}.`,
      `Begin, ${p.name.split(" ")[0]}.`,
    ],
  };

  const sublineByRatio =
    ratio >= 1   ? `Mission complete. ${p.signature}`
    : ratio >= 0.6 ? `On pace. ${p.signature}`
    : ratio >= 0.3 ? `Behind by a step. ${p.weakSpots[0] ? `Watch the ${p.weakSpots[0]}.` : p.signature}`
    : `Cold start. ${p.weakSpots[0] ? `Don't let ${p.weakSpots[0]} bite again.` : p.signature}`;

  const missionLine =
    p.coachTone === "drill-sgt" ? `Target ${missionTarget}. Done ${missionDone}. No excuses.`
    : p.coachTone === "data-nerd" ? `${missionDone}/${missionTarget} - completion ${Math.round(ratio * 100)}%.`
    : p.coachTone === "hype-friend" ? `${missionDone} of ${missionTarget} - keep the energy 💥`
    : p.coachTone === "stoic" ? `${missionDone}/${missionTarget}.`
    : `${missionDone} done, ${Math.max(0, missionTarget - missionDone)} to go.`;

  const tipsByTone: Record<CoachTone, string[]> = {
    "drill-sgt": [
      `Your weak spot is ${p.weakSpots[0] ?? "speed"}. Fix it before lunch.`,
      `One missed SLA today and the streak resets.`,
    ],
    "warm-mentor": [
      `${p.strengths[0] ? `Lean on your ${p.strengths[0]} today.` : ""} The team is watching.`,
      `Start with the lead that scares you most. The rest gets easier.`,
    ],
    "data-nerd": [
      `Your last 7-day average says you slip after 3pm. Front-load the hard calls.`,
      `${p.weakSpots[0] ? `Cohort tagged "${p.weakSpots[0]}" is dragging your numbers.` : "Watch the variance line."}`,
    ],
    "hype-friend": [
      `${p.motivators[0] ? `Imagine ${p.motivators[0]} when you close this one.` : "You got this."}`,
      `Stack 3 quick wins before noon and momentum carries the rest.`,
    ],
    "stoic": [
      `${p.ritual}`,
      `Pick the smallest action. Do it now.`,
    ],
  };

  return {
    greeting: pick(greetings[p.coachTone], seed),
    subline: sublineByRatio,
    missionLine,
    playbookTip: pick(tipsByTone[p.coachTone], seed + 1),
  };
}
