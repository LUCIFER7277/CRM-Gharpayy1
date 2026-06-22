import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TourCommand from "@/myt/pages/TourCommand";

export const Route = createFileRoute("/myt/tour/$id")({
  head: () => ({ meta: [{ title: "Tour Command - MYT" }] }),
  component: () => <AppShell><TourCommand /></AppShell>,
});
