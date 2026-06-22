import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DailyActionQueue } from "@/components/crm10x/DailyActionQueue";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Daily Action Queue - Gharpayy" },
      { name: "description", content: "Mandatory ranked queue: fire, confirm, recover, nurture and prospect bands. One decision per row." },
    ],
  }),
  component: () => (
    <AppShell>
      <DailyActionQueue />
    </AppShell>
  ),
});
