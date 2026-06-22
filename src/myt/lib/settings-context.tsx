import React, { createContext, useContext, useEffect, useState } from "react";

export type CustomFieldType = "text" | "number" | "select" | "boolean";
export interface CustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  appliesTo: "tour" | "property" | "lead";
  options?: string[];
}

export interface MessageTemplate {
  id: string;
  label: string;
  scenario: string;
  body: string;
}

export interface ScoreWeights {
  confirmation: number;
  showUp: number;
  engagement: number;
  propertyFit: number;
  tcmReportQuality: number;
  conversionLikelihood: number;
}

export interface ReminderOffsets {
  beforeTourMinutes: number[];
  postBookingFollowupMinutes: number[];
}

export interface CustomTarget {
  id: string;
  label: string;
  metric: "tours" | "showups" | "bookings" | "score";
  scope: "tcm" | "zone" | "property" | "global";
  scopeId?: string;
  value: number;
  period: "day" | "week" | "month";
}

export interface MatchingV2Settings {
  // Weights (sliders 0..50, total ~100)
  wDistance: number;
  wBudget: number;
  wAvailability: number;
  wConversion: number;
  wCompliance: number;
  wAudience: number;
  // Radius caps (km)
  radiusStudent: number;
  radiusWorking: number;
  radiusDefault: number;
  // Output
  topMatchCount: number;
  primaryCount: number;        // locked min 2 - defended in UI
  diversityWeight: number;     // % tolerance band for Primary B
  showOnlyVerified: boolean;
  hideLowCompliance: boolean;
  // Drawer behavior
  drawerDefaultTab: "best-fit" | "control";
  autoExpandTopMatch: boolean;
  showAmenitiesPreview: boolean;
  showManagerContacts: boolean;
  showMapsAction: boolean;
  showScoreBreakdown: boolean;
}

/** @deprecated kept for back-compat with older imports */
export type MatchingSettings = MatchingV2Settings;

export type AutomationRuleId =
  | "R04"   // Lead created → auto-route to TCM
  | "R11"   // Tour completed → block top room
  | "R26"   // Lead created → generate property matches
  | "R27"   // Room becomes vacant → recompute affected leads
  | "R28"   // Owner compliance drops → reduce ranking weight
  | "R29";  // Property booked frequently → boost ranking

export interface AutomationRule {
  id: AutomationRuleId;
  label: string;
  description: string;
  enabled: boolean;
  scope: "global" | "zone";
  zoneId?: string;
}

export type RoleVisibility = "hr" | "flow-ops" | "tcm" | "owner";

export interface RoleSettingsAccess {
  matching: RoleVisibility[];
  automation: RoleVisibility[];
  templates: RoleVisibility[];
  weights: RoleVisibility[];
  reminders: RoleVisibility[];
  custom: RoleVisibility[];
  targets: RoleVisibility[];
  simulator: RoleVisibility[];
}

export interface SLASettings {
  firstResponseMins: number;
  postTourFormMins: number;
  escalationAfterMins: number;
}

export interface ZoneOrgUnit {
  id: string;            // e.g. "z-koramangala"
  name: string;          // "Koramangala"
  city: string;          // "Bangalore"
  flowOpsLeadName?: string;
  flowOpsLeadPhone?: string;
  tcmIds: string[];      // TCM ids responsible for this zone
  notes?: string;
}

