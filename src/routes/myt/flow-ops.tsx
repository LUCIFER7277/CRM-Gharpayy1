import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import FlowOpsDashboard from "@/myt/pages/FlowOpsDashboard";

export const Route = createFileRoute("/myt/flow-ops")({
  head: () => ({ meta: [{ title: "Flow Ops - MYT" }] }),
  component: () => <AppShell><FlowOpsDashboard /></AppShell>,
});
