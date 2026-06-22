import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/visits")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw redirect({ to: "/" });
  },
  component: AdminVisits,
});

function AdminVisits() {
  const { tours, tcms, leads } = useApp();
  const visitsMap = useVisitWar((s) => s.records);
  const visits = useMemo(() => Object.values(visitsMap), [visitsMap]);

  const data = useMemo(() => {
    const all = [
      ...tours.map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const tcm = tcms.find((m) => m.id === t.tcmId);
        return {
          id: t.id, type: "tour" as const,
          leadName: lead?.name ?? "\u2014",
          tcmName: tcm?.name ?? "\u2014",
          status: t.status,
          scheduledAt: t.scheduledAt,
          outcome: t.postTour?.outcome ?? null,
        };
      }),
      ...visits.map((v) => ({
        id: v.tourId, type: "visit" as const,
        leadName: v.leadName,
        tcmName: v.tcmName,
        status: v.stage,
        scheduledAt: new Date(v.scheduledAt).toISOString(),
        outcome: v.outcome ?? null,
      })),
    ];
    return all.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [tours, visits, leads, tcms]);

  return (
    <AdminShell title="Master Visits" sub={`${data.length} visits and tours across all TCMs`}>
      <div className="rounded-xl border border-border bg-card overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-2">Lead</th>
              <th className="p-2">TCM</th>
              <th className="p-2">Type</th>
              <th className="p-2">Status</th>
              <th className="p-2">Scheduled</th>
              <th className="p-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-2 font-medium">{d.leadName}</td>
                <td className="p-2 text-muted-foreground">{d.tcmName}</td>
                <td className="p-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{d.type}</span>
                </td>
                <td className="p-2 capitalize">{d.status}</td>
                <td className="p-2 text-muted-foreground font-mono">
                  {new Date(d.scheduledAt).toLocaleDateString("en-IN")}
                </td>
                <td className="p-2">{d.outcome ?? "\u2014"}</td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">No visits or tours found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
