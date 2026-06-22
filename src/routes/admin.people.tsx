import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/people")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminPeople,
  }
);

interface TcmStats {
  id: string;
  name: string;
  zone: string;
  leads: number;
  hot: number;
  visits: number;
  booked: number;
  lost: number;
  closed: number;
  convPct: number;
}

function AdminPeople() {
  const { tcms, leads, bookings } = useApp();
  const visitsMap = useVisitWar((s) => s.records);

  const stats = useMemo(() => {
    const visits = Object.values(visitsMap);
    return tcms.map((tcm): TcmStats => {
      const myLeads = leads.filter((l) => l.assignedTcmId === tcm.id);
      const myVisits = visits.filter((v) => v.tcmId === tcm.id || v.tcmName === tcm.name);
      const myBookings = bookings.filter((b) => b.tcmId === tcm.id);
      const booked = myLeads.filter((l) => l.stage === "booked").length;
      const lost = myLeads.filter((l) => l.stage === "dropped").length;
      const hot = myLeads.filter((l) => l.confidence >= 70).length;
      const closed = myBookings.reduce((s, b) => s + b.amount, 0);
      const total = myLeads.length;
      return {
        id: tcm.id,
        name: tcm.name,
        zone: tcm.zone,
        leads: total,
        hot,
        visits: myVisits.length,
        booked,
        lost,
        closed,
        convPct: total > 0 ? Math.round((booked / total) * 100) : 0,
      };
    }).sort((a, b) => b.leads - a.leads);
  }, [tcms, leads, bookings, visitsMap]);

  const cols = [
    { key: "name", label: "TCM" },
    { key: "zone", label: "Zone" },
    { key: "leads", label: "Leads" },
    { key: "hot", label: "Hot" },
    { key: "visits", label: "Visits" },
    { key: "booked", label: "Booked" },
    { key: "lost", label: "Lost" },
    { key: "closed", label: "\u20B9 Closed" },
    { key: "convPct", label: "Conv %" },
  ] as const;

  return (
    <AdminShell title="People 360" sub="TCM performance at a glance">
        <div className="rounded-xl border border-border bg-card overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {cols.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  {cols.map((c) => {
                    const val = row[c.key];
                    const isTcmName = c.key === "name";
                    return (
                      <td key={c.key} className="px-3 py-2">
                        {isTcmName ? (
                          <Link
                            to="/admin/leads"
                            search={{ tcm: row.id }}
                            className="text-accent hover:underline font-medium"
                          >
                            {val}
                          </Link>
                        ) : c.key === "closed" ? (
                          `\u20B9${Number(val).toLocaleString("en-IN")}`
                        ) : c.key === "convPct" ? (
                          <span className={row.booked > 0 ? "text-success" : "text-muted-foreground"}>
                            {val}%
                          </span>
                        ) : c.key === "hot" ? (
                          <span className={row.hot > 0 ? "text-accent" : ""}>{val}</span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={cols.length} className="px-3 py-8 text-center text-muted-foreground">
                    No TCMs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminShell>
  );
}
