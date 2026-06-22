import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import MYTLeadTracker from "@/myt/pages/MYTLeadTracker";

export const Route = createFileRoute("/myt/leads")({
  head: () => ({ meta: [{ title: "Lead Tracker - MYT" }] }),
  component: () => <AppShell><MYTLeadTracker /></AppShell>,
});
