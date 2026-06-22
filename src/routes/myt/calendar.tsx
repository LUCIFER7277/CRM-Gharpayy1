import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TourCalendar from "@/myt/pages/TourCalendar";

export const Route = createFileRoute("/myt/calendar")({
  head: () => ({ meta: [{ title: "Tour Calendar - MYT" }] }),
  component: () => <AppShell><TourCalendar /></AppShell>,
});
