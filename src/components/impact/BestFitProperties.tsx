import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/types";
import { Home, MapPin, IndianRupee, Sparkles, Eye } from "lucide-react";
import { matchLead, rating, type Lead as MatchLead } from "@/property-genius/lib/matcher";
import type { PG } from "@/property-genius/data/types";
import { PGDetail } from "@/property-genius/components/PGDetail";

/**
 * Best-fit properties — now powered by the full property-genius catalog
 * (PGS + landmark intelligence + budget/area scorer).
 *
 * Pick → returns the PG to the caller (e.g. fills a Schedule sheet).
 * View → opens the rich PGDetail dossier inline so the TCM can grab
 * everything (scripts, persona, owner contact, WA card) without leaving.
 */
export function BestFitProperties({
  lead,
  onPick,
  limit = 5,
}: {
  lead: Lead;
  onPick?: (pg: PG) => void;
  limit?: number;
}) {
  const [active, setActive] = useState<PG | null>(null);

  const matchInput: MatchLead = useMemo(
    () => ({
      name: lead.name,
      phone: lead.phone,
      area: lead.preferredArea || "",
      gender: "Any",
      budgetMin: Math.max(0, Math.round(lead.budget * 0.85)),
      budgetMax: Math.round(lead.budget * 1.15),
      audience: "Both",
      occupancy: "Any",
    }),
    [lead.id, lead.budget, lead.preferredArea],
  );

  const top = useMemo(
    () => matchLead(matchInput).filter((r) => !r.disqualified).slice(0, limit),
    [matchInput, limit],
  );

  if (top.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground text-center">
        No PGs in the catalog matched this lead's brief.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-accent flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Best-fit PGs · top {top.length}
        </div>
        <span className="text-[10px] text-muted-foreground">
          Budget ₹{lead.budget.toLocaleString("en-IN")} · {lead.preferredArea || "any zone"}
        </span>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {top.map((r) => {
          const rt = rating(r.total);
          return (
            <li
              key={r.pg.id}
              className="rounded-md border bg-card p-2.5 hover:border-accent/60 transition"
            >
              <div className="flex items-start gap-2">
                <Home className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold truncate">{r.pg.name}</span>
                    <Badge variant="outline" className={`text-[9px] font-mono ${rt.color}`}>
                      {r.total}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">{rt.label}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{r.pg.area}</span>
                    <span>· {r.pg.gender}</span>
                    <span className="flex items-center gap-0.5"><IndianRupee className="h-2.5 w-2.5" />{r.bedLabel}</span>
                    {r.commuteKm !== null && <span>· {r.commuteKm} km</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                    {r.reasoning}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 gap-1"
                    onClick={() => setActive(r.pg)}
                    title="Open property dossier"
                  >
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  {onPick && (
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => onPick(r.pg)}
                    >
                      Pick
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <PGDetail pg={active} onClose={() => setActive(null)} />
    </div>
  );
}
