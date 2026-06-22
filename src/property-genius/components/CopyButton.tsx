// One-click copy button. Shows a tick for 1.2s.

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function CopyButton({ text, label, className, size = "sm" }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };
  return (
    <button
      onClick={onCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 font-medium text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        copied && "border-primary/60 text-primary",
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}
