import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tenants/$id")({
  beforeLoad: () => {
    const role = useAuthUser.getState().user?.role;
    if (role !== "super_admin") throw new Error("Unauthorized");
  },
  component: AdminTenantDetail,
});

function AdminTenantDetail() {
  const { id } = Route.useParams();
  const { tenants, bookings, rents, payments, properties, tcms } = useApp();
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const tenant = useMemo(() => tenants.find((t) => t.id === id), [tenants, id]);
  const booking = useMemo(
    () => (tenant ? bookings.find((b) => b.id === tenant.bookingId) : undefined),
    [bookings, tenant],
  );
  const tenantRents = useMemo(
    () => rents.filter((r) => r.tenantId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rents, id],
  );
  const tenantPayments = useMemo(
    () => payments.filter((p) => p.tenantId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [payments, id],
  );

  const propName = (pid: string) => properties.find((p) => p.id === pid)?.name ?? pid;
  const tcmName = (tid: string) => tcms.find((t) => t.id === tid)?.name ?? tid;

  if (!tenant) {
    return (
      <AdminShell title="Tenant" sub="Tenant not found">
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground text-sm">
          Tenant not found.
        </div>
      </AdminShell>
    );
  }

  const dueRents = tenantRents.filter((r) => r.status !== "paid").length;
  const totalPaid = tenantPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <AdminShell title={tenant.name} sub={`Tenant · ${propName(tenant.propertyId)}`}>
      <div className="grid md:grid-cols-3 gap-3">
        {/* Detail card */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 md:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Stat k="Phone" v={tenant.phone} />
            <Stat k="Rent" v={`₹${tenant.rent.toLocaleString("en-IN")}/mo`} />
            <Stat k="Deposit" v={`₹${tenant.deposit.toLocaleString("en-IN")}`} />
            <Stat k="Status" v={
              <span className={tenant.status === "active" ? "text-emerald-400" : tenant.status === "notice" ? "text-amber-400" : "text-muted-foreground"}>
                {tenant.status}
              </span>
            } />
            <Stat k="Move-in" v={new Date(tenant.moveInDate).toLocaleDateString("en-IN")} />
            <Stat k="Property" v={propName(tenant.propertyId)} />
            <Stat k="TCM" v={tcmName(tenant.tcmId)} />
            <Stat k="Total paid" v={`₹${totalPaid.toLocaleString("en-IN")}`} />
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-3">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Notes</div>
            {editNotes ? (
              <div className="flex gap-2">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-1 h-8 text-xs rounded-md border border-border bg-background px-2.5 outline-none focus:border-accent"
                  placeholder="Add a note..."
                />
                <button
                  onClick={() => { useApp.getState().updateTenant(tenant.id, { notes: notes || undefined }); setEditNotes(false); }}
                  className="text-[10px] px-3 py-1 rounded-md bg-accent text-accent-foreground"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <span className="text-xs text-muted-foreground">{tenant.notes || "No notes added."}</span>
                <button onClick={() => { setNotes(tenant.notes || ""); setEditNotes(true); }} className="text-[10px] text-accent hover:underline">
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Status actions */}
          {tenant.status === "active" && (
            <div className="border-t border-border pt-3 flex gap-2">
              <button
                onClick={() => useApp.getState().updateTenantStatus(tenant.id, "notice")}
                className="text-[10px] px-3 py-1.5 rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              >
                Mark notice period
              </button>
            </div>
          )}
          {tenant.status === "notice" && (
            <div className="border-t border-border pt-3 flex gap-2">
              <button
                onClick={() => useApp.getState().updateTenantStatus(tenant.id, "active")}
                className="text-[10px] px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                Reactivate
              </button>
              <button
                onClick={() => useApp.getState().updateTenantStatus(tenant.id, "exited", new Date().toISOString())}
                className="text-[10px] px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Mark exited
              </button>
            </div>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Rent summary</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Monthly rent</span>
                <span className="font-mono">₹{tenant.rent.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span>Due rents</span>
                <span className={`font-mono ${dueRents > 0 ? "text-destructive" : "text-emerald-400"}`}>{dueRents}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid months</span>
                <span className="font-mono">{tenantPayments.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Tenure</span>
                <span className="font-mono">{Math.max(1, Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (30 * 86400_000)))}mo</span>
              </div>
            </div>
          </div>

          {booking && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Booking</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span className="font-mono">₹{booking.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit</span>
                  <span className="font-mono">₹{booking.deposit.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="capitalize">{booking.status}</span>
                </div>
                <Link to="/admin/bookings" className="text-accent hover:underline text-[10px] inline-block mt-1">
                  View all bookings →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rent ledger */}
      <div className="rounded-xl border border-border bg-card p-3 mt-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Rent ledger</div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Month</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-right px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Paid at</th>
              </tr>
            </thead>
            <tbody>
              {tenantRents.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{new Date(r.month + "-01").toLocaleDateString("en-IN", { year: "numeric", month: "short" })}</td>
                  <td className="px-3 py-2 text-right font-mono">₹{r.amount.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono ${r.status === "paid" ? "text-emerald-400" : r.status === "overdue" ? "text-destructive" : "text-amber-400"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
              {!tenantRents.length && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No rent records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment history */}
      {tenantPayments.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 mt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Payment history</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Method</th>
                  <th className="text-left px-3 py-2 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {tenantPayments.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-2 capitalize">{p.type}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{p.amount.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.ref || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-2 bg-muted/20">
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
