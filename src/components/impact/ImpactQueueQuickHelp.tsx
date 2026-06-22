import { useState } from "react";
import { HelpCircle, X, Sparkles, LayoutGrid, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gharpayy.impact.help-dismissed";

export function ImpactQueueQuickHelp() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  if (dismissed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] gap-1 text-muted-foreground"
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY);
          setDismissed(false);
        }}
      >
        <HelpCircle className="h-3 w-3" /> How to use
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 via-card to-primary/5 px-3 py-2.5 flex flex-wrap items-start gap-3">
      <div className="flex-1 min-w-[200px] space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-accent">
          Quick start for TCMs
        </div>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-none">
          <li className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Suggested now → Do it</strong> opens the right tool (schedule, quote, call) for the top lead.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Board columns</strong> show stage: inbox → tour scheduled → on tour day → quote sent → booked. Work left to right.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Pin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Manage focus</strong> pins 3–5 properties to push today; use one filter chip at a time.
            </span>
          </li>
        </ol>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        aria-label="Dismiss help"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
