import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import Leaderboard from "@/myt/pages/Leaderboard";

export const Route = createFileRoute("/myt/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard - MYT" }] }),
  component: () => <AppShell><Leaderboard /></AppShell>,
});
