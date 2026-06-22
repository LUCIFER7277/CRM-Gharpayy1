/**
 * LeadIntelPanel - drop-in card showing score / SLA / best-time / next-best-action
 * for a single live lead. Subscribes to realtime activity + todo events via
 * useLeadIntel. No props beyond the lead.
 */
import { useLeadIntel } from "@/hooks/useLeadIntel";
import type { Lead } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MessageSquare, Calendar, AlertTriangle, Clock, Sparkles, Flame, Snowflake, Sun } from "lucide-react";

const ACTION_ICON = {
  call: Phone, whatsapp: MessageSquare, schedule_tour: Calendar,
  follow_up: MessageSquare, close: Sparkles, revive: Flame, qualify: Sun,
} as const;

export function LeadIntelPanel({ lead }: { lead: Lead }) {
  const intel = useLeadIntel(lead);
  if (!intel) return null;
  const { score, sla, bestTime, nextBestAction } = { ...intel, nextBestAction: intel.score.nextBestAction };
  const Icon = ACTION_ICON[nextBestAction.kind] ?? Sparkles;
  const bandColor =
    score.band === "hot"  ? "bg-red-500/15 text-red-600 border-red-500/30" :
    score.band === "warm" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                            "bg-blue-500/15 text-blue-600 border-blue-500/30";
  const slaColor =
    sla.status === "breach" ? "text-red-600" :
    sla.status === "warn"   ? "text-amber-600" :
    sla.status === "ok"     ? "text-emerald-600" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Lead Intelligence
          </span>
          {score.band === "hot"  && <Flame      className="h-4 w-4 text-red-500"   />}
          {score.band === "warm" && <Sun        className="h-4 w-4 text-amber-500" />}
          {score.band === "cold" && <Snowflake  className="h-4 w-4 text-blue-500"  />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Booking probability</span>
            <Badge variant="outline" className={bandColor}>{score.score}/100 · {score.band}</Badge>
          </div>
          <Progress value={score.score} className="h-2" />
          <p className="mt-2 text-xs text-foreground/80">{score.recommendation}</p>
        </div>

        {/* Next Best Action */}
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{nextBestAction.label}</span>
            <Badge variant="secondary" className="ml-auto text-xs">{nextBestAction.urgency}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{nextBestAction.reason}</p>
        </div>

        {/* SLA + Best time */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border p-2">
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              {sla.status === "breach" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>SLA · {lead.stage}</span>
            </div>
            <div className={`font-mono font-semibold ${slaColor}`}>{sla.message}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /><span>Best time</span>
            </div>
            <div className="font-mono font-semibold">{bestTime.label}</div>
            <div className="text-[10px] text-muted-foreground">{bestTime.confidence}% confidence</div>
          </div>
        </div>

        {/* Top signals */}
        {score.signals.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Top signals</div>
            <div className="flex flex-wrap gap-1">
              {score.signals.slice(0, 6).map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] ${s.impact > 0 ? "border-emerald-500/40 text-emerald-700" : "border-red-500/40 text-red-700"}`}
                >
                  {s.impact > 0 ? "+" : ""}{s.impact} · {s.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
