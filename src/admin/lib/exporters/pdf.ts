/**
 * PDF report exporter — lazy-imported. Branded admin report.
 * NOTE: Requires jspdf and jspdf-autotable packages. Install with:
 * npm install jspdf jspdf-autotable
 */
import type { AdminLeadRow } from "@/admin/lib/selectors";
import { summarizeWhyNotClosing, summarizeTopObjections } from "@/admin/lib/selectors";

export async function downloadAdminPdf(filename: string, rows: AdminLeadRow[]) {
  try {
    const { jsPDF } = await import("jspdf");
    const autoTableMod = await import("jspdf-autotable");
    const autoTable = autoTableMod.default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const open = rows.filter((r) => r.status === "open" || r.status === "dormant");
  const booked = rows.filter((r) => r.booked);
  const lost = rows.filter((r) => r.status === "lost");
  const walking = lost.reduce((s, r) => s + r.lead.budget * 12, 0);
  const hot = open.filter((r) => r.probability >= 70);

  doc.setFontSize(20);
  doc.text("Gharpayy — Super Admin Report", 40, 50);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString("en-IN"), 40, 68);

  autoTable(doc, {
    startY: 90,
    head: [["KPI", "Value"]],
    body: [
      ["Pipeline open", String(open.length)],
      ["Hot leads (≥70%)", String(hot.length)],
      ["Booked", String(booked.length)],
      ["Lost", String(lost.length)],
      ["Walking revenue", `₹${walking.toLocaleString("en-IN")}`],
    ],
  });

  const why = summarizeWhyNotClosing(rows);
  autoTable(doc, {
    head: [["Why leads aren't closing", "Count"]],
    body: why.map((w) => [w.reason, String(w.count)]),
  });

  const obj = summarizeTopObjections(rows);
  autoTable(doc, {
    head: [["Top objection codes", "Count"]],
    body: obj.map((o) => [o.code, String(o.count)]),
  });

  autoTable(doc, {
    head: [["Top 10 closeable in 24h", "TCM", "Prob", "Value"]],
    body: [...open]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10)
      .map((r) => [r.lead.name, r.tcm?.name ?? "—", `${r.probability}%`, `₹${r.expectedValue.toLocaleString("en-IN")}`]),
  });

  doc.save(filename);
  } catch (e) {
    throw new Error(
      `PDF export requires jspdf. Install with: npm install jspdf jspdf-autotable\n\nError: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
