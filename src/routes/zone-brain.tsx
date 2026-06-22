import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ZoneBrain } from "@/components/crm10x/ZoneBrain";

export const Route = createFileRoute("/zone-brain")({
  head: () => ({
    meta: [
      { title: "Zone Brain - Gharpayy" },
      { name: "description", content: "Per-zone P&L, conversion, SLA and TCM capacity with auto-rebalancing recommendations across all Bangalore zones." },
    ],
  }),
  component: () => (
    <AppShell>
      <ZoneBrain />
    </AppShell>
  ),
});
