import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { ZonesPage } from "@/components/ZonesPage";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/zones")({
  head: () => ({ meta: [{ title: "Zones - Gharpayy" }] }),
  component: ZonesRoute,
});

function ZonesRoute() {
  const user = useAuthUser((s) => s.user);
  const hydrate = useAuthUser((s) => s.hydrate);
  const navigate = useNavigate();

  useEffect(() => { if (!user) hydrate(); }, [user, hydrate]);
  useEffect(() => {
    if (user && user.role !== "super_admin" && user.role !== "manager") {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  return (
    <AppShell>
      <ZonesPage />
    </AppShell>
  );
}
