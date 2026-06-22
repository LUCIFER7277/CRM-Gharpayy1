import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TCMReportPage from "@/myt/pages/TCMReportPage";

export const Route = createFileRoute("/myt/tour/$id/report")({
  head: () => ({ meta: [{ title: "TCM Report - MYT" }] }),
  component: () => <AppShell><TCMReportPage /></AppShell>,
});
