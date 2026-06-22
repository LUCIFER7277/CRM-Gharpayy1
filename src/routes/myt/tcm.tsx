import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TCMDashboard from "@/myt/pages/TCMDashboard";

export const Route = createFileRoute("/myt/tcm")({
  head: () => ({ meta: [{ title: "TCM Dashboard - MYT" }] }),
  component: () => <AppShell><TCMDashboard /></AppShell>,
});
