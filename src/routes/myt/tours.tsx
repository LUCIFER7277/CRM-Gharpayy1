import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import AllTours from "@/myt/pages/AllTours";

export const Route = createFileRoute("/myt/tours")({
  head: () => ({ meta: [{ title: "All Tours - MYT" }] }),
  component: () => <AppShell><AllTours /></AppShell>,
});
