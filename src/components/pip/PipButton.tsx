import { useEffect, useState } from "react";
import { PictureInPicture2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePip, type PipMode } from "./PipProvider";

export function PipButton({ className, mode = "dashboard", label }: { className?: string; mode?: PipMode; label?: string }) {
  const { open, close, active, supported, mode: activeMode } = usePip();
  // Defer the supported check to after mount so SSR + first client paint match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const effectiveSupported = mounted ? supported : true;

  return (
    <Button
      variant={active && activeMode === mode ? "secondary" : "default"}
      size="sm"
      onClick={() => (active && activeMode === mode ? close() : open(mode))}
      disabled={mounted ? (!effectiveSupported && !active) : false}
      className={cn(
        "gap-1.5 h-8 text-xs font-medium shadow-sm",
        active && activeMode === mode && "bg-primary/15 text-primary hover:bg-primary/20",
        className,
      )}
      title={
        !mounted
          ? "Picture-in-Picture"
          : !effectiveSupported
          ? "PiP needs Chrome, Edge, Brave or Opera on desktop"
          : active && activeMode === mode
          ? "Close this Picture-in-Picture window"
          : mode === "capture"
          ? "Open lead capture PiP over WhatsApp"
          : mode === "manage"
          ? "Open lead management PiP over WhatsApp"
          : "Pop the dashboard out as a floating always-on-top window over WhatsApp"
      }
    >
      {active && activeMode === mode ? <X className="h-3.5 w-3.5" /> : <PictureInPicture2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{active && activeMode === mode ? "Exit PiP" : (label ?? "PiP mode")}</span>
    </Button>
  );
}
