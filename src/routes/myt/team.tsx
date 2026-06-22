import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TeamPerformance from "@/myt/pages/TeamPerformance";

export const Route = createFileRoute("/myt/team")({
  head: () => ({ meta: [{ title: "Team Performance - MYT" }] }),
  component: () => <AppShell><TeamPerformance /></AppShell>,
});
