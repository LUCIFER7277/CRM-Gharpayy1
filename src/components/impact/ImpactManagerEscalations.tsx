import { useMemo } from "react";
import type { TCM } from "@/lib/types";
import type { ImpactEnriched } from "@/components/impact/impact-queue-types";
import { Badge } from "@/components/ui/badge";

export function ImpactManagerEscalations({
  stackSorted,
  tcms,
  role,
}: {
  stackSorted: ImpactEnriched[];
  tcms: TCM[];
  role: string;
}) {
  const byTcm = useMemo(() => {
    const map = new Map<string, ImpactEnriched[]>();
    for (const e of stackSorted) {
      if (e.nba.pressure !== "escalate") continue;
      const id = e.lead.assignedTcmId || "unassigned";
      const list = map.get(id) ?? [];
      list.push(e);
      map.set(id, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [stackSorted]);

  if (role === "tcm" || byTcm.length === 0) return null;

  return (
    <div className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 flex flex-wrap items-center gap-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-danger shrink-0">
        Escalations by TCM
      </div>
      <div className="flex flex-wrap gap-1.5">
        {byTcm.map(([tcmId, leads]) => {
          const tcm = tcms.find((t) => t.id === tcmId);
          const label = tcm?.name
            ? tcm.name.split(" ")[0]
            : tcmId === "unassigned"
              ? "Unassigned"
              : "Unknown Member";
          return (
            <Badge
              key={tcmId}
              variant="outline"
              className="text-[10px] gap-1 border-danger/40 bg-card h-6"
            >
              {label}
              <span className="font-mono font-bold text-danger">{leads.length}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
