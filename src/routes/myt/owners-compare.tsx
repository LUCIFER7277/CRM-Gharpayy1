import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import OwnersCompare from "@/myt/pages/OwnersCompare";

export const Route = createFileRoute("/myt/owners-compare")({
  head: () => ({ meta: [{ title: "Owners Compare - HR" }] }),
  component: () => <AppShell><OwnersCompare /></AppShell>,
});
