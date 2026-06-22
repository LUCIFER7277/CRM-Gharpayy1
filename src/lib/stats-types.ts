export type LeaderboardPeriod = "this_month" | "all_time" | "today" | "last_30_days" | "custom";

export type CreatorLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  role: "member" | "tcm";
  toursCount: number;
  scheduledCount: number;
  completedCount: number;
  zones: { zone: string; count: number }[];
};

export type CreatorLeaderboardResponse = {
  period: LeaderboardPeriod;
  from: string | null;
  to: string | null;
  generatedAt: string;
  rankings: CreatorLeaderboardEntry[];
};

export type LeadsDailyProgressMember = {
  id: string;
  name: string;
  role: "member" | "tcm";
  zones: string[];
  leadsAdded: number;
  toursScheduled: number;
  quotesSent: number;
  leadsDone: boolean;
  toursDone: boolean;
  quotesDone: boolean;
  allDone: boolean;
};

export type LeadsDailyProgressResponse = {
  date: string;
  members: LeadsDailyProgressMember[];
  goals: {
    leadsAdded: number;
    toursScheduled: number;
    quotesSent: number;
  };
  thresholds?: {
    leadsAdded: number;
    toursScheduled: number;
    quotesSent: number;
  };
};

export const DAILY_GOALS = { leadsAdded: 40, toursScheduled: 10, quotesSent: 10 } as const;
