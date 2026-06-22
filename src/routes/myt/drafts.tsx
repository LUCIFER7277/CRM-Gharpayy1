import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import DraftTracker from "@/myt/pages/DraftTracker";

export const Route = createFileRoute("/myt/drafts")({
  head: () => ({ meta: [{ title: "Draft Tracker - MYT" }] }),
  component: () => <AppShell><DraftTracker /></AppShell>,
});
