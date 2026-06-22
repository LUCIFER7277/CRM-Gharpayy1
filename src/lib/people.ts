/**
 * People seed - multiple humans per role so HR has comparison fodder
 * and "View as" can switch identities to test cross-role flows.
 *
 * IDs here intentionally match the TCM ids in `mock-data.ts` so the
 * existing engine + activity stream keep working.
 */

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: "hr" | "flow-ops" | "tcm" | "owner";
  /** main responsibility / focus area shown in HR comparison */
  focus: string;
  /** rolling stats for HR War Room (mocked but consistent) */
  stats: {
    /** Mission completion % (today) */
    missionPct: number;
    /** Day streak */
    streak: number;
    /** Lifetime XP */
    xp: number;
    /** Closes this month (TCM/Flop assist) */
    closes: number;
    /** Avg first-response minutes */
    avgResponseMins: number;
  };
}

export const HR_PEOPLE: Person[] = [
  { id: "hr-1", name: "Anita Khanna",   initials: "AK", role: "hr", focus: "People & coaching",
    stats: { missionPct: 82, streak: 12, xp: 3120, closes: 0, avgResponseMins: 0 } },
  { id: "hr-2", name: "Vivek Sharma",   initials: "VS", role: "hr", focus: "Ops & SLAs",
    stats: { missionPct: 67, streak: 6,  xp: 2210, closes: 0, avgResponseMins: 0 } },
  { id: "hr-3", name: "Sara Pillai",    initials: "SP", role: "hr", focus: "Revenue & forecast",
    stats: { missionPct: 91, streak: 18, xp: 4380, closes: 0, avgResponseMins: 0 } },
  { id: "hr-4", name: "Kunal Bhatt",    initials: "KB", role: "hr", focus: "Owners & supply",
    stats: { missionPct: 54, streak: 2,  xp: 1180, closes: 0, avgResponseMins: 0 } },
];

export const FLOWOPS_PEOPLE: Person[] = [
  { id: "fo-1", name: "Riya Kapoor",    initials: "RK", role: "flow-ops", focus: "Inbound triage",
    stats: { missionPct: 88, streak: 15, xp: 4120, closes: 9,  avgResponseMins: 3 } },
  { id: "fo-2", name: "Aman Joshi",     initials: "AJ", role: "flow-ops", focus: "Tour scheduling",
    stats: { missionPct: 72, streak: 8,  xp: 2680, closes: 6,  avgResponseMins: 5 } },
  { id: "fo-3", name: "Pooja Nair",     initials: "PN", role: "flow-ops", focus: "Reassignment",
    stats: { missionPct: 60, streak: 4,  xp: 1820, closes: 4,  avgResponseMins: 8 } },
  { id: "fo-4", name: "Tushar Rao",     initials: "TR", role: "flow-ops", focus: "Revival & cold leads",
    stats: { missionPct: 45, streak: 1,  xp: 940,  closes: 2,  avgResponseMins: 11 } },
];

/** TCM stats for HR comparison - keyed by the 4 core TCM ids. */
export const TCM_STATS: Record<string, Person["stats"] & { name: string; focus: string }> = {
  "tcm-1": { name: "Aarav Mehta",  focus: "Koramangala · closer",  missionPct: 92, streak: 21, xp: 5630, closes: 14, avgResponseMins: 4 },
  "tcm-2": { name: "Priya Shah",   focus: "Indiranagar · nurturer", missionPct: 76, streak: 9,  xp: 3220, closes: 9,  avgResponseMins: 7 },
  "tcm-3": { name: "Rohan Iyer",   focus: "HSR · improving",        missionPct: 51, streak: 3,  xp: 1640, closes: 5,  avgResponseMins: 12 },
  "tcm-4": { name: "Neha Verma",   focus: "Whitefield · hot streak",missionPct: 95, streak: 27, xp: 6210, closes: 17, avgResponseMins: 3 },
};

/** All people indexed by id (for quick lookup in connector feeds). */
export const PEOPLE_BY_ID: Record<string, { name: string; role: Person["role"] }> = {
  ...Object.fromEntries(HR_PEOPLE.map((p) => [p.id, { name: p.name, role: p.role }])),
  ...Object.fromEntries(FLOWOPS_PEOPLE.map((p) => [p.id, { name: p.name, role: p.role }])),
  ...Object.fromEntries(Object.entries(TCM_STATS).map(([id, s]) => [id, { name: s.name, role: "tcm" as const }])),
  "own-1": { name: "Rakesh Sharma", role: "owner" },
  "own-2": { name: "Meera Iyer",    role: "owner" },
  "own-3": { name: "Ankit Verma",   role: "owner" },
  "own-4": { name: "Deepa Krishnan",role: "owner" },
};

export function personName(id: string | undefined, fallback = "Someone"): string {
  if (!id) return fallback;
  return PEOPLE_BY_ID[id]?.name ?? fallback;
}
