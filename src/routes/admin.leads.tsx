import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { AdminFilterBar } from "@/admin/components/AdminFilterBar";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { applyFilters, defaultAdminFilters, type AdminFilters } from "@/admin/lib/filter-schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/store";
import { reassignLead, forceCloseLead, flagIntervention } from "@/admin/lib/admin-actions";
import { downloadCsv, downloadJson } from "@/admin/lib/exporters/csv";
import { downloadAdminWorkbook } from "@/admin/lib/exporters/xlsx";
import { downloadAdminPdf } from "@/admin/lib/exporters/pdf";
import { toast } from "sonner";
import type { AdminLeadRow } from "@/admin/lib/selectors";
import { useAuthUser } from "@/lib/auth-store";
import { fmtTourScheduleLabel, isTodayIST } from "@/lib/crm10x/dates";

export const Route = createFileRoute("/admin/leads")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminLeads,
  }
);

function AdminLeads() {
  const rows = useAdminRows();
  const { tcms, leads } = useApp();
  const userRole = useAuthUser.getState().user?.role;
  const isAdmin = userRole === "super_admin";
  const [filters, setFilters] = useState<AdminFilters>(defaultAdminFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<AdminLeadRow | null>(null);

  const sources = useMemo(() => Array.from(new Set(leads.map((l) => l.source))), [leads]);
  const addedByOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.createdBy || "system"))).sort(), [leads]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const todayLeads = useMemo(() => leads.filter((l) => isTodayIST(l.createdAt)), [leads]);
  const todaySummary = useMemo(() => {
    const counts = new Map<string, number>();
    todayLeads.forEach(l => {
      const by = l.createdBy || "system";
      counts.set(by, (counts.get(by) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([by, count]) => `${count} by ${by}`).join(", ");
  }, [todayLeads]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const exportRows = (fmt: "csv" | "xlsx" | "pdf" | "json") => {
    const data = filtered.map((r) => ({
      name: r.lead.name,
      phone: r.lead.phone,
      source: r.lead.source,
      stage: r.lead.stage,
      tcm: r.tcm?.name ?? "",
      zone: r.tcm?.zone ?? "",
      area: r.lead.preferredArea,
      budget: r.lead.budget,
      probability: r.probability,
      expectedValue: r.expectedValue,
      status: r.status,
      whyNotClosed: r.whyNotClosed,
      tours: r.tours.length,
      visits: r.visits.length,
      calls: r.calls.length,
      lastObjection: r.lastObjection?.code ?? "",
      lastTouch: new Date(r.lastTouchTs).toISOString(),
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "csv") downloadCsv(`admin-leads-${stamp}.csv`, data);
    else if (fmt === "json") downloadJson(`admin-leads-${stamp}.json`, data);
    else if (fmt === "xlsx")
      downloadAdminWorkbook(`admin-leads-${stamp}.xlsx`, filtered).catch(() => toast.error("XLSX export failed"));
    else if (fmt === "pdf")
      downloadAdminPdf(`admin-leads-${stamp}.pdf`, filtered).catch(() => toast.error("PDF export failed"));
  };

  return (
    <AdminShell title="Master Lead Console" sub={`${filtered.length} of ${rows.length} leads · full control`}>
      <AdminFilterBar filters={filters} onChange={setFilters} tcms={tcms} sources={sources} addedByOptions={addedByOptions} />

      <div className="rounded-xl border border-border bg-card/60 p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : "Select rows for bulk actions"}</div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <Select
              disabled={!isAdmin}
              onValueChange={(tcmId) => {
                [...selected].forEach((id) => reassignLead(id, tcmId, "Bulk reassign"));
                setSelected(new Set());
              }}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder={isAdmin ? "Bulk reassign to…" : "Admin only"} />
              </SelectTrigger>
              <SelectContent>{tcms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={() => exportRows("csv")} className="h-8 text-xs" disabled={!isAdmin} title={!isAdmin ? "Admin only" : ""}>
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportRows("xlsx")} className="h-8 text-xs" disabled={!isAdmin} title={!isAdmin ? "Admin only" : ""}>
            XLSX
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportRows("pdf")} className="h-8 text-xs" disabled={!isAdmin} title={!isAdmin ? "Admin only" : ""}>
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportRows("json")} className="h-8 text-xs" disabled={!isAdmin} title={!isAdmin ? "Admin only" : ""}>
            JSON
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-foreground text-sm">Today's Acquisition</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            <span className="font-medium text-foreground">{todayLeads.length}</span> leads added today.
            {todaySummary ? <span className="ml-1">({todaySummary})</span> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(filtered.map((r) => r.lead.id)) : new Set())
                    }
                  />
                </th>
                <th className="p-2">Name</th>
                <th className="p-2">Stage</th>
                <th className="p-2">Created</th>
                <th className="p-2">TCM</th>
                <th className="p-2">Area</th>
                <th className="p-2 text-right">Prob</th>
                <th className="p-2 text-right">Exp ₹</th>
                <th className="p-2">Status</th>
                <th className="p-2">Why open</th>
                <th className="p-2 text-right">T/V/C</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.lead.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(r.lead.id)} onChange={() => toggle(r.lead.id)} />
                  </td>
                  <td className="p-2">
                    <button onClick={() => setDrawer(r)} className="font-medium hover:underline text-left">
                      {r.lead.name}
                    </button>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.lead.phone}</div>
                  </td>
                  <td className="p-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{r.lead.stage}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="text-[11px]">{fmtTourScheduleLabel(r.lead.createdAt)}</div>
                    <div className="text-[10px] text-muted-foreground">{r.lead.createdBy || "system"}</div>
                  </td>
                  <td className="p-2">{r.tcm?.name ?? "—"}</td>
                  <td className="p-2 truncate max-w-[120px]">{r.lead.preferredArea}</td>
                  <td className="p-2 text-right font-mono text-accent">{r.probability}%</td>
                  <td className="p-2 text-right font-mono">₹{(r.expectedValue / 1000).toFixed(0)}k</td>
                  <td className="p-2 text-[10px]">{r.status}</td>
                  <td className="p-2 text-[10px] text-muted-foreground truncate max-w-[180px]">{r.whyNotClosed}</td>
                  <td className="p-2 text-right font-mono text-[10px]">
                    {r.tours.length}/{r.visits.length}/{r.calls.length}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => forceCloseLead(r.lead.id, "won", r.lead.budget)}
                      >
                        Won
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => forceCloseLead(r.lead.id, "lost", "admin force-close")}
                      >
                        Lost
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => {
                          const note = prompt("Intervention note?");
                          if (note) flagIntervention(r.lead.id, note);
                        }}
                      >
                        Flag
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-muted-foreground">
                    No leads match filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && <LeadDrawer row={drawer} tcms={tcms} onClose={() => setDrawer(null)} />}
    </AdminShell>
  );
}

