import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/owners")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  component: AdminOwners,
});

function AdminOwners() {
  const { properties, leads } = useApp();

  const stats = useMemo(() => {
    return properties.map((p) => {
      const propLeads = leads.filter((l) => l.preferredArea === p.area || l.propertyName === p.name);
      const activeVisits = propLeads.filter((l) => l.stage === "on-tour" || l.stage === "tour-scheduled").length;
      const bookedThisMonth = propLeads.filter((l) => l.stage === "booked").length;
      return {
        id: p.id,
        name: p.name,
        area: p.area,
        ownerName: (p as any).ownerName ?? (p as any).contactName ?? "—",
        vacantBeds: p.vacantBeds,
        totalBeds: p.totalBeds,
        totalLeads: propLeads.length,
        activeVisits,
        bookedThisMonth,
      };
    });
  }, [properties, leads]);

  return (
    <AdminShell title="Master Owner Console" sub={`${properties.length} properties \u00B7 full visibility`}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-2">Property</th>
                <th className="p-2">Area</th>
                <th className="p-2">Owner</th>
                <th className="p-2 text-right">Beds</th>
                <th className="p-2 text-right">Vacant</th>
                <th className="p-2 text-right">Leads</th>
                <th className="p-2 text-right">Active Visits</th>
                <th className="p-2 text-right">Booked (Mo)</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2 text-muted-foreground">{s.area}</td>
                  <td className="p-2">{s.ownerName}</td>
                  <td className="p-2 text-right font-mono">{s.totalBeds}</td>
                  <td className="p-2 text-right font-mono">{s.vacantBeds}</td>
                  <td className="p-2 text-right font-mono">{s.totalLeads}</td>
                  <td className="p-2 text-right font-mono">{s.activeVisits}</td>
                  <td className="p-2 text-right font-mono text-success">{s.bookedThisMonth}</td>
                  <td className="p-2">
                    <Link
                      to="/admin/leads"
                      search={{ area: s.area }}
                      className="text-accent underline text-[10px]"
                    >
                      View Leads
                    </Link>
                  </td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No properties loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
