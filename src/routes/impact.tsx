import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ImpactQueue } from "@/components/impact/ImpactQueue";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";
import { useSocketSync } from "@/lib/realtime/socket";

function ImpactRoute() {
  useSocketSync();

  return (
    <FeatureErrorBoundary>
      <AppShell>
        <ImpactQueue />
      </AppShell>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute("/impact")({
  head: () => ({ meta: [{ title: "Impact Queue" }] }),
  component: ImpactRoute,
});