import { cn } from "@/lib/utils";
import type { SlaState } from "@/lib/engine";

/** Live SLA dot - green/amber/red. */
export function SlaPulse({ state, label }: { state: SlaState; label?: string }) {
  const cls = {
    ok: "bg-success",
    warn: "bg-warning animate-pulse",
    breach: "bg-destructive animate-pulse",
  }[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {state !== "ok" && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", cls)} />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", cls)} />
      </span>
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </span>
  );
}
