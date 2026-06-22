// Slim ops stub — bridges the property to the main Impact Queue / Bookings store.
import type { PG } from "@/property-genius/data/types";
import { useApp } from "@/lib/store";
import { Users, Wallet, Plus } from "lucide-react";

export function PGBookOps({ pg }: { pg: PG }) {
  const bookings = useApp((s) => s.bookings);
  const leads = useApp((s) => s.leads);
  const pgLeads = leads.filter((l) =>
    (l.preferredArea || "").toLowerCase().includes(pg.area.toLowerCase()),
  );
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
        <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">
          Connected to Impact Queue
        </div>
        <div className="text-muted-foreground">
          Tours, quotes & bookings for <b className="text-foreground">{pg.name}</b> flow through
          the main CRM. Schedule a visit below to push it into the Impact Queue.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-card p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3 w-3" /> Active leads in {pg.area}</div>
          <div className="text-lg font-display font-bold mt-0.5">{pgLeads.length}</div>
        </div>
        <div className="rounded-md border bg-card p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3 w-3" /> Total bookings (org)</div>
          <div className="text-lg font-display font-bold mt-0.5">{bookings.length}</div>
        </div>
      </div>
    </div>
  );
}
