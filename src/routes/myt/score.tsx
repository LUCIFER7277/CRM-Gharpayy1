import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import ScoreLeaderboard from "@/myt/pages/ScoreLeaderboard";

export const Route = createFileRoute("/myt/score")({
  head: () => ({ meta: [{ title: "Score Leaderboard - MYT" }] }),
  component: () => <AppShell><ScoreLeaderboard /></AppShell>,
});
