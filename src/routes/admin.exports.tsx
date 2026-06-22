import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { useAuditLog } from "@/lib/crm10x/audit-log";
import { useAuthUser } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  ClipboardCopy,
} from "lucide-react";

export const Route = createFileRoute("/admin/exports")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminExports,
  }
);

function AdminExports() {
  const { leads, tcms, bookings, followUps } = useApp();
  const visitsMap = useVisitWar((s) => s.records);
  const audit = useAuditLog((s) => s.entries);
  const now = new Date().toISOString().slice(0, 10);
  const isAdmin = useAuthUser.getState().user?.role === "super_admin";

  const peopleStats = useMemo(() => {
    const visits = Object.values(visitsMap);
    return tcms.map((tcm) => {
      const myLeads = leads.filter((l) => l.assignedTcmId === tcm.id);
      const myVisits = visits.filter((v) => v.tcmId === tcm.id || v.tcmName === tcm.name);
      const myBookings = bookings.filter((b) => b.tcmId === tcm.id);
      return {
        name: tcm.name,
        zone: tcm.zone,
        leads: myLeads.length,
        visits: myVisits.length,
        booked: myLeads.filter((l) => l.stage === "booked").length,
        lost: myLeads.filter((l) => l.stage === "dropped").length,
        closed: myBookings.reduce((s, b) => s + b.amount, 0),
      };
    });
  }, [tcms, leads, bookings, visitsMap]);

  const visits = useMemo(() => Object.values(visitsMap), [visitsMap]);

  const leadsExport = useMemo(
    () =>
      leads.map((l) => {
        const tcm = tcms.find((t) => t.id === l.assignedTcmId);
        return {
          name: l.name,
          phone: l.phone,
          stage: l.stage,
          tcm: tcm?.name ?? "",
          area: l.preferredArea,
          probability: l.confidence,
          budget: l.budget,
          source: l.source,
          status: l.stage === "dropped" ? "lost" : l.stage === "booked" ? "booked" : "open",
          why_open: "",
          created_at: l.createdAt,
        };
      }),
    [leads, tcms],
  );

  const visitsExport = useMemo(
    () =>
      visits.map((v) => ({
        lead_name: v.leadName,
        tcm: v.tcmName,
        property: v.propertyName,
        stage: v.stage,
        reaction: v.reaction ?? "",
        outcome: v.outcome ?? "",
        scheduled_at: new Date(v.scheduledAt).toISOString(),
      })),
    [visits],
  );

  const auditExport = useMemo(
    () =>
      audit.map((e) => ({
        time: e.ts,
        actor: e.actorName,
        entity_type: e.entityType,
        entity_id: e.entityId,
        action: e.action,
        summary: e.summary,
      })),
    [audit],
  );

  function exportCsv() {
    if (!leadsExport.length) { toast.warning("No leads to export"); return; }
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const cols = ["name", "phone", "stage", "tcm", "area", "probability", "budget", "source", "status", "why_open", "created_at"];
    const header = cols.join(",");
    const body = leadsExport.map((r) => cols.map((c) => esc((r as any)[c])).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gharpayy-leads-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  async function exportXlsx() {
    if (!leadsExport.length) { toast.warning("No leads to export"); return; }
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadsExport), "Leads");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          visitsExport.length ? visitsExport : [{ lead_name: "", tcm: "", property: "", stage: "", reaction: "", outcome: "", scheduled_at: "" }],
        ),
        "Visits",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(peopleStats.length ? peopleStats : [{ name: "", zone: "", leads: 0, visits: 0, booked: 0, lost: 0, closed: 0 }]),
        "People",
      );
      XLSX.writeFile(wb, `gharpayy-report-${now}.xlsx`);
      toast.success("XLSX exported");
    } catch { toast.error("XLSX export failed"); }
  }

  async function exportPdf() {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableMod = await import("jspdf-autotable");
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      doc.setFontSize(20);
      doc.text("Gharpayy — Super Admin Report", 40, 50);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleString("en-IN"), 40, 68);

      const open = leads.filter((l) => l.stage !== "dropped" && l.stage !== "booked");
      const hot = open.filter((l) => l.confidence >= 70);
      const booked = leads.filter((l) => l.stage === "booked");
      const walking = leads.filter((l) => l.stage === "dropped").reduce((s, l) => s + l.budget * 12, 0);
      const revenue = bookings.reduce((s, b) => s + b.amount * 12, 0);

      autoTable(doc, {
        startY: 90,
        head: [["KPI", "Value"]],
        body: [
          ["Pipeline open", String(open.length)],
          ["Hot leads (≥70%)", String(hot.length)],
          ["Booked", String(booked.length)],
          ["Lost", String(leads.filter((l) => l.stage === "dropped").length)],
          ["Walking revenue", `₹${walking.toLocaleString("en-IN")}`],
          ["Booked revenue (annual)", `₹${revenue.toLocaleString("en-IN")}`],
        ],
      });

      const top10 = [...open].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
      autoTable(doc, {
        head: [["Top 10 closeable", "TCM", "Prob", "Budget"]],
        body: top10.map((l) => {
          const tcm = tcms.find((t) => t.id === l.assignedTcmId);
          return [l.name, tcm?.name ?? "—", `${l.confidence}%`, `₹${l.budget.toLocaleString("en-IN")}`];
        }),
      });

      autoTable(doc, {
        head: [["TCM", "Zone", "Leads", "Visits", "Booked", "Lost", "Closed"]],
        body: peopleStats.map((p) => [
          p.name, p.zone, String(p.leads), String(p.visits),
          String(p.booked), String(p.lost), `₹${p.closed.toLocaleString("en-IN")}`,
        ]),
      });

      doc.save(`gharpayy-admin-report-${now}.pdf`);
      toast.success("PDF exported");
    } catch { toast.error("PDF export failed — ensure jspdf is installed"); }
  }

  function exportJson() {
    const dump = {
      exported_at: new Date().toISOString(),
      leads: leadsExport,
      visits: visitsExport,
      people: peopleStats,
      audit_log: auditExport.slice(0, 500),
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gharpayy-snapshot-${now}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON snapshot exported");
  }

  const summaryText = useMemo(() => {
    const open = leads.filter((l) => l.stage !== "dropped" && l.stage !== "booked");
    const hot = open.filter((l) => l.confidence >= 70);
    const booked = leads.filter((l) => l.stage === "booked");
    const top3 = [...open].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    return [
      `*Gharpayy Admin Summary — ${new Date().toLocaleDateString("en-IN")}*`,
      "",
      `📊 Pipeline: ${open.length} open · ${hot.length} hot · ${booked.length} booked`,
      `🏆 Top closeable: ${top3.map((l) => `${l.name} (${l.confidence}%)`).join(", ")}`,
      `👥 TCMs: ${tcms.length} active · ${leads.length} total leads`,
    ].join("\n");
  }, [leads, tcms]);

  return (
    <AdminShell title="Export Center" sub="Download reports, spreadsheets, and data snapshots">
        <div className="grid md:grid-cols-2 gap-4">
          <ExportCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="CSV Export"
            desc="Leads with all columns — name, phone, stage, TCM, area, probability, budget, source, status, created_at"
            action="Download CSV"
            onClick={exportCsv}
            disabled={!isAdmin}
          />
          <ExportCard
            icon={<FileText className="h-5 w-5" />}
            title="XLSX Workbook"
            desc="3 sheets: Leads, Visits (lead name, TCM, property, stage, reaction, outcome), People (TCM stats)"
            action="Download XLSX"
            onClick={exportXlsx}
            disabled={!isAdmin}
          />
          <ExportCard
            icon={<FileText className="h-5 w-5" />}
            title="PDF Report"
            desc="3 pages: KPI summary, Top 10 closeable leads, People 360 table"
            action="Download PDF"
            onClick={exportPdf}
            disabled={!isAdmin}
          />
          <ExportCard
            icon={<FileJson className="h-5 w-5" />}
            title="JSON Snapshot"
            desc="Full data dump: leads[], visits[], people[], audit_log[], exported_at"
            action="Download JSON"
            onClick={exportJson}
            disabled={!isAdmin}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              WhatsApp Copy Blocks
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Admin summary</div>
              <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap font-sans">{summaryText}</pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 text-[10px]"
                onClick={() => { navigator.clipboard.writeText(summaryText); toast.success("Copied"); }}
              >
                <ClipboardCopy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Hot leads alert</div>
              <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap font-sans">
                {`🚨 *Hot leads needing attention* 🚨\n\n${leads
                  .filter((l) => l.confidence >= 70 && l.stage !== "booked" && l.stage !== "dropped")
                  .slice(0, 5)
                  .map((l) => {
                    const tcm = tcms.find((t) => t.id === l.assignedTcmId);
                    return `• ${l.name} — ${l.confidence}% (${tcm?.name ?? "Unassigned"})`;
                  })
                  .join("\n") || "No hot leads right now."}`}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 text-[10px]"
                onClick={() => {
                  const txt = leads
                    .filter((l) => l.confidence >= 70 && l.stage !== "booked" && l.stage !== "dropped")
                    .slice(0, 5)
                    .map((l) => {
                      const tcm = tcms.find((t) => t.id === l.assignedTcmId);
                      return `• ${l.name} — ${l.confidence}% (${tcm?.name ?? "Unassigned"})`;
                    })
                    .join("\n") || "No hot leads right now.";
                  navigator.clipboard.writeText(`🚨 *Hot leads needing attention* 🚨\n\n${txt}`);
                  toast.success("Copied");
                }}
              >
                <ClipboardCopy className="h-3 w-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
        </div>
      </AdminShell>
  );
}

function ExportCard({
  icon, title, desc, action, onClick, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[10px] text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Button
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="self-start"
      >
        <Download className="h-3 w-3 mr-1" /> {action}
      </Button>
    </div>
  );
}
