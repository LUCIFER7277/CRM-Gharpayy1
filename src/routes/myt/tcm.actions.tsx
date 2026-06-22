import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import TCMActions from "@/myt/pages/TCMActions";

export const Route = createFileRoute("/myt/tcm/actions")({
  head: () => ({ meta: [{ title: "TCM Actions - MYT" }] }),
  component: () => <AppShell><TCMActions /></AppShell>,
});
