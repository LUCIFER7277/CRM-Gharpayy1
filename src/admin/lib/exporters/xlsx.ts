/**
 * XLSX exporter — lazy-imported only when the user actually exports.
 * Builds a multi-sheet workbook.
 */
import type { AdminLeadRow } from "@/admin/lib/selectors";

export async function downloadAdminWorkbook(filename: string, rows: AdminLeadRow[]) {
  const XLSX = await import("xlsx");

  const leadsSheet = rows.map((r) => ({
    Name: r.lead.name,
    Phone: r.lead.phone,
    Source: r.lead.source,
    Stage: r.lead.stage,
    TCM: r.tcm?.name ?? "",
    Zone: r.tcm?.zone ?? "",
    Area: r.lead.preferredArea,
    Budget: r.lead.budget,
    Probability: r.probability,
    ExpectedValue: r.expectedValue,
    Status: r.status,
    Tours: r.tours.length,
    Calls: r.calls.length,
    LastObjection: r.lastObjection?.code ?? "",
    WhyNotClosed: r.whyNotClosed,
    LastTouch: new Date(r.lastTouchTs).toISOString(),
    Created: r.lead.createdAt,
  }));

  const toursSheet = rows.flatMap((r) =>
    r.tours.map((t) => ({
      Lead: r.lead.name,
      TCM: r.tcm?.name ?? "",
      Property: t.propertyId,
      ScheduledAt: new Date(t.scheduledAt).toISOString(),
      Status: t.status,
      Decision: t.decision ?? "",
      PostTourOutcome: t.postTour.outcome ?? "",
    })),
  );

  const objectionsSheet = rows.flatMap((r) =>
    r.objections.map((o) => ({
      Lead: r.lead.name,
      TCM: r.tcm?.name ?? "",
      Code: o.code,
      Resolution: o.resolution,
      Context: o.context,
      Ts: new Date(o.ts).toISOString(),
    })),
  );

  const peopleSheet = (() => {
    const byTcm = new Map<string, { name: string; zone: string; leads: number; booked: number; lost: number }>();
    rows.forEach((r) => {
      if (!r.tcm) return;
      const cur = byTcm.get(r.tcm.id) ?? { name: r.tcm.name, zone: r.tcm.zone, leads: 0, booked: 0, lost: 0 };
      cur.leads += 1;
      if (r.booked) cur.booked += 1;
      if (r.status === "lost") cur.lost += 1;
      byTcm.set(r.tcm.id, cur);
    });
    return [...byTcm.values()];
  })();

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadsSheet), "Leads");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toursSheet), "Tours");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objectionsSheet), "Objections");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "People");
  XLSX.writeFile(wb, filename);
}
