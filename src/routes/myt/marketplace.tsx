import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import LeadMarketplace from "@/myt/pages/LeadMarketplace";

export const Route = createFileRoute("/myt/marketplace")({
  head: () => ({ meta: [{ title: "Lead Marketplace - MYT" }] }),
  component: () => <AppShell><LeadMarketplace /></AppShell>,
});
