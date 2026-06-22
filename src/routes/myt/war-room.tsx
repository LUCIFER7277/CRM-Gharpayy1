import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import WarRoom from "@/myt/pages/WarRoom";

export const Route = createFileRoute("/myt/war-room")({
  head: () => ({ meta: [{ title: "War Room - MYT" }] }),
  component: () => <AppShell><WarRoom /></AppShell>,
});
