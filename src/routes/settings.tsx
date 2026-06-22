import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SuperAdminSettingsPanel } from "@/components/settings/SuperAdminSettingsPanel";
import { MemberSettingsPanel } from "@/components/settings/MemberSettingsPanel";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { useAuthUser } from "@/lib/auth-store";
import { useEffect } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings - Gharpayy" }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const user = useAuthUser((s) => s.user);
  const hydrate = useAuthUser((s) => s.hydrate);
  useEffect(() => { if (!user) hydrate(); }, [user, hydrate]);

  const isSuperAdmin = user?.role === "super_admin";
  const isMember = user?.role === "member";

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin ? "Super Admin control panel" : isMember ? "Your account and TCM capability" : "Your account"}
          </p>
        </div>
        {isSuperAdmin ? <SuperAdminSettingsPanel /> : isMember ? <MemberSettingsPanel /> : <ProfileTab />}
      </div>
    </AppShell>
  );
}
