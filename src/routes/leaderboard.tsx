import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CreatorLeaderboardPanel } from "@/components/stats/CreatorLeaderboardPanel";
import { Trophy } from "lucide-react";

import { format } from "date-fns";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard - Gharpayy" },
      { name: "description", content: "Members ranked by tours scheduled + tours completed." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
              <Trophy className="h-6 w-6 text-accent" /> Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Members ranked by tours scheduled + tours completed — both contribute equally. <span className="text-accent font-mono">live</span>
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono min-h-[1em]">
            {format(new Date(), "EEEE, MMM d · h:mm a")}
          </div>
        </header>
        <CreatorLeaderboardPanel />
      </div>
    </AppShell>
  );
}
