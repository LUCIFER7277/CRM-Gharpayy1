import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { format } from "date-fns";
import { Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/lib/types";
import { ClientOnly } from "@/components/ClientOnly";

/**
 * FlowOps ↔ TCM handoff thread for a single lead.
 * Real-life: FlowOps queues hot leads, TCMs ack & close, both leave context.
 */
export function HandoffThread({ leadId }: { leadId: string }) {
  const { handoffs, sendHandoff, role, tcms, currentTcmId } = useApp();
  const thread = handoffs.filter((h) => h.leadId === leadId).sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  const [text, setText] = useState("");

  const myRole: Role = role;
  const send = (priority: "normal" | "urgent") => {
    if (!text.trim()) return;
    sendHandoff({ leadId, from: myRole, fromId: role === "tcm" ? currentTcmId : role, text, priority });
    setText("");
    toast.success(priority === "urgent" ? "Urgent handoff sent" : "Handoff sent");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-thin pr-1">
        {thread.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-3">
            No handoff messages yet. FlowOps and TCM use this thread for context.
          </div>
        )}
        {thread.map((h) => {
          const mine = h.from === myRole && (myRole !== "tcm" || h.fromId === currentTcmId);
          const fromLabel = h.from === "flow-ops"
            ? "Flow Ops"
            : h.from === "tcm"
              ? tcms.find((t) => t.id === h.fromId)?.name ?? "TCM"
              : "HR";
          return (
            <div key={h.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12px] ${
                h.priority === "urgent"
                  ? "bg-destructive/10 border border-destructive/30 text-foreground"
                  : mine
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-foreground"
              }`}>
                <div className={`text-[10px] ${mine && h.priority !== "urgent" ? "text-accent-foreground/80" : "text-muted-foreground"} mb-0.5 flex items-center gap-1`}>
                  {h.priority === "urgent" && <span className="font-bold text-destructive">URGENT</span>}
                  <span>{fromLabel}</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                  <span>{h.to === "flow-ops" ? "Flow Ops" : h.to === "tcm" ? "TCM" : "HR"}</span>
                  <ClientOnly fallback={<span suppressHydrationWarning>· …</span>}>
                    <span>· {format(new Date(h.ts), "MMM d, p")}</span>
                  </ClientOnly>
                </div>
                <div>{h.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={role === "flow-ops" ? "Brief the TCM…" : role === "tcm" ? "Update Flow Ops…" : "Note for the team…"}
          rows={2}
          className="text-sm resize-none"
        />
        <div className="flex flex-col gap-1">
          <Button size="sm" disabled={!text.trim()} onClick={() => send("normal")} className="h-8">
            <Send className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant="destructive" disabled={!text.trim()}
            onClick={() => send("urgent")} className="h-8 text-[10px] px-2"
            title="Mark urgent - pages the other side"
          >
            URGENT
          </Button>
        </div>
      </div>
    </div>
  );
}
