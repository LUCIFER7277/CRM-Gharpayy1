import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import HRTower from "@/myt/pages/HRTower";

export const Route = createFileRoute("/myt/")({
  head: () => ({ meta: [{ title: "HR Tower - MYT" }] }),
  component: () => <AppShell><HRTower /></AppShell>,
});
