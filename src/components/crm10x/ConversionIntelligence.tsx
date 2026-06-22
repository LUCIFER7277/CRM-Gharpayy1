import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { useSettings } from "@/myt/lib/settings-context";
import {
  funnelVelocity, agentCohort, weeklyRecommendations,
  zoneSnapshots, objectionLossCorrelation, templatePerformance,
} from "@/lib/crm10x/analytics";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, ArrowRight, Brain, Layers, MessageSquare,
  Sparkles, TrendingDown, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const STAGE_LABEL: Record<string, string> = {
  "new": "New",
  "contacted": "Contacted",
  "tour-scheduled": "Tour set",
  "tour-done": "Tour done",
  "negotiation": "Negotiation",
  "booked": "Booked",
};

const OBJ_LABEL: Record<string, string> = {
  "price-too-high": "Price too high",
  "location-not-suitable": "Location",
  "room-too-small": "Room size",
  "not-ready-yet": "Not ready",
  "comparing-other-pgs": "Comparing PGs",
  "needs-family-approval": "Family approval",
  "food-not-available": "Food",
  "no-ac": "No AC",
  "safety-concern": "Safety",
  "no-response-to-offer": "Silent",
};

/**
 * Conversion Intelligence Engine - manager-grade analytics on top of the
 * raw CRM data. Intentionally numbers-only with explicit recommendations.
 */
