import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import ZonePerformance from "@/myt/pages/ZonePerformance";

export const Route = createFileRoute("/myt/zones")({
  head: () => ({ meta: [{ title: "Zone Performance - MYT" }] }),
  component: () => <AppShell><ZonePerformance /></AppShell>,
});
