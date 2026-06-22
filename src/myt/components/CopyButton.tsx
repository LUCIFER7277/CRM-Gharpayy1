import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/myt/lib/messaging-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
  onCopied?: () => void;
  className?: string;
}

export function CopyButton({ text, size = "sm", variant = "secondary", label = "Copy", onCopied, className }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5", className)}
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          toast.success("Copied - paste into WhatsApp");
          onCopied?.();
          setTimeout(() => setCopied(false), 1800);
        } else {
          toast.error("Copy failed");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {size !== "icon" && <span>{copied ? "Copied" : label}</span>}
    </Button>
  );
}
