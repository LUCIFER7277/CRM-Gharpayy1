import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import MismatchConsole from "@/myt/pages/MismatchConsole";

export const Route = createFileRoute("/myt/mismatch")({
  head: () => ({ meta: [{ title: "Mismatch Console - MYT" }] }),
  component: () => <AppShell><MismatchConsole /></AppShell>,
});
