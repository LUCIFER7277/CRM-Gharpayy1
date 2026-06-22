import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import PropertyCommandCenter from "@/myt/pages/PropertyCommandCenter";

export const Route = createFileRoute("/myt/properties")({
  head: () => ({ meta: [{ title: "Property Command Center - MYT" }] }),
  component: () => <AppShell><PropertyCommandCenter /></AppShell>,
});
