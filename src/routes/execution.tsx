import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ExecutionQueue } from "@/components/execution/ExecutionQueue";

export const Route = createFileRoute("/execution")({
  head: () => ({ meta: [{ title: "Execution Queue" }] }),
  component: () => <AppShell><ExecutionQueue /></AppShell>,
});
