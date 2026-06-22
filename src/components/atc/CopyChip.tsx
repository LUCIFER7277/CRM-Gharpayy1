import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/impact/copy-formats";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  label?: string;
  toastLabel?: string;
  size?: "xs" | "sm";
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
  iconOnly?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function CopyChip({
  text, label = "Copy", toastLabel = "Copied — paste in WhatsApp",
  size = "sm", variant = "outline", className, iconOnly = false, onClick,
}: Props) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={cn(
        "gap-1",
        size === "xs" ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-[11px]",
        done && "border-success/50 text-success",
        className,
      )}
      onClick={async (e) => {
        e.stopPropagation();
        onClick?.(e);
        const ok = await copyToClipboard(text);
        if (ok) {
          setDone(true);
          toast.success(toastLabel);
          setTimeout(() => setDone(false), 1500);
        } else {
          toast.error("Copy failed");
        }
      }}
      title={label}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {!iconOnly && <span>{done ? "Copied" : label}</span>}
    </Button>
  );
}
