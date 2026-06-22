// Salesforce-style horizontal stage stepper. Click any stage to advance/move
// the lead. Auto-logs on the backend via cmd.lead.change_stage.
import { Check } from "lucide-react";
import { dispatch } from "@/lib/api/command-bus";
import type { Lead } from "@/contracts";

const STAGES: { key: Lead["stage"]; label: string }[] = [
  { key: "new",             label: "New" },
  { key: "contacted",       label: "Contacted" },
  { key: "tour-scheduled",  label: "Tour scheduled" },
  { key: "tour-done",       label: "Tour done" },
  { key: "negotiation",     label: "Negotiation" },
  { key: "booked",          label: "Booked" },
];

interface Props {
  lead: Lead;
  onChanged?: (to: Lead["stage"]) => void;
}

export function StageStepper({ lead, onChanged }: Props) {
  const currentIdx = STAGES.findIndex((s) => s.key === lead.stage);
  const isDropped = lead.stage === "dropped";

  const move = async (to: Lead["stage"]) => {
    if (to === lead.stage) return;
    const r = await dispatch({ type: "cmd.lead.change_stage", payload: { leadId: lead._id, to } });
    if (r.ok) onChanged?.(to);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-stretch w-full overflow-x-auto rounded-md border bg-card">
        {STAGES.map((s, i) => {
          const done = !isDropped && i < currentIdx;
          const active = !isDropped && i === currentIdx;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => move(s.key)}
              className={[
                "flex-1 min-w-[110px] px-3 py-2 text-xs font-medium relative transition-colors",
                active ? "bg-primary text-primary-foreground" :
                done   ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20" :
                         "text-muted-foreground hover:bg-muted",
                i < STAGES.length - 1 ? "border-r" : "",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-1.5">
                {done ? <Check className="h-3 w-3" /> : <span className="inline-block h-4 w-4 rounded-full border text-[10px] leading-4 text-center">{i + 1}</span>}
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => move("dropped")}
          className={`text-[11px] px-2 py-1 rounded border transition-colors ${isDropped ? "bg-destructive/10 text-destructive border-destructive/30" : "text-muted-foreground hover:bg-muted"}`}
        >
          {isDropped ? "Lead dropped" : "Mark as dropped"}
        </button>
      </div>
    </div>
  );
}
