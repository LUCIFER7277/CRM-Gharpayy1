import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import Funnel from "@/myt/pages/Funnel";

export const Route = createFileRoute("/myt/funnel")({
  head: () => ({ meta: [{ title: "Funnel - MYT" }] }),
  component: () => <AppShell><Funnel /></AppShell>,
});
