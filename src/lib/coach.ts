/**
 * Coach engine - talks to every user.
 *
 * For the current role + user, computes:
 *   - done    : actions completed today (from activity log)
 *   - missed  : SLA breaches that need recovery
 *   - todo    : ranked next actions
 *   - how     : step-by-step guidance keyed by action type
 *   - mission : daily target progress (for streak/XP)
 *
 * Pure functions. Depends on existing engine + types.
 */
import type {
  ActivityLog, FollowUp, Lead, Role, TCM, Tour, Booking,
} from "./types";
import { buildDoNextQueue, slaForPostTour, SLA, liveConfidence } from "./engine";
import { activePersona, voiceFor } from "./personas";

export type CoachKind =
  | "post-tour-overdue"
  | "follow-up-overdue"
  | "follow-up-today"
  | "no-follow-up"
  | "first-response"
  | "tour-today"
  | "hot-untouched"
  | "owner-room-stale"
  | "owner-block-pending"
  | "flowops-handoff-unread"
  | "flowops-reassign-stuck";

export interface CoachItem {
  id: string;
  kind: CoachKind;
  title: string;       // short headline
  why: string;         // one-line reason
  leadId?: string;
  tourId?: string;
  score: number;       // higher = do first
  /** XP awarded when user clears this item */
  xp: number;
}

export interface DoneItem {
  id: string;
  ts: string;
  text: string;
  xp: number;
}

export interface CoachMission {
  /** target number of actions to clear today to keep the streak */
  target: number;
  /** how many actions cleared today */
  done: number;
  /** XP earned today */
  xpToday: number;
  /** rolling % of completion (0-100) */
  pct: number;
}

export interface CoachReport {
  greeting: string;
  subline: string;
  /** persona's signature opening line - shown as a quiet caption */
  signature: string;
  /** the storyline arc this user is in this week */
  arc: string;
  /** persona-specific tactical hint for the day */
  playbookTip: string;
  done: DoneItem[];
  missed: CoachItem[];
  todo: CoachItem[];
  mission: CoachMission;
}

/* ============== HOW-TO LIBRARY ============== */

export interface HowToStep {
  step: string;
  hint?: string;
}

export const HOW_TO: Record<CoachKind, { goal: string; steps: HowToStep[] }> = {
  "post-tour-overdue": {
    goal: "Close the post-tour loop within 1 hour.",
    steps: [
      { step: "Open the lead and tap Post-tour update." },
      { step: "Pick the outcome - booked / thinking / not-interested.", hint: "Be honest. The system scores you on truthfulness, not on optimism." },
      { step: "Log the real objection in the client's words." },
      { step: "Set the next follow-up date - never leave it blank." },
      { step: "Submit. Confidence and the owner's bars update automatically." },
    ],
  },
  "follow-up-overdue": {
    goal: "Recover an overdue follow-up before silence kills the deal.",
    steps: [
      { step: "Tap Call. Don't WhatsApp first - voice wins back trust." },
      { step: "If no answer in 2 rings, send the recovery WhatsApp template." },
      { step: "Log the call and set the next follow-up. Always set the next follow-up." },
      { step: "If the lead has been silent 48h+, also start the cold-revival sequence." },
    ],
  },
  "follow-up-today": {
    goal: "Land today's follow-up before end of day.",
    steps: [
      { step: "Open the lead and skim the last note + objection." },
      { step: "Call first. Use WhatsApp only as a backup." },
      { step: "Update intent and confidence based on the conversation." },
      { step: "Always set the next follow-up before closing the lead." },
    ],
  },
  "no-follow-up": {
    goal: "Every active lead must have a next follow-up - no exceptions.",
    steps: [
      { step: "Open the lead. Use Quick Schedule (1d / 3d / 7d)." },
      { step: "Choose priority based on intent - Hot=High, Warm=Medium." },
      { step: "Add a one-line reason so future-you knows what to say." },
    ],
  },
  "first-response": {
    goal: "Respond to a brand-new lead inside 5 minutes.",
    steps: [
      { step: "Tap Call now. First-touch speed is the #1 conversion lever." },
      { step: "If no pickup, send the first-contact WhatsApp template." },
      { step: "Capture budget + move-in + preferred area in 60 seconds." },
      { step: "Schedule a tour or set a same-day follow-up." },
    ],
  },
  "tour-today": {
    goal: "Make sure today's tour actually happens.",
    steps: [
      { step: "Reconfirm with the client 2 hours before." },
      { step: "Verify the property has the room ready (check Owner status)." },
      { step: "Reach the location 5 minutes early. Send a 'I'm here' photo." },
      { step: "After the tour - fill the post-tour form within 1 hour." },
    ],
  },
  "hot-untouched": {
    goal: "A HOT lead with no recent touch = leaking money.",
    steps: [
      { step: "Call within the next 15 minutes." },
      { step: "Offer two tour slots in the next 48 hours, not one." },
      { step: "If the client objects on price, log the objection - don't argue." },
    ],
  },
  "owner-room-stale": {
    goal: "Keep your room status fresh so you don't lose tours.",
    steps: [
      { step: "Open Update Rooms." },
      { step: "Mark each room Vacant / Occupied / Blocked with today's date." },
      { step: "Add photos if anything changed - even small repairs." },
    ],
  },
  "owner-block-pending": {
    goal: "Approve or decline pending block requests within 24h.",
    steps: [
      { step: "Open Block Requests." },
      { step: "Review the requested room + dates + tenant." },
      { step: "Approve, decline with reason, or counter-propose another room." },
    ],
  },
  "flowops-handoff-unread": {
    goal: "Read TCM handoffs same-day - they're escalations, not FYIs.",
    steps: [
      { step: "Open Handoffs." },
      { step: "For each unread item, read context and reply or reassign." },
      { step: "Mark read once acted on - silence here breaks the team loop." },
    ],
  },
  "flowops-reassign-stuck": {
    goal: "Reassign leads that have been stuck >3 days with no action.",
    steps: [
      { step: "Open the lead." },
      { step: "Use Auto-assign - the engine picks by zone + load + conversion." },
      { step: "Add a one-line reason. The new TCM gets an auto-handoff." },
    ],
  },
};

