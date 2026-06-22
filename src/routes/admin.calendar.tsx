import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/calendar")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  component: AdminCal,
});

function AdminCal() {
  return (
    <AdminShell title="Master Calendar" sub="All TCMs, all events">
      <div className="rounded-xl border border-border bg-card p-6 text-sm">
        Admin view reuses the full <Link to="/calendar" className="text-accent underline">/calendar</Link> with no zone filter \u2014 open it for drag-to-reschedule, swim-lanes per TCM, and ICS export.
      </div>
    </AdminShell>
  );
}
