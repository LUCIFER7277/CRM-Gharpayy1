import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Radio, User, Users, Building2, Crown } from "lucide-react";
import type { Lens } from "@/lib/visits/selectors";

const LENS: Array<{ id: Lens; label: string; icon: typeof Radio }> = [
  { id: "flow-ops",   label: "Flow-Ops",   icon: Radio },
  { id: "tcm",        label: "TCM",        icon: User },
  { id: "hr",         label: "HR / Coach", icon: Users },
  { id: "owner",      label: "Owner",      icon: Building2 },
  { id: "leadership", label: "Leadership", icon: Crown },
];

export function RoleLensSwitcher({ value, onChange }: { value: Lens; onChange: (v: Lens) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-card/60 p-1">
      {LENS.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <Button
            key={id}
            size="sm"
            variant={active ? "default" : "ghost"}
            onClick={() => onChange(id)}
            className={cn(
              "h-7 px-2.5 text-[11px] gap-1.5 font-semibold uppercase tracking-wider",
              !active && "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" /> {label}
          </Button>
        );
      })}
    </div>
  );
}
