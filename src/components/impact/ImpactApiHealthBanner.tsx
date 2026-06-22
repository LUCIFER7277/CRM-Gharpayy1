import { AlertTriangle, RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadsSync } from "@/lib/leads-sync";

export function ImpactApiHealthBanner({ onRetry }: { onRetry?: () => void }) {
  const status = useLeadsSync((s) => s.status);
  const error = useLeadsSync((s) => s.error);

  if (status !== "error") return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm"
    >
      <WifiOff className="h-4 w-4 text-danger shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <div className="font-semibold text-danger flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Can&apos;t load leads — check connection
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {error ?? "The server did not respond. Your queue may look empty until this is fixed."}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1 border-danger/40"
        onClick={() => {
          useLeadsSync.getState().setLoading();
          onRetry?.();
          window.location.reload();
        }}
      >
        <RotateCcw className="h-3 w-3" /> Retry
      </Button>
    </div>
  );
}
