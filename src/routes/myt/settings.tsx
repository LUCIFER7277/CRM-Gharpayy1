import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import SettingsPage from "@/myt/pages/SettingsPage";

export const Route = createFileRoute("/myt/settings")({
  head: () => ({ meta: [{ title: "Settings - MYT" }] }),
  component: () => <AppShell><SettingsPage /></AppShell>,
});
