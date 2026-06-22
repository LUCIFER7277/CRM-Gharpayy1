import React, { createContext, useContext, useEffect, useState } from "react";

// Per-tour runtime data (events, customer feedback, TCM report) - all in localStorage
export type TourEventKind =
  | "booked"
  | "confirmation_sent"
  | "confirmed_by_customer"
  | "reschedule_requested"
  | "reminder_sent"
  | "tcm_on_the_way"
  | "customer_running_late"
  | "tour_started"
  | "tour_ended"
  | "no_show"
  | "cancelled"
  | "feedback_received"
  | "tcm_report_filed"
  | "custom_message_sent";

export interface TourEvent {
  id: string;
  tourId: string;
  kind: TourEventKind;
  notes?: string;
  at: string; // ISO
  templateId?: string;
  payload?: Record<string, unknown>;
}

export type CustomerSentiment = "loved" | "good_unsure" | "not_fit" | "need_better";

export interface CustomerFeedback {
  tourId: string;
  sentiment: CustomerSentiment;
  rating?: number; // 1-5
  liked?: string;
  comment?: string;
  at: string;
}

export type TCMOutcome = "booked" | "hot" | "warm" | "cold" | "dropped";

export interface TCMReport {
  tourId: string;
  arrived: "yes" | "no" | "proxy";
  punctuality: "early" | "on_time" | "late" | "no_show";
  budgetAlignment: "exact" | "stretch" | "mismatch";
  propertyReaction: "positive" | "neutral" | "negative";
  interestLevel: "high" | "medium" | "low";
  firstObjection?: string;
  priceReactionWords?: string;
  decisionAuthority: "self" | "parent" | "group" | "other";
  comparisonReference?: string;
  emotionalTone: "excited" | "confused" | "defensive" | "neutral";
  outcome: TCMOutcome;
  nextStep: string;
  notes?: string;
  filedAt: string;
}

interface State {
  events: TourEvent[];
  feedback: Record<string, CustomerFeedback>;
  reports: Record<string, TCMReport>;
}

const DEFAULT: State = { events: [], feedback: {}, reports: {} };
const KEY = "gharpayy.tourdata.v1";

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as State) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
function persist(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface Ctx {
  events: TourEvent[];
  feedback: Record<string, CustomerFeedback>;
  reports: Record<string, TCMReport>;
  addEvent: (e: Omit<TourEvent, "id" | "at"> & { at?: string }) => void;
  setFeedback: (f: CustomerFeedback) => void;
  setReport: (r: TCMReport) => void;
  eventsForTour: (tourId: string) => TourEvent[];
}

const C = createContext<Ctx | null>(null);

export function TourDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    persist(state);
  }, [state]);

  const addEvent: Ctx["addEvent"] = (e) =>
    setState((s) => ({
      ...s,
      events: [
        { id: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: e.at ?? new Date().toISOString(), ...e },
        ...s.events,
      ],
    }));
  const setFeedback: Ctx["setFeedback"] = (f) =>
    setState((s) => ({ ...s, feedback: { ...s.feedback, [f.tourId]: f } }));
  const setReport: Ctx["setReport"] = (r) =>
    setState((s) => ({ ...s, reports: { ...s.reports, [r.tourId]: r } }));
  const eventsForTour = (tourId: string) =>
    state.events.filter((e) => e.tourId === tourId).sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <C.Provider value={{ ...state, addEvent, setFeedback, setReport, eventsForTour }}>
      {children}
    </C.Provider>
  );
}

export function useTourData() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useTourData must be used within TourDataProvider");
  return ctx;
}