export interface SettingsState {
  customFields: CustomField[];
  templates: MessageTemplate[];
  weights: ScoreWeights;
  reminders: ReminderOffsets;
  targets: CustomTarget[];
  customAreas: string[];
  customProperties: { id: string; name: string; area: string; basePrice: number }[];
  customTcms: { id: string; name: string; phone: string; zoneId: string }[];
  customOutcomes: string[];
  customObjections: string[];
  siteName: string;
  signatureLine: string;
  matching: MatchingV2Settings;
  automation: AutomationRule[];
  roleAccess: RoleSettingsAccess;
  sla: SLASettings;
  zones: ZoneOrgUnit[];
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "confirmation",
    label: "Booking Confirmation",
    scenario: "Send the moment a tour is booked",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is *locked in* 🔒\n" +
      "📍 {{area}} | 🏠 {{propertyName}}\n" +
      "🕒 {{when}}\n" +
      "👤 Coordinator: {{tcmName}} ({{tcmPhone}})\n\n" +
      "This slot is reserved exclusively for you.\n" +
      "Reply *YES* to confirm or *RESCHEDULE*.\n" +
      "{{signature}}",
  },
  {
    id: "social_proof",
    label: "Social Proof Boost",
    scenario: "Send within 5 mins of confirmation if no YES reply",
    body:
      "Just so you know - *12 people* booked tours at {{propertyName}} this week. " +
      "Your slot at {{when}} is reserved. Reply *YES* to lock it. {{signature}}",
  },
  {
    id: "followup_5m",
    label: "Follow-up T+5min (no reply)",
    scenario: "Auto-follow if customer hasn't confirmed in 5 mins",
    body:
      "Hi {{leadName}}, just checking - did you get your tour confirmation for {{propertyName}} at {{when}}? " +
      "Reply *YES* so we hold your slot. {{signature}}",
  },
  {
    id: "followup_15m",
    label: "Follow-up T+15min",
    scenario: "Second nudge",
    body:
      "Hi {{leadName}}, your slot at {{propertyName}} ({{when}}) will be released soon if not confirmed. " +
      "Reply *YES* now to keep it. {{signature}}",
  },
  {
    id: "reminder_4h",
    label: "T-4h Context Reminder",
    scenario: "4 hours before the tour - remind WHY this is relevant",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is in *4 hours*.\n" +
      "Based on your budget *₹{{budget}}* and your work area *{{workLocation}}*, " +
      "{{propertyName}} is one of your strongest matches.\n" +
      "🕒 {{when}} 📍 {{area}}\n{{signature}}",
  },
  {
    id: "reminder_2h",
    label: "T-2h Logistics",
    scenario: "2 hours before - directions + coordinator contact",
    body:
      "Hi {{leadName}}, your {{siteName}} tour is in *2 hours*.\n" +
      "📍 {{propertyName}}, {{area}}\n" +
      "👤 {{tcmName}} - call: {{tcmPhone}}\n" +
      "Tap for directions: {{mapsLink}}\n{{signature}}",
  },
  {
    id: "reminder_30m",
    label: "T-30m Action Trigger",
    scenario: "30 minutes before - leave now",
    body:
      "Hi {{leadName}}, *time to leave* 🚗\n" +
      "Your tour at {{propertyName}} starts in 30 mins.\n" +
      "👤 {{tcmName}} ({{tcmPhone}}) is on the way.\n{{signature}}",
  },
  {
    id: "tcm_eta",
    label: "TCM On The Way (ETA)",
    scenario: "TCM taps 'On the way' - auto-share with customer",
    body:
      "Hi {{leadName}}, your coordinator {{tcmName}} is *on the way* to {{propertyName}}. " +
      "ETA: {{etaMinutes}} mins. Call: {{tcmPhone}}. {{signature}}",
  },
  {
    id: "customer_running_late",
    label: "Customer Running Late (TCM-side ack)",
    scenario: "Acknowledge a 'running late' message",
    body:
      "No worries {{leadName}}, take your time. {{tcmName}} will wait at {{propertyName}}. " +
      "Just reply with your new ETA. {{signature}}",
  },
  {
    id: "tour_start_otp",
    label: "Tour Start OTP",
    scenario: "Customer arrives - share OTP for verified start",
    body:
      "Hi {{leadName}}, share this OTP with {{tcmName}} to start your tour: *{{otp}}* - " +
      "valid for 10 mins. {{signature}}",
  },
  {
    id: "tour_started",
    label: "Tour Started",
    scenario: "After OTP/geo verified - confirm to customer",
    body:
      "Your {{siteName}} tour at {{propertyName}} has *officially started*. " +
      "We're walking you through options tailored to your needs. {{signature}}",
  },
  {
    id: "tour_ended",
    label: "Tour Ended + Feedback",
    scenario: "Right after tour ends",
    body:
      "Your tour at {{propertyName}} is *complete* ✅\n" +
      "How was it?\n• Loved it 🔥\n• Good but unsure 🙂\n• Not a fit ❌\n• Need better options 🔄\n" +
      "Reply with one. {{signature}}",
  },
  {
    id: "post_tour_predictive",
    label: "Post-Tour Predictive Nudge",
    scenario: "1-3 hrs after tour - push conversion",
    body:
      "Hi {{leadName}}, *people with similar preferences booked {{propertyName}} within 24 hrs* " +
      "of their tour. Want us to block your room before someone else does? Reply *BLOCK*. {{signature}}",
  },
  {
    id: "no_show_recovery",
    label: "No-show Recovery",
    scenario: "When tour is marked as no-show",
    body:
      "Hi {{leadName}}, we missed you at {{propertyName}} today. " +
      "Want to reschedule? Reply with a day & time and {{tcmName}} will lock it in. {{signature}}",
  },
];

