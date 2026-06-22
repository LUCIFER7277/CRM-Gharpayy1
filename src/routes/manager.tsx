import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ManagerDashboard } from "@/components/crm10x/ManagerDashboard";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Manager Dashboard - Gharpayy" },
      { name: "description", content: "Numbers-only manager view: today's pulse, conversion funnel, agent comparison, red flags, objection breakdown." },
    ],
  }),
  component: () => (
    <AppShell>
      <ManagerDashboard />
    </AppShell>
  ),
});
