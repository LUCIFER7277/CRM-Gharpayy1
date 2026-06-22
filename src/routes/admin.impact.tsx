import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/impact")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminImpact,
  }
);

function AdminImpact() {
  const { leads, followUps, tcms } = useApp();
  const now = Date.now();

  const analytics = useMemo(() => {
    const all = followUps;
    const overdue = all.filter((f) => !f.done && new Date(f.dueAt).getTime() < now);
    const dueToday = all.filter((f) => {
      const d = new Date(f.dueAt);
      const today = new Date(now);
      return (
        !f.done &&
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
    const completedToday = all.filter((f) => {
      if (!f.done) return false;
      const d = new Date(f.dueAt);
      const today = new Date(now);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });

    const byType = new Map<string, number>();
    all.filter((f) => !f.done).forEach((f) => {
      const t = f.reason || "other";
      byType.set(t, (byType.get(t) ?? 0) + 1);
    });

    const overdueByTcm = new Map<string, { count: number; oldest: number; types: Map<string, number> }>();
    overdue.forEach((f) => {
      if (!f.tcmId) return;
      const cur = overdueByTcm.get(f.tcmId) ?? { count: 0, oldest: 0, types: new Map() };
      cur.count += 1;
      const age = now - new Date(f.dueAt).getTime();
      if (age > cur.oldest) cur.oldest = age;
      cur.types.set(f.reason, (cur.types.get(f.reason) ?? 0) + 1);
      overdueByTcm.set(f.tcmId, cur);
    });

    const ageBuckets = { "<1h": 0, "1-6h": 0, "6-24h": 0, "1-3d": 0, "3d+": 0 };
    overdue.forEach((f) => {
      const age = now - new Date(f.dueAt).getTime();
      const hours = age / 3600000;
      if (hours < 1) ageBuckets["<1h"]++;
      else if (hours < 6) ageBuckets["1-6h"]++;
      else if (hours < 24) ageBuckets["6-24h"]++;
      else if (hours < 72) ageBuckets["1-3d"]++;
      else ageBuckets["3d+"]++;
    });

    const recentCompleted = all
      .filter((f) => f.done)
      .slice(-10)
      .reverse()
      .map((f) => {
        const lead = leads.find((l) => l.id === f.leadId);
        const tcm = tcms.find((t) => t.id === f.tcmId);
        return {
          time: f.dueAt,
          tcmName: tcm?.name ?? "\u2014",
          type: f.reason,
          leadName: lead?.name ?? "\u2014",
        };
      });

    return {
      total: all.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completedToday: completedToday.length,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
      overdueByTcm: [...overdueByTcm.entries()]
        .map(([tcmId, data]) => {
          const tcm = tcms.find((t) => t.id === tcmId);
          const topType = [...data.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "\u2014";
          return {
            tcmName: tcm?.name ?? tcmId,
            count: data.count,
            oldestDays: Math.floor(data.oldest / 86400000),
            topType,
          };
        })
        .sort((a, b) => b.count - a.count),
      ageBuckets,
      recentCompleted,
    };
  }, [followUps, leads, tcms, now]);

  const typeLabels: Record<string, string> = {
    "call": "\uD83D\uDCDE Call back",
    "whatsapp": "\uD83D\uDCF1 WhatsApp follow-up",
    "visit": "\uD83C\uDFE0 Visit follow-up",
    "post-visit": "\uD83D\uDCDD Post-visit capture",
    "re-engage": "\uD83D\uDD04 Re-engage",
  };

  return (
    <AdminShell title="Impact Analytics" sub="Task queue performance and TCM workload">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Tasks</div>
            <div className="text-xl font-display font-semibold">{analytics.total}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</div>
            <div className="text-xl font-display font-semibold text-destructive">{analytics.overdue}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Due Today</div>
            <div className="text-xl font-display font-semibold text-warning">{analytics.dueToday}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed Today</div>
            <div className="text-xl font-display font-semibold text-success">{analytics.completedToday}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Tasks by Type</div>
            <ul className="space-y-1 text-xs">
              {analytics.byType.map(([type, count]) => (
                <li key={type} className="flex justify-between gap-2 px-2 py-1 bg-muted/20 rounded">
                  <span>{typeLabels[type] || type.replace(/-/g, " ")}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
              {!analytics.byType.length && (
                <li className="text-muted-foreground px-2">No pending tasks.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Task Age Distribution</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-medium">Bucket</th>
                  <th className="text-right px-2 py-1.5 font-medium">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "< 1 hour", key: "<1h" as const },
                  { label: "1\u20136 hours", key: "1-6h" as const },
                  { label: "6\u201324 hours", key: "6-24h" as const },
                  { label: "1\u20133 days", key: "1-3d" as const },
                  { label: "3+ days (critical)", key: "3d+" as const },
                ].map((b) => (
                  <tr key={b.key} className="border-b border-border/50">
                    <td className={`px-2 py-1.5 ${b.key === "3d+" ? "text-destructive font-medium" : ""}`}>
                      {b.label}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono ${b.key === "3d+" ? "text-destructive" : ""}`}>
                      {analytics.ageBuckets[b.key]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Overdue by TCM</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-2 py-1.5 font-medium">TCM</th>
                <th className="text-right px-2 py-1.5 font-medium">Overdue Tasks</th>
                <th className="text-right px-2 py-1.5 font-medium">Oldest Task (days)</th>
                <th className="text-left px-2 py-1.5 font-medium">Most Common Type</th>
              </tr>
            </thead>
            <tbody>
              {analytics.overdueByTcm.map((t) => (
                <tr key={t.tcmName} className="border-b border-border/50">
                  <td className="px-2 py-1.5">{t.tcmName}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-destructive">{t.count}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{t.oldestDays}</td>
                  <td className="px-2 py-1.5 capitalize">{t.topType.replace(/-/g, " ")}</td>
                </tr>
              ))}
              {!analytics.overdueByTcm.length && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                    No overdue tasks. Good job!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Recent Completions (last 10)</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-2 py-1.5 font-medium">Time</th>
                <th className="text-left px-2 py-1.5 font-medium">TCM</th>
                <th className="text-left px-2 py-1.5 font-medium">Type</th>
                <th className="text-left px-2 py-1.5 font-medium">Lead</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentCompleted.map((c, i) => (
                <tr key={`${c.time}-${i}`} className="border-b border-border/50">
                  <td className="px-2 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(c.time).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5">{c.tcmName}</td>
                  <td className="px-2 py-1.5 capitalize">{c.type.replace(/-/g, " ")}</td>
                  <td className="px-2 py-1.5">{c.leadName}</td>
                </tr>
              ))}
              {!analytics.recentCompleted.length && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                    No completed tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminShell>
  );
}