export function ConversionIntelligence() {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const tours = useApp((s) => s.tours);
  const bookings = useApp((s) => s.bookings);
  const calls = useCRM10x((s) => s.calls);
  const objections = useCRM10x((s) => s.objections);
  const messageOutcomes = useCRM10x((s) => s.messageOutcomes);
  const { settings } = useSettings();

  const [tab, setTab] = useState<"funnel" | "agents" | "objections" | "zones" | "templates">("funnel");

  const funnel = useMemo(() => funnelVelocity(leads), [leads]);
  const agents = useMemo(
    () => agentCohort(tcms, leads, calls, objections),
    [tcms, leads, calls, objections],
  );
  const recs = useMemo(
    () => weeklyRecommendations({ leads, funnel, objections, agents }),
    [leads, funnel, objections, agents],
  );
  const objLoss = useMemo(
    () => objectionLossCorrelation(leads, objections),
    [leads, objections],
  );
  const zones = useMemo(
    () => zoneSnapshots({ zones: settings.zones, tcms, leads, bookings }),
    [settings.zones, tcms, leads, bookings],
  );
  const templates = useMemo(() => templatePerformance(messageOutcomes), [messageOutcomes]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" /> Conversion Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time funnel velocity, drop-off heatmap, agent cohort, objection-loss correlation and template ROI.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["funnel", "agents", "objections", "zones", "templates"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
              className="text-xs h-7 capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </header>

      {/* Auto-recommendations */}
      {recs.length > 0 && (
        <Card className="p-4 space-y-2 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="font-display font-semibold">What to fix this week</h3>
            <Badge variant="outline" className="text-[10px] border-accent text-accent">
              auto · {recs.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {recs.map((r) => (
              <div
                key={r.id}
                className={`rounded-md border p-2.5 ${
                  r.priority === "critical"
                    ? "border-destructive/40 bg-destructive/5"
                    : r.priority === "high"
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {r.title}
                      <Badge
                        variant={r.priority === "critical" ? "destructive" : "outline"}
                        className="text-[9px] uppercase"
                      >
                        {r.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
                    <div className="text-[11px] text-success mt-1 font-medium">
                      💡 {r.expectedImpact}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FUNNEL VELOCITY */}
      {tab === "funnel" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" /> Funnel velocity & drop-off heatmap
            </h3>
            <span className="text-[10px] text-muted-foreground">avg dwell + cohort conversion</span>
          </div>
          <div className="space-y-1.5">
            {funnel.map((row) => {
              const isCrit = row.cohortConv < 20;
              const isLow = row.cohortConv < 35;
              const heat =
                row.dropOffPct >= 80 ? "bg-destructive/30"
                  : row.dropOffPct >= 60 ? "bg-destructive/20"
                  : row.dropOffPct >= 40 ? "bg-warning/20"
                  : "bg-success/15";
              return (
                <div
                  key={row.fromStage}
                  className={`rounded-md p-2 grid grid-cols-12 items-center gap-2 ${heat}`}
                >
                  <div className="col-span-3 text-xs font-medium">
                    {STAGE_LABEL[row.fromStage]}
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    {STAGE_LABEL[row.toStage]}
                  </div>
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    avg <span className="font-mono text-foreground">{row.avgDays}d</span>
                  </div>
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    sample <span className="font-mono text-foreground">{row.sample}</span>
                  </div>
                  <div className="col-span-3 h-2 rounded-full bg-background/80 overflow-hidden">
                    <div
                      className={`h-full ${isCrit ? "bg-destructive" : isLow ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${row.cohortConv}%` }}
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`text-xs font-mono font-bold ${isCrit ? "text-destructive" : isLow ? "text-warning" : "text-success"}`}>
                      {row.cohortConv}% conv
                    </span>
                    <div className="text-[10px] text-muted-foreground">{row.dropOffPct}% drop</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* AGENT COHORT */}
      {tab === "agents" && (
        <Card className="p-4 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Agent cohort · normalised
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left">Agent</th>
                  <th className="text-left">Zone</th>
                  <th className="text-right">Leads</th>
                  <th className="text-right">Conv%</th>
                  <th className="text-right">Calls/lead</th>
                  <th className="text-right">Obj resolved</th>
                  <th className="text-right">Avg resp</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.tcmId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 text-muted-foreground font-mono">#{a.cohortRank}</td>
                    <td className="font-medium">{a.name}</td>
                    <td className="text-muted-foreground text-xs">{a.zone}</td>
                    <td className="text-right">{a.leads}</td>
                    <td className={`text-right font-bold ${a.conv >= 25 ? "text-success" : a.conv >= 15 ? "text-warning" : "text-destructive"}`}>
                      {a.conv}%
                    </td>
                    <td className="text-right">{a.callsPerLead}</td>
                    <td className="text-right">
                      <span className="text-xs">{a.objectionsResolved}/{a.objectionsLogged}</span>
                      <span className="text-muted-foreground text-[10px] ml-1">({a.resolutionRate}%)</span>
                    </td>
                    <td className="text-right text-muted-foreground">{a.avgFirstResponseMins}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* OBJECTIONS */}
      {tab === "objections" && (
        <Card className="p-4 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Objection ↔ loss correlation
          </h3>
          {objLoss.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No objections logged yet. Force-capture on every "Answered" call to populate this.
            </p>
          )}
          {objLoss.map((o) => (
            <div key={o.code} className="grid grid-cols-12 items-center gap-2 text-sm py-1.5 border-b border-border/40">
              <span className="col-span-3 font-medium">{OBJ_LABEL[o.code] ?? o.code}</span>
              <span className="col-span-2 text-xs text-muted-foreground">raised <span className="font-mono text-foreground">{o.raised}</span></span>
              <span className="col-span-2 text-xs text-success">booked <span className="font-mono">{o.booked}</span></span>
              <span className="col-span-2 text-xs text-destructive">lost <span className="font-mono">{o.lost}</span></span>
              <div className="col-span-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-destructive" style={{ width: `${o.lossRate}%` }} />
              </div>
              <span className="col-span-1 text-right text-xs font-mono font-bold text-destructive">{o.lossRate}%</span>
            </div>
          ))}
        </Card>
      )}

      {/* ZONES */}
      {tab === "zones" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4" /> Zone P&L + capacity
            </h3>
            <Link to="/zone-brain">
              <Button size="sm" variant="outline" className="text-xs h-7">
                Open Zone Brain <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {zones.map((z) => (
              <div
                key={z.zoneId}
                className={`rounded-lg border p-3 space-y-2 ${
                  z.pressureLevel === "leaking" ? "border-destructive/40 bg-destructive/5"
                    : z.pressureLevel === "overloaded" ? "border-warning/40 bg-warning/5"
                    : z.pressureLevel === "underloaded" ? "border-info/40 bg-info/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-semibold text-sm">{z.zoneName}</div>
                    <div className="text-[10px] text-muted-foreground">{z.city} · {z.tcmIds.length} TCM</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      z.pressureLevel === "leaking" ? "border-destructive text-destructive"
                        : z.pressureLevel === "overloaded" ? "border-warning text-warning"
                        : z.pressureLevel === "underloaded" ? "border-info text-info"
                        : "border-success text-success"
                    }`}
                  >
                    {z.pressureLevel}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <Mini label="Leads" value={z.leadCount} />
                  <Mini label="Active" value={z.activeLeads} />
                  <Mini label="Booked" value={z.bookings} />
                  <Mini label="Conv%" value={`${z.conversion}%`} tone={z.conversion >= 20 ? "good" : "bad"} />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <Mini label="₹/mo" value={`₹${(z.revenueINR / 1000).toFixed(0)}k`} />
                  <Mini label="Load/TCM" value={z.loadPerTcm} tone={z.loadPerTcm > 25 ? "bad" : "neutral"} />
                  <Mini label="SLA fail" value={z.slaBreaches} tone={z.slaBreaches >= 3 ? "bad" : "neutral"} />
                </div>
                <div className="text-[11px] text-muted-foreground italic">→ {z.recommendation}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TEMPLATES */}
      {tab === "templates" && (
        <Card className="p-4 space-y-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> WhatsApp template ROI
          </h3>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No template sends logged yet. Use the Smart WhatsApp picker on the lead Dossier tab to start tracking.
            </p>
          ) : (
            <div className="space-y-1.5">
              {templates.map((t) => (
                <div key={t.stage} className="grid grid-cols-12 items-center gap-2 text-sm py-1.5 border-b border-border/40">
                  <span className="col-span-3 font-medium capitalize">{t.stage.replace(/-/g, " ")}</span>
                  <span className="col-span-2 text-xs text-muted-foreground">sent <span className="font-mono text-foreground">{t.sent}</span></span>
                  <span className="col-span-2 text-xs">replies <span className="font-mono">{t.replies}</span></span>
                  <span className="col-span-2 text-xs text-success">booked <span className="font-mono">{t.bookings}</span></span>
                  <div className="col-span-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${t.bookRate}%` }} />
                  </div>
                  <span className="col-span-1 text-right text-xs font-mono font-bold text-success">{t.bookRate}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded bg-background/60 px-1.5 py-1">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs font-bold font-mono ${cls}`}>{value}</div>
    </div>
  );
}
