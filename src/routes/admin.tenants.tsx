import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tenants")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw new Error("Unauthorized");
  },
  component: AdminTenants,
});

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/40 text-emerald-400",
  notice: "border-amber-500/40 text-amber-400",
  exited: "border-muted-foreground/30 text-muted-foreground",
};

function healthScore(tenant: { id: string; rent: number; createdAt: string }, payments: Array<{ tenantId: string; amount: number; createdAt: string }>): number {
  const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);
  const tenureMonths = Math.max(1, Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (30 * 86400_000)));
  const onTimeCount = tenantPayments.length;
  const score = Math.min(100, Math.round((onTimeCount / tenureMonths) * 70 + (tenantPayments.reduce((s, p) => s + p.amount, 0) > 50000 ? 15 : 0) + 15));
  return score;
}

function AdminTenants() {
  const { tenants, rents, payments, tcms, properties } = useApp();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.status === "active").length;
    const notice = tenants.filter((t) => t.status === "notice").length;
    const monthlyRent = tenants.filter((t) => t.status === "active").reduce((s, t) => s + t.rent, 0);
    return { total: tenants.length, active, notice, monthlyRent };
  }, [tenants]);

  const filtered = useMemo(() => {
    return tenants
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tenants, statusFilter, search]);

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id;
  const openRents = (tenantId: string) => rents.filter((r) => r.tenantId === tenantId && r.status !== "paid").length;

  return (
    <AdminShell title="Tenants" sub="Active tenants, rent ledgers, and occupancy management">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total tenants", value: stats.total, accent: "text-foreground" },
          { label: "Active", value: stats.active, accent: "text-emerald-400" },
          { label: "Notice period", value: stats.notice, accent: "text-amber-400" },
          { label: "Monthly rent", value: `₹${(stats.monthlyRent / 1000).toFixed(1)}K`, accent: "text-blue-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={`text-xl font-display font-semibold ${k.accent}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card mt-3">
        <div className="p-3 border-b border-border flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="h-8 text-xs rounded-md border border-border bg-background px-2.5 w-64 outline-none focus:border-accent"
          />
          {["all", "active", "notice", "exited"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Property</th>
                <th className="text-left px-3 py-2 font-medium">Phone</th>
                <th className="text-right px-3 py-2 font-medium">Rent</th>
                <th className="text-right px-3 py-2 font-medium">Deposit</th>
                <th className="text-right px-3 py-2 font-medium">Health</th>
                <th className="text-right px-3 py-2 font-medium">Pending rents</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const score = healthScore(t, payments);
                const pending = openRents(t.id);
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link to="/admin/tenants/$id" params={{ id: t.id }} className="text-accent hover:underline font-medium">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{propName(t.propertyId)}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{t.phone}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{t.rent.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{t.deposit.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono ${
                        score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-destructive"
                      }`}>
                        {score}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {pending > 0 ? (
                        <span className="text-destructive font-mono">{pending}</span>
                      ) : (
                        <span className="text-emerald-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${STATUS_STYLES[t.status] || ""}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No tenants found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
