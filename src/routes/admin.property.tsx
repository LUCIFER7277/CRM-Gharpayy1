import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { useCRM10x } from "@/lib/crm10x/store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/property")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminProperty,
  }
);

function AdminProperty() {
  const { tcms, leads, properties } = useApp();
  const visitsMap = useVisitWar((s) => s.records);
  const objections = useCRM10x((s) => s.objections);
  const visits = useMemo(() => Object.values(visitsMap), [visitsMap]);

  const stats = useMemo(() => {
    return properties.map((prop) => {
      const propLeads = leads.filter(
        (l) => l.preferredArea === prop.area || l.propertyName === prop.name,
      );
      const propVisits = visits.filter(
        (v) => v.propertyId === prop.id || v.propertyName === prop.name,
      );
      const hotCount = propLeads.filter((l) => l.confidence >= 70).length;
      const visitsScheduled = propVisits.filter((v) => v.stage === "scheduled").length;
      const visitsDone = propVisits.filter((v) => v.stage === "completed").length;
      const bookedCount = propLeads.filter((l) => l.stage === "booked").length;

      const tcmCounts = new Map<string, number>();
      propLeads.forEach((l) => {
        if (l.assignedTcmId) tcmCounts.set(l.assignedTcmId, (tcmCounts.get(l.assignedTcmId) ?? 0) + 1);
      });
      const topTcmId = [...tcmCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topTcm = tcms.find((t) => t.id === topTcmId);

      const objCounts = new Map<string, number>();
      propLeads.forEach((l) => {
        objections
          .filter((o) => o.leadId === l.id && o.code !== "none")
          .forEach((o) => objCounts.set(o.code, (objCounts.get(o.code) ?? 0) + 1));
      });
      const topObj = [...objCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        id: prop.id,
        name: prop.name,
        area: prop.area,
        vacantBeds: prop.vacantBeds,
        totalLeads: propLeads.length,
        hotCount,
        visitsScheduled,
        visitsDone,
        bookedCount,
        topTcmName: topTcm?.name ?? "\u2014",
        topObj: topObj ? topObj.replace(/-/g, " ") : "\u2014",
      };
    });
  }, [properties, leads, visits, tcms, objections]);

  const totalProps = properties.length;
  const withHot = stats.filter((s) => s.hotCount > 0).length;
  const noLeads = stats.filter((s) => s.totalLeads === 0).length;

  return (
    <AdminShell title="Property Pulse" sub="Analytics view of all properties">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Properties</div>
            <div className="text-xl font-display font-semibold">{totalProps}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Properties with Hot Leads</div>
            <div className="text-xl font-display font-semibold text-accent">{withHot}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Properties with No Leads</div>
            <div className={`text-xl font-display font-semibold ${noLeads > 0 ? "text-destructive" : ""}`}>{noLeads}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Property</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Area</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Leads</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Hot</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Visits Sched.</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Visits Done</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Booked</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Vacant Beds</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Top TCM</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Top Objection</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                    s.totalLeads === 0 ? "bg-amber-50 dark:bg-amber-950/10" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.area}</td>
                  <td className={`px-3 py-2 text-right font-mono ${s.totalLeads === 0 ? "text-destructive" : ""}`}>{s.totalLeads}</td>
                  <td className="px-3 py-2 text-right font-mono text-accent">{s.hotCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.visitsScheduled}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.visitsDone}</td>
                  <td className="px-3 py-2 text-right font-mono text-success">{s.bookedCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.vacantBeds}</td>
                  <td className="px-3 py-2">{s.topTcmName}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{s.topObj}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/leads"
                      search={{ area: s.area }}
                      className="text-accent hover:underline text-[10px]"
                    >
                      View Leads &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    No properties loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminShell>
  );
}