/* ============== XP TABLE ============== */

const XP: Record<CoachKind, number> = {
  "post-tour-overdue": 25,
  "follow-up-overdue": 20,
  "first-response": 25,
  "tour-today": 15,
  "follow-up-today": 10,
  "no-follow-up": 8,
  "hot-untouched": 18,
  "owner-room-stale": 12,
  "owner-block-pending": 15,
  "flowops-handoff-unread": 10,
  "flowops-reassign-stuck": 14,
};

/* ============== INPUTS ============== */

export interface CoachInput {
  role: Role;
  currentTcmId: string;
  tcms: TCM[];
  leads: Lead[];
  tours: Tour[];
  followUps: FollowUp[];
  activities: ActivityLog[];
  bookings: Booking[];
  handoffs: { id: string; leadId: string; to: Role; read: boolean; ts: string }[];
  ownerSignals?: {
    staleRooms: number;       // rooms not updated in 7d
    pendingBlocks: number;    // pending block requests
  };
  now: number;
}

/* ============== MAIN ============== */

export function buildCoachReport(input: CoachInput): CoachReport {
  const {
    role, currentTcmId, tcms, leads, tours, followUps,
    activities, bookings, handoffs, ownerSignals, now,
  } = input;

  const filterTcm = role === "tcm" ? currentTcmId : undefined;

  /* DONE today - from activity log, role-aware */
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todaysActivities = activities.filter((a) => +new Date(a.ts) >= +startOfDay);
  const myDone = todaysActivities.filter((a) => {
    if (role === "tcm") return a.actor === currentTcmId;
    if (role === "flow-ops") return a.actor === "flow-ops";
    if (role === "hr") return a.actor === "hr" || a.kind === "decision_logged";
    if (role === "owner") return a.actor === "owner";
    return false;
  });

  const done: DoneItem[] = myDone
    .filter((a) => isWinAction(a.kind))
    .slice(0, 12)
    .map((a) => ({ id: a.id, ts: a.ts, text: a.text, xp: xpForActivity(a.kind) }));

  // Bookings closed today add a big win
  const todaysBookings = bookings.filter((b) => +new Date(b.ts) >= +startOfDay);
  todaysBookings.forEach((b) => {
    if (role === "tcm" && b.tcmId !== currentTcmId) return;
    if (role === "owner") return;
    done.unshift({
      id: b.id,
      ts: b.ts,
      text: `Deal closed · ₹${Math.round(b.amount).toLocaleString("en-IN")}/mo`,
      xp: 100,
    });
  });

  /* TODO + MISSED - from engine queue */
  const queue = buildDoNextQueue(leads, tours, followUps, now, filterTcm);
  const queueItems: CoachItem[] = queue.map((q) => {
    const lead = leads.find((l) => l.id === q.leadId);
    const name = lead?.name ?? "Lead";
    return {
      id: `${q.kind}:${q.leadId}`,
      kind: q.kind as CoachKind,
      title: titleFor(q.kind as CoachKind, name, lead),
      why: q.reason,
      leadId: q.leadId,
      score: q.score,
      xp: XP[q.kind as CoachKind] ?? 10,
    };
  });

  // HOT untouched - leads w/ intent hot and silent >12h
  leads
    .filter((l) => (!filterTcm || l.assignedTcmId === filterTcm) && l.intent === "hot" && l.stage !== "booked" && l.stage !== "dropped")
    .forEach((l) => {
      const silentH = (now - +new Date(l.updatedAt)) / 36e5;
      if (silentH >= 12) {
        queueItems.push({
          id: `hot-untouched:${l.id}`,
          kind: "hot-untouched",
          title: `${l.name} is HOT - ${Math.round(silentH)}h of silence`,
          why: `Live score ${liveConfidence(l, tours, now)} · last touch ${Math.round(silentH)}h ago`,
          leadId: l.id,
          score: 950,
          xp: XP["hot-untouched"],
        });
      }
    });

  // FLOW-OPS only: unread handoffs, stuck reassignments
  if (role === "flow-ops") {
    const unread = handoffs.filter((h) => h.to === "flow-ops" && !h.read);
    if (unread.length > 0) {
      queueItems.push({
        id: `handoff-unread`,
        kind: "flowops-handoff-unread",
        title: `${unread.length} unread handoff${unread.length === 1 ? "" : "s"}`,
        why: "TCMs need a reply to keep the loop closed.",
        score: 850,
        xp: XP["flowops-handoff-unread"] * unread.length,
      });
    }
    leads
      .filter((l) => l.stage === "new" || l.stage === "contacted")
      .forEach((l) => {
        const ageD = (now - +new Date(l.createdAt)) / (24 * 36e5);
        if (ageD >= SLA.reassignDays) {
          queueItems.push({
            id: `reassign:${l.id}`,
            kind: "flowops-reassign-stuck",
            title: `${l.name} stuck ${Math.round(ageD)}d - reassign`,
            why: `Lead has not advanced past "${l.stage}" in ${Math.round(ageD)} days.`,
            leadId: l.id,
            score: 720,
            xp: XP["flowops-reassign-stuck"],
          });
        }
      });
  }

  // OWNER signals
  if (role === "owner" && ownerSignals) {
    if (ownerSignals.pendingBlocks > 0) {
      queueItems.push({
        id: "owner-blocks",
        kind: "owner-block-pending",
        title: `${ownerSignals.pendingBlocks} block request${ownerSignals.pendingBlocks === 1 ? "" : "s"} pending`,
        why: "Approve or decline within 24h to keep visit pipeline alive.",
        score: 900,
        xp: XP["owner-block-pending"] * ownerSignals.pendingBlocks,
      });
    }
    if (ownerSignals.staleRooms > 0) {
      queueItems.push({
        id: "owner-rooms",
        kind: "owner-room-stale",
        title: `${ownerSignals.staleRooms} room${ownerSignals.staleRooms === 1 ? "" : "s"} not updated in 7d`,
        why: "Stale rooms get hidden from new tour matches.",
        score: 650,
        xp: XP["owner-room-stale"],
      });
    }
  }

  // De-dup + split into MISSED (SLA breach) vs TODO (still on time)
  const seen = new Set<string>();
  const ranked = queueItems
    .sort((a, b) => b.score - a.score)
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });

  const missedKinds = new Set<CoachKind>([
    "post-tour-overdue",
    "follow-up-overdue",
    "no-follow-up",
    "first-response",
    "hot-untouched",
    "flowops-reassign-stuck",
    "owner-room-stale",
  ]);

  const missed = ranked.filter((i) => missedKinds.has(i.kind));
  const todo = ranked.filter((i) => !missedKinds.has(i.kind));

  // Also, post-tour breach hard signal
  tours.forEach((t) => {
    if (filterTcm && t.tcmId !== filterTcm) return;
    if (slaForPostTour(t, now) === "breach" && !missed.find((m) => m.tourId === t.id)) {
      const lead = leads.find((l) => l.id === t.leadId);
      missed.unshift({
        id: `post-tour-hard:${t.id}`,
        kind: "post-tour-overdue",
        title: `${lead?.name ?? "Lead"} - post-tour 6h+ overdue`,
        why: "Hard SLA breach. Auto-escalation triggered.",
        leadId: t.leadId,
        tourId: t.id,
        score: 1200,
        xp: XP["post-tour-overdue"],
      });
    }
  });

  /* MISSION (persona-aware target) */
  const persona = activePersona(role, role === "tcm" ? currentTcmId : undefined);
  const target = persona.missionCap || missionTargetFor(role);
  const doneCount = done.length;
  const xpToday = done.reduce((s, d) => s + d.xp, 0);
  const pct = Math.min(100, Math.round((doneCount / target) * 100));

  /* GREETING - driven by persona voice, with situational override on misses */
  const voice = voiceFor(persona, doneCount, target);
  const greeting = voice.greeting;
  const subline =
    missed.length > 0
      ? `${missed.length} miss${missed.length === 1 ? "" : "es"} to recover · ${todo.length} on deck.`
      : voice.subline;

  return {
    greeting,
    subline,
    signature: persona.signature,
    arc: persona.arc,
    playbookTip: voice.playbookTip,
    done,
    missed,
    todo,
    mission: { target, done: doneCount, xpToday, pct },
  };
}

/* ============== HELPERS ============== */

function isWinAction(kind: ActivityLog["kind"]): boolean {
  return (
    kind === "follow_up_done" ||
    kind === "post_tour_filled" ||
    kind === "tour_completed" ||
    kind === "decision_logged" ||
    kind === "call_logged" ||
    kind === "tour_scheduled" ||
    kind === "follow_up_set"
  );
}

function xpForActivity(kind: ActivityLog["kind"]): number {
  switch (kind) {
    case "post_tour_filled": return 25;
    case "follow_up_done":   return 15;
    case "tour_completed":   return 20;
    case "decision_logged":  return 18;
    case "tour_scheduled":   return 10;
    case "follow_up_set":    return 6;
    case "call_logged":      return 4;
    default:                 return 2;
  }
}

function missionTargetFor(role: Role): number {
  switch (role) {
    case "tcm":          return 8;
    case "flow-ops":     return 12;
    case "hr":           return 6;
    case "owner":        return 3;
    case "super-admin":  return 10;
    default:             return 6;
  }
}

function titleFor(kind: CoachKind, name: string, lead?: Lead): string {
  switch (kind) {
    case "post-tour-overdue":   return `Fill post-tour for ${name}`;
    case "follow-up-overdue":   return `Recover follow-up · ${name}`;
    case "follow-up-today":     return `Follow up with ${name} today`;
    case "no-follow-up":        return `Set next follow-up for ${name}`;
    case "first-response":      return `First response · ${name}`;
    case "tour-today":          return `Tour today · ${name}`;
    case "hot-untouched":       return `Touch ${name} now (HOT)`;
    default:                    return `${name}${lead?.intent === "hot" ? " (HOT)" : ""}`;
  }
}