const DEFAULT_WEIGHTS: ScoreWeights = {
  confirmation: 20,
  showUp: 25,
  engagement: 15,
  propertyFit: 15,
  tcmReportQuality: 10,
  conversionLikelihood: 15,
};

const DEFAULT_REMINDERS: ReminderOffsets = {
  beforeTourMinutes: [240, 120, 30],
  postBookingFollowupMinutes: [5, 15, 60],
};

const DEFAULT_MATCHING: MatchingV2Settings = {
  wDistance: 35,
  wBudget: 25,
  wAvailability: 12,
  wConversion: 10,
  wCompliance: 8,
  wAudience: 10,
  radiusStudent: 3,
  radiusWorking: 8,
  radiusDefault: 12,
  topMatchCount: 6,
  primaryCount: 2,
  diversityWeight: 12,
  showOnlyVerified: false,
  hideLowCompliance: false,
  drawerDefaultTab: "best-fit",
  autoExpandTopMatch: true,
  showAmenitiesPreview: true,
  showManagerContacts: true,
  showMapsAction: true,
  showScoreBreakdown: true,
};

const DEFAULT_AUTOMATION: AutomationRule[] = [
  { id: "R04", label: "R04 · Auto-route lead", description: "Lead created → routed to best-fit TCM by zone, load and conversion.", enabled: true, scope: "global" },
  { id: "R11", label: "R11 · Block top room", description: "Tour completed and decision pending → soft-block the top-ranked room for 24h.", enabled: true, scope: "global" },
  { id: "R26", label: "R26 · Generate property matches", description: "Lead created → matching engine generates Top-6 with dual-primary pair.", enabled: true, scope: "global" },
  { id: "R27", label: "R27 · Vacant room → recompute leads", description: "When a property opens up, all affected leads' match list is recomputed.", enabled: true, scope: "global" },
  { id: "R28", label: "R28 · Compliance drop → demote", description: "Owner compliance below threshold reduces that property's ranking weight.", enabled: true, scope: "global" },
  { id: "R29", label: "R29 · Booked often → boost", description: "Properties with strong recent bookings get a small ranking boost.", enabled: true, scope: "global" },
];

const DEFAULT_ROLE_ACCESS: RoleSettingsAccess = {
  matching:   ["hr", "flow-ops"],
  automation: ["hr", "flow-ops"],
  templates:  ["hr", "flow-ops", "tcm"],
  weights:    ["hr", "flow-ops"],
  reminders:  ["hr", "flow-ops"],
  custom:     ["hr", "flow-ops"],
  targets:    ["hr"],
  simulator:  ["hr", "flow-ops"],
};

const DEFAULT_SLA: SLASettings = {
  firstResponseMins: 5,
  postTourFormMins: 60,
  escalationAfterMins: 30,
};

const DEFAULT_ZONES: ZoneOrgUnit[] = [
  { id: "z-koramangala", name: "Koramangala", city: "Bangalore", flowOpsLeadName: "Aarav S.", flowOpsLeadPhone: "9000010001", tcmIds: ["tcm-1", "tcm-2"], notes: "Christ University belt + 1st-7th block." },
  { id: "z-bellandur",   name: "Bellandur",   city: "Bangalore", flowOpsLeadName: "Diya P.",  flowOpsLeadPhone: "9000010002", tcmIds: ["tcm-3"],          notes: "Outer Ring Road tech corridor." },
  { id: "z-marathahalli",name: "Marathahalli",city: "Bangalore", flowOpsLeadName: "Kabir M.", flowOpsLeadPhone: "9000010003", tcmIds: ["tcm-4"],          notes: "Brookefield + AECS Layout." },
  { id: "z-whitefield",  name: "Whitefield",  city: "Bangalore", flowOpsLeadName: "Ishaan R.", flowOpsLeadPhone: "9000010004", tcmIds: [],                notes: "ITPL + Hope Farm." },
  { id: "z-mahadevapura",name: "Mahadevapura",city: "Bangalore", flowOpsLeadName: "Riya N.",  flowOpsLeadPhone: "9000010005", tcmIds: [],                notes: "EPIP + KR Puram bridge." },
  { id: "z-manyata",     name: "Nagawara Manyata", city: "Bangalore", flowOpsLeadName: "Vivaan A.", flowOpsLeadPhone: "9000010006", tcmIds: [],          notes: "Manyata Tech Park belt." },
];

