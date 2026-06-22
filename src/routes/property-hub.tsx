import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PropertyHubPage } from "@/property-genius/PropertyHubPage";

export const Route = createFileRoute("/property-hub")({
  head: () => ({
    meta: [
      { title: "Property Hub - Gharpayy" },
      { name: "description", content: "Property Hub ecosystem." },
    ],
  }),
  component: () => (
    <AppShell>
      <PropertyHubPage />
    </AppShell>
  ),
});