/* ============== STREAK ============== */

/**
 * Streak logic: a day "counts" if mission.done >= 1.
 * Persisted in localStorage by gamification store.
 */
export function computeNewStreak(
  prevStreak: number,
  prevDateISO: string | null,
  todayISO: string,
  todayHasWin: boolean,
): { streak: number; lastWinDate: string | null } {
  if (!todayHasWin) return { streak: prevStreak, lastWinDate: prevDateISO };
  if (!prevDateISO) return { streak: 1, lastWinDate: todayISO };
  if (prevDateISO === todayISO) return { streak: prevStreak, lastWinDate: prevDateISO };

  const prev = new Date(prevDateISO);
  const today = new Date(todayISO);
  const diffDays = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate())) /
      (24 * 36e5),
  );
  if (diffDays === 1) return { streak: prevStreak + 1, lastWinDate: todayISO };
  return { streak: 1, lastWinDate: todayISO };
}

/* ============== BADGES ============== */

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  earned: boolean;
  hint: string;
}

export function computeBadges(
  xp: number,
  streak: number,
  bookingsClosed: number,
): Badge[] {
  return [
    { id: "spark",     label: "First Spark",      emoji: "✦",  earned: xp >= 50,         hint: "Earn 50 XP" },
    { id: "rhythm",    label: "Rhythm",           emoji: "♪",  earned: streak >= 3,      hint: "3-day streak" },
    { id: "engine",    label: "Engine",           emoji: "⚡", earned: streak >= 7,      hint: "7-day streak" },
    { id: "closer",    label: "Closer",           emoji: "✓",  earned: bookingsClosed >= 1, hint: "Close 1 deal" },
    { id: "rainmaker", label: "Rainmaker",        emoji: "★",  earned: bookingsClosed >= 5, hint: "Close 5 deals" },
    { id: "veteran",   label: "Veteran",          emoji: "◆",  earned: xp >= 1000,       hint: "Earn 1,000 XP" },
  ];
}
