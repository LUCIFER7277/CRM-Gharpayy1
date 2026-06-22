import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import InventoryFeedback from "@/myt/pages/InventoryFeedback";

export const Route = createFileRoute("/myt/inventory-feedback")({
  head: () => ({ meta: [{ title: "Inventory Feedback - MYT" }] }),
  component: () => <AppShell><InventoryFeedback /></AppShell>,
});
