import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DailyProgressView } from "@/components/stats/DailyProgressView";

export const Route = createFileRoute("/daily-progress")({
  head: () => ({
    meta: [
      { title: "Daily Progress - Gharpayy" },
      { name: "description", content: "Daily leads and tours progress for members." },
    ],
  }),
  component: DailyProgressPage,
});

function DailyProgressPage() {
  return (
    <AppShell>
      <DailyProgressView />
    </AppShell>
  );
}
