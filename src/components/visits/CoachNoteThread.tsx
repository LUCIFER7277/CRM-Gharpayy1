import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useVisitWar, type VisitRecord } from "@/lib/visits/war-store";
import { useApp } from "@/lib/store";
import { Siren, ShieldCheck, MessageSquarePlus } from "lucide-react";

export function CoachNoteThread({ v }: { v: VisitRecord }) {
  const { role } = useApp();
  const addCoachNote = useVisitWar((s) => s.addCoachNote);
  const flagIntervention = useVisitWar((s) => s.flagIntervention);
  const clearIntervention = useVisitWar((s) => s.clearIntervention);
  const [text, setText] = useState("");
  const canCoach = role === "hr" || role === "flow-ops";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.15em] text-accent font-bold">Coach notes</span>
        {v.interventionFlag && (
          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-[9px] gap-1">
            <Siren className="h-2.5 w-2.5" /> Intervention flagged
          </Badge>
        )}
      </div>

      {(v.coachNotes ?? []).length === 0 && (
        <div className="text-[11px] text-muted-foreground italic">No coach notes yet.</div>
      )}
      {(v.coachNotes ?? []).map((n) => (
        <div key={n.id} className="p-2 rounded-lg bg-muted/40 border text-[11px]">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-0.5">
            <span className="font-semibold uppercase">{n.by}</span>
            <span className="font-mono tabular-nums">
              {new Date(n.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
          {n.note}
        </div>
      ))}

      {canCoach && (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Drop a coach note (e.g. 'address budget objection up-front next visit')…"
            rows={2}
            className="text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1"
              disabled={!text.trim()}
              onClick={() => { addCoachNote(v.tourId, role, text.trim()); setText(""); }}
            >
              <MessageSquarePlus className="h-3 w-3" /> Save note
            </Button>
            {v.interventionFlag ? (
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-success/40 text-success"
                      onClick={() => clearIntervention(v.tourId)}>
                <ShieldCheck className="h-3 w-3" /> Clear flag
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-destructive/40 text-destructive"
                      onClick={() => flagIntervention(v.tourId, role, text.trim() || "intervention required")}>
                <Siren className="h-3 w-3" /> Flag intervention
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
