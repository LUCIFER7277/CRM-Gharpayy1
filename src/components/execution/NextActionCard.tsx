import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send, Check, Clock, AlertTriangle, MessageSquare,
  Phone, CalendarPlus, UserX, RotateCw, Sparkles,
} from "lucide-react";
import type { UnifiedLead } from "@/lib/lead-identity/types";
import {
  computeNextAction, renderForLead, breachState,
  phaseDayLabel, type ObjectionTag,
} from "@/lib/crm10x/execution-engine";
import { 
  useRecordContact, useRecordReply, useSetObjection, 
  useBookTour, useMarkNoShow, useMarkToured, useSetInterestLevel 
} from "@/hooks/api/useExecutionActions";
import { ObjectionChipRow } from "./ObjectionChipRow";
import { PhaseDayBadge } from "./PhaseDayBadge";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function NextActionCard({ lead, compact = false }: { lead: UnifiedLead; compact?: boolean }) {
  const now = useNow(30_000);
  const nowDate = now ? new Date(now) : new Date();
  const action = computeNextAction(lead, nowDate);
  const breach = breachState(lead, nowDate);

  const { mutate: recordContact } = useRecordContact();
  const { mutate: recordReply } = useRecordReply();
  const { mutate: setObjection } = useSetObjection();
  const { mutate: bookTour } = useBookTour();
  const { mutate: markNoShow } = useMarkNoShow();
  const { mutate: markToured } = useMarkToured();
  const { mutate: setInterestLevel } = useSetInterestLevel();

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(action ? renderForLead(action.body, lead) : "");
  const [tourDate, setTourDate] = useState("");

  if (!action) {
    return (
      <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Check className="size-4 text-emerald-500" />
        No next action — lead is at terminal state.
      </Card>
    );
  }

  const rendered = editing ? body : renderForLead(action.body, lead);
  const phoneDigits = (lead.phoneE164 || lead.phoneRaw || "").replace(/\D/g, "");
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(rendered)}`
    : null;

  const breachClass = {
    ok: "border-border",
    due: "border-amber-500/60 bg-amber-500/5",
    breached: "border-rose-500/60 bg-rose-500/5",
    escalated: "border-rose-700 bg-rose-700/10",
  }[breach];

  return (
    <Card className={cn("p-3 space-y-3 border-2 transition-colors", breachClass)}>
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PhaseDayBadge action={action} />
            <span className="text-sm font-semibold truncate">{action.label}</span>
            {breach !== "ok" && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="size-3" />
                {breach.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            Due {new Date(action.dueAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
            <span className="opacity-50">·</span>
            <span>{action.reason}</span>
          </div>
        </div>
      </div>

      {/* script */}
      <div className="rounded-md bg-muted/40 p-2.5 text-[13px] whitespace-pre-wrap leading-relaxed">
        {editing ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[120px] bg-background"
            autoFocus
          />
        ) : rendered}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-1.5">
        {waUrl && (
          <Button
            size="sm"
            asChild
            onClick={() => recordContact({ leadId: lead.id, kind: "wa" })}
          >
            <a href={waUrl} target="_blank" rel="noreferrer">
              <Send className="size-3.5 mr-1" /> Send WhatsApp
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => {
          recordContact({ leadId: lead.id, kind: "wa" });
          toast({ title: "Marked sent", description: action.label });
        }}>
          <Check className="size-3.5 mr-1" /> Mark Sent
        </Button>
        <Button size="sm" variant="outline" onClick={() => {
          recordReply({ leadId: lead.id });
          toast({ title: "Reply logged" });
        }}>
          <MessageSquare className="size-3.5 mr-1" /> Log Reply
        </Button>
        {phoneDigits && (
          <Button size="sm" variant="outline" asChild onClick={() => recordContact({ leadId: lead.id, kind: "call" })}>
            <a href={`tel:+${phoneDigits}`}>
              <Phone className="size-3.5 mr-1" /> Call
            </a>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          <Sparkles className="size-3.5 mr-1" /> {editing ? "Use template" : "Edit"}
        </Button>
      </div>

      {!compact && (
        <>
          {/* phase-specific quick tools */}
          {action.phase <= 2 && (
            <div className="flex items-center gap-1.5">
              <Input
                type="datetime-local"
                value={tourDate}
                onChange={(e) => setTourDate(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!tourDate}
                onClick={() => {
                  bookTour({ leadId: lead.id, scheduledAt: new Date(tourDate).toISOString() });
                  setTourDate("");
                  toast({ title: "Tour booked" });
                }}
              >
                <CalendarPlus className="size-3.5 mr-1" /> Book tour
              </Button>
            </div>
          )}
          {action.phase === 2 && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => markNoShow({ leadId: lead.id })}>
                <UserX className="size-3.5 mr-1" /> No-show
              </Button>
              <Button size="sm" variant="outline" onClick={() => markToured({ leadId: lead.id, level: "WARM" })}>
                <Check className="size-3.5 mr-1" /> Toured
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const d = lead.anchors?.tourDate ? new Date(+new Date(lead.anchors.tourDate) + 24 * 3600_000).toISOString() : new Date().toISOString();
                bookTour({ leadId: lead.id, scheduledAt: d });
              }}>
                <RotateCw className="size-3.5 mr-1" /> Reschedule +1d
              </Button>
            </div>
          )}
          {action.phase === 3 && (
            <div className="flex gap-1.5">
              {(["HOT", "WARM", "COLD"] as const).map((lvl) => (
                <Button
                  key={lvl} size="sm"
                  variant={lead.interestLevel === lvl ? "default" : "outline"}
                  onClick={() => setInterestLevel({ leadId: lead.id, level: lvl })}
                >
                  {lvl}
                </Button>
              ))}
            </div>
          )}

          {/* objection tags */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary objection</div>
            <ObjectionChipRow
              value={lead.primaryObjection as ObjectionTag | null | undefined}
              onChange={(t) => setObjection({ leadId: lead.id, objection: t ?? null })}
            />
          </div>
        </>
      )}
    </Card>
  );
}