function LeadDrawer({ row, tcms, onClose }: { row: AdminLeadRow; tcms: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l border-border overflow-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-display font-semibold">{row.lead.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{row.lead.phone}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat k="Stage" v={row.lead.stage} />
          <Stat k="Probability" v={`${row.probability}%`} />
          <Stat k="Status" v={row.status} />
          <Stat k="Expected ₹" v={`₹${row.expectedValue.toLocaleString("en-IN")}`} />
          <Stat k="TCM" v={row.tcm?.name ?? "—"} />
          <Stat k="Area" v={row.lead.preferredArea} />
          <Stat k="Tours / Visits" v={`${row.tours.length} / ${row.visits.length}`} />
          <Stat k="Budget" v={`₹${row.lead.budget.toLocaleString("en-IN")}`} />
        </div>

        <div className="rounded-md border border-border p-2 bg-muted/30 text-xs">
          <div className="text-[10px] uppercase text-muted-foreground">Why open</div>
          <div>{row.whyNotClosed}</div>
        </div>

        {tcms.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Reassign TCM</div>
            <Select onValueChange={(v) => reassignLead(row.lead.id, v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick TCM…" />
              </SelectTrigger>
              <SelectContent>{tcms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.zone}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => forceCloseLead(row.lead.id, "won", row.lead.budget)}>
            Force Won
          </Button>
          <Button size="sm" variant="destructive" onClick={() => forceCloseLead(row.lead.id, "lost", "admin")}>
            Force Lost
          </Button>
        </div>

        {row.objections.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Objection history</div>
            <ul className="space-y-1 text-xs">
              {row.objections.slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between">
                  <span>{o.code}</span>
                  <span className="text-muted-foreground">{o.resolution}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
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