const DEFAULT_SETTINGS: SettingsState = {
  customFields: [],
  templates: DEFAULT_TEMPLATES,
  weights: DEFAULT_WEIGHTS,
  reminders: DEFAULT_REMINDERS,
  targets: [],
  customAreas: [],
  customProperties: [],
  customTcms: [],
  customOutcomes: [],
  customObjections: [
    "Too expensive",
    "Rooms too small",
    "Location far",
    "Food concerns",
    "Comparing other PG",
    "Needs family approval",
  ],
  siteName: "Gharpayy",
  signatureLine: "- Team Gharpayy",
  matching: DEFAULT_MATCHING,
  automation: DEFAULT_AUTOMATION,
  roleAccess: DEFAULT_ROLE_ACCESS,
  sla: DEFAULT_SLA,
  zones: DEFAULT_ZONES,
};
const KEY = "gharpayy.settings.v1";

function mergeSettings(parsed: Partial<SettingsState>): SettingsState {
  const userTpls = parsed.templates ?? [];
  const userIds = new Set(userTpls.map((t) => t.id));
  const mergedTemplates = [...userTpls, ...DEFAULT_TEMPLATES.filter((t) => !userIds.has(t.id))];

  // Merge automation rules so newly-added defaults appear, but user toggles win.
  const userRules = parsed.automation ?? [];
  const userRuleMap = new Map(userRules.map((r) => [r.id, r] as const));
  const mergedAutomation = DEFAULT_AUTOMATION.map((d) => {
    const u = userRuleMap.get(d.id);
    return u ? { ...d, ...u } : d;
  });

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    templates: mergedTemplates,
    weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
    reminders: { ...DEFAULT_REMINDERS, ...(parsed.reminders ?? {}) },
    matching: { ...DEFAULT_MATCHING, ...(parsed.matching ?? {}) },
    automation: mergedAutomation,
    roleAccess: { ...DEFAULT_ROLE_ACCESS, ...(parsed.roleAccess ?? {}) },
    sla: { ...DEFAULT_SLA, ...(parsed.sla ?? {}) },
    zones: parsed.zones && parsed.zones.length > 0 ? parsed.zones : DEFAULT_ZONES,
  };
}

function load(): SettingsState {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return mergeSettings(JSON.parse(raw) as Partial<SettingsState>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: SettingsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface SettingsCtx {
  settings: SettingsState;
  update: <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => void;
  reset: () => void;
  upsertTemplate: (t: MessageTemplate) => void;
  removeTemplate: (id: string) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => load());

  useEffect(() => {
    save(settings);
  }, [settings]);

  function update<K extends keyof SettingsState>(k: K, v: SettingsState[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
  }

  function reset() {
    setSettings(DEFAULT_SETTINGS);
  }

  function upsertTemplate(t: MessageTemplate) {
    setSettings((s) => {
      const exists = s.templates.some((x) => x.id === t.id);
      const templates = exists ? s.templates.map((x) => (x.id === t.id ? t : x)) : [...s.templates, t];
      return { ...s, templates };
    });
  }

  function removeTemplate(id: string) {
    setSettings((s) => ({ ...s, templates: s.templates.filter((x) => x.id !== id) }));
  }

  return <Ctx.Provider value={{ settings, update, reset, upsertTemplate, removeTemplate }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export interface TemplateVars {
  leadName?: string;
  propertyName?: string;
  area?: string;
  when?: string;
  tcmName?: string;
  tcmPhone?: string;
  budget?: string | number;
  workLocation?: string;
  mapsLink?: string;
  etaMinutes?: string | number;
  otp?: string;
  siteName?: string;
  signature?: string;
  [k: string]: string | number | undefined;
}

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{{${k}}}` : String(v);
  });
}
