// Lead Property Dossier — the second dossier alongside SmartDossier.
// Shows the lead's best-fit PGs from the property-genius catalog,
// the area mood card, and one-click access to the full PG dossier.

import { useState } from "react";
import type { Lead } from "@/lib/types";
import { BestFitProperties } from "@/components/impact/BestFitProperties";
import { AreaMoodCard } from "@/property-genius/components/AreaPlus";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Building2 } from "lucide-react";
import type { PG } from "@/property-genius/data/types";

export function LeadPropertyDossier({
  lead,
  onPickPg,
}: {
  lead: Lead;
  onPickPg?: (pg: PG) => void;
}) {
  const [open, setOpen] = useState(true);
  const area = lead.preferredArea?.trim();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 rounded-md border bg-gradient-to-r from-accent/10 via-card to-primary/5 px-3 py-2 hover:border-accent/60"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Building2 className="h-3.5 w-3.5 text-accent" />
            Property Dossier
            <Badge variant="outline" className="text-[9px] ml-1">
              {area || "no area set"}
            </Badge>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        <BestFitProperties lead={lead} onPick={onPickPg} limit={4} />
        {area && (
          <div className="rounded-md border bg-card p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Area mood — {area}
            </div>
            <AreaMoodCard area={area} />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
