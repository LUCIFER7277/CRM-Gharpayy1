import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LeaderboardPeriod } from "@/lib/stats-types";

export const useCreatorLeaderboard = (
  period: LeaderboardPeriod = "this_month",
  zone?: string,
  customRange?: { from: string; to: string },
) =>
  useQuery({
    queryKey: ["creator-leaderboard", period, zone, customRange],
    queryFn: () => api.stats.leaderboard(period, zone, customRange),
    staleTime: 30_000,
  });

export const useLeadsDailyProgress = (date: string) =>
  useQuery({
    queryKey: ["leads-daily-progress", date],
    queryFn: () => api.stats.dailyProgress(date),
    staleTime: 30_000,
  });

export type {
  CreatorLeaderboardResponse,
  CreatorLeaderboardEntry,
  LeadsDailyProgressResponse,
  LeadsDailyProgressMember,
  LeaderboardPeriod,
} from "@/lib/stats-types";
