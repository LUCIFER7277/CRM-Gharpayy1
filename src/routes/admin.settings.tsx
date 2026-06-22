import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  component: AdminSettings,
});

function AdminSettings() {
  const { role, setRole, leads, tours, properties } = useApp();
  const authRole = useAuthUser((s) => s.user?.role);

  return (
    <AdminShell title="Admin Settings" sub="Local-only toggles \u00B7 no backend">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-lg">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Current User Role</div>
          <div className="text-sm font-mono">{(authRole ?? role) as string}</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Data Source Status</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-muted/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Leads loaded</div>
              <div className="font-mono font-medium">{leads.length}</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Visits loaded</div>
              <div className="font-mono font-medium">{tours.length}</div>
            </div>
            <div className="bg-muted/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground">Properties</div>
              <div className="font-mono font-medium">{properties.length}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Switch out of Admin</div>
          <div className="flex gap-2 flex-wrap">
            {(["hr", "flow-ops", "tcm", "owner"] as Role[]).map((r) => (
              <Button key={r} size="sm" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>{r}</Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Saved views</div>
          <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem("admin.views"); location.reload(); }}>Clear saved views</Button>
        </div>

        <div className="text-[11px] text-muted-foreground">
          Admin role is local-only in this build. All admin actions are written to the audit log and can be undone within 10s.
        </div>
      </div>
    </AdminShell>
  );
}
