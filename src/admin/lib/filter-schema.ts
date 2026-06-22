/**
 * Admin filter shape — used as local component state across every admin
 * screen. Same shape drives the Export Center.
 */
export interface AdminFilters {
  q: string;
  stage: string[];
  source: string[];
  assignedTo: string[];
  zone: string[];
  status: Array<"open" | "booked" | "lost" | "dormant">;
  probBucket: Array<"cold" | "warm" | "hot">;
  hasVisit?: boolean;
  booked?: boolean;
  dormant: Array<"30d" | "60d" | "90d">;
  sort: string;
  dateAdded: Array<"today" | "yesterday" | "this-week" | "this-month">;
  addedBy: string[];
}

export const defaultAdminFilters: AdminFilters = {
  q: "",
  stage: [],
  source: [],
  assignedTo: [],
  zone: [],
  status: [],
  probBucket: [],
  dormant: [],
  sort: "updated:desc",
  dateAdded: [],
  addedBy: [],
};

import type { AdminLeadRow } from "./selectors";
import { isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

export function applyFilters(rows: AdminLeadRow[], f: AdminFilters): AdminLeadRow[] {
  let out = rows;
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter((r) =>
      r.lead.name.toLowerCase().includes(q) ||
      r.lead.phone.includes(q) ||
      r.lead.preferredArea.toLowerCase().includes(q) ||
      (r.tcm?.name ?? "").toLowerCase().includes(q),
    );
  }
  if (f.stage.length) out = out.filter((r) => f.stage.includes(r.lead.stage));
  if (f.source.length) out = out.filter((r) => f.source.includes(r.lead.source));
  if (f.assignedTo.length) out = out.filter((r) => f.assignedTo.includes(r.lead.assignedTcmId));
  if (f.zone.length) out = out.filter((r) => f.zone.includes(r.tcm?.zone ?? ""));
  if (f.status.length) out = out.filter((r) => f.status.includes(r.status));
  if (f.probBucket.length) {
    out = out.filter((r) => {
      const b: "cold" | "warm" | "hot" = r.probability >= 70 ? "hot" : r.probability >= 40 ? "warm" : "cold";
      return f.probBucket.includes(b);
    });
  }
  if (f.hasVisit === true) out = out.filter((r) => r.hasVisit);
  if (f.hasVisit === false) out = out.filter((r) => !r.hasVisit);
  if (f.booked === true) out = out.filter((r) => r.booked);
  if (f.booked === false) out = out.filter((r) => !r.booked);
  if (f.dormant.length) out = out.filter((r) => r.dormantBucket && f.dormant.includes(r.dormantBucket));

  if (f.dateAdded?.length) {
    out = out.filter((r) => {
      const d = new Date(r.lead.createdAt);
      return f.dateAdded.some(range => {
        if (range === "today") return isToday(d);
        if (range === "yesterday") return isYesterday(d);
        if (range === "this-week") return isThisWeek(d);
        if (range === "this-month") return isThisMonth(d);
        return false;
      });
    });
  }

  if (f.addedBy?.length) {
    out = out.filter((r) => f.addedBy.includes(r.lead.createdBy || "system"));
  }

  const [field, dir] = f.sort.split(":");
  const mul = dir === "asc" ? 1 : -1;
  out = [...out].sort((a, b) => {
    switch (field) {
      case "name":
        return mul * a.lead.name.localeCompare(b.lead.name);
      case "stage":
        return mul * a.lead.stage.localeCompare(b.lead.stage);
      case "prob":
        return mul * (a.probability - b.probability);
      case "value":
        return mul * (a.expectedValue - b.expectedValue);
      case "updated":
      default:
        return mul * (a.lastTouchTs - b.lastTouchTs);
    }
  });
  return out;
}
