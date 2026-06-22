import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import ScheduleTour from "@/myt/pages/ScheduleTour";

export const Route = createFileRoute("/myt/schedule")({
  head: () => ({ meta: [{ title: "Scheduled Tours - MYT" }] }),
  component: () => <AppShell><ScheduleTour /></AppShell>,
});
