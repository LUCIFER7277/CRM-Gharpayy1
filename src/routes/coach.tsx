import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CoachPanel } from "@/components/CoachPanel";
import { HRBroadcastComposer } from "@/components/HRBroadcastComposer";
import { useApp } from "@/lib/store";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/coach")({
  component: CoachRoute,
});

function CoachRoute() {
  const role = useApp((s) => s.role);
  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-display font-bold">Your Coach</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-2 max-w-2xl">
          What you've done, what slipped, what's next, and exactly how to do it.
          Clear items to earn XP, keep your streak alive, and unlock badges.
        </p>
        {role === "hr" && <HRBroadcastComposer />}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <CoachPanel />
        </div>
      </div>
    </AppShell>
  );
}
