/**
 * WhatsApp Sequence Engine.
 *
 * Declarative state machine. Each sequence is a list of steps with offsets
 * and templates. Lead replies or stage changes auto-stop the sequence.
 *
 * Pure read layer - the store owns mutation. We compute "what step is next"
 * from a `startedAt` timestamp + step list.
 */
import type { Lead, Tour } from "./types";

export type SequenceKind = "post-tour" | "pre-decision" | "cold-revival" | "first-contact";

export interface SequenceStep {
  /** offset hours from sequence start */
  offsetHrs: number;
  label: string;
  template: string;
}

export const SEQUENCES: Record<SequenceKind, { name: string; steps: SequenceStep[] }> = {
  "first-contact": {
    name: "First contact",
    steps: [
      { offsetHrs: 0, label: "Hi", template: "Hi! I'm from Gharpayy. Saw your enquiry. When are you planning to move?" },
      { offsetHrs: 4, label: "Nudge", template: "Just checking in - happy to share photos and pricing for your area." },
      { offsetHrs: 24, label: "Last try", template: "One last note - these properties move fast. Should I hold a slot for you?" },
    ],
  },
  "post-tour": {
    name: "Post-tour",
    steps: [
      { offsetHrs: 1, label: "Check-in", template: "Hi! How did you find the property? Anything I can clarify?" },
      { offsetHrs: 24, label: "T+1", template: "Following up on yesterday's tour - any questions before you decide?" },
      { offsetHrs: 48, label: "Scarcity", template: "Heads-up: only 2 beds left at this rate. Want me to hold one?" },
      { offsetHrs: 72, label: "Last call", template: "Closing the file in 24h unless we hear back. Still interested?" },
    ],
  },
  "pre-decision": {
    name: "Pre-decision",
    steps: [
      { offsetHrs: 0, label: "Soft", template: "Hi! Decision day soon - anything blocking you?" },
      { offsetHrs: 12, label: "Help", template: "Happy to set up a call with the property manager if it helps." },
    ],
  },
  "cold-revival": {
    name: "Cold revival",
    steps: [
      { offsetHrs: 0, label: "Wake", template: "Hi! New inventory just landed in your area. Want to see it?" },
      { offsetHrs: 48, label: "Drop", template: "Limited-time: ₹1k off this week if you book by Sunday." },
    ],
  },
};

export interface ActiveSequence {
  leadId: string;
  kind: SequenceKind;
  startedAt: string; // ISO
  currentStep: number; // 0-indexed
  paused: boolean;
  stoppedReason?: string;
}

export interface SequenceState {
  sequence: ActiveSequence;
  totalSteps: number;
  nextStep: SequenceStep | null;
  nextAtMs: number | null;
  isComplete: boolean;
}

export function evaluateSequence(seq: ActiveSequence, now: number): SequenceState {
  const def = SEQUENCES[seq.kind];
  const elapsed = (now - +new Date(seq.startedAt)) / 36e5;
  const dueIdx = def.steps.findIndex((s) => s.offsetHrs > elapsed);
  const isComplete = dueIdx === -1;
  const nextStep = isComplete ? null : def.steps[dueIdx];
  const nextAtMs = nextStep ? +new Date(seq.startedAt) + nextStep.offsetHrs * 36e5 : null;
  return {
    sequence: seq,
    totalSteps: def.steps.length,
    nextStep,
    nextAtMs,
    isComplete,
  };
}

/** Auto-stop signals: stage changed to booked/dropped, or any reply (note/message inbound). */
export function shouldAutoStop(seq: ActiveSequence, lead: Lead, tours: Tour[]): string | null {
  if (lead.stage === "booked") return "Booked";
  if (lead.stage === "dropped") return "Dropped";
  if (seq.kind === "post-tour") {
    const tour = tours.find((t) => t.leadId === lead.id && t.status === "completed");
    if (tour?.postTour.outcome === "booked") return "Decision logged";
    if (tour?.postTour.outcome === "not-interested") return "Not interested";
  }
  return null;
}
