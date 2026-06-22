import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TCMPerformance from "@/myt/pages/TCMPerformance";

export const Route = createFileRoute("/myt/tcm/performance")({
  head: () => ({ meta: [{ title: "TCM Performance - MYT" }] }),
  component: () => <AppShell><TCMPerformance /></AppShell>,
});
