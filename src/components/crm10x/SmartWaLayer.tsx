import { useMemo, useState } from "react";
import { useApp, getProperty } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { WA_TEMPLATES, renderTemplate, waLink, type TemplateStage } from "@/lib/crm10x/templates";
import { recommendTemplate } from "@/lib/crm10x/analytics";
import { getPropertyAssets, buildPdfShareMessage } from "@/lib/property-assets";
import type { Lead } from "@/lib/types";
import { useSettings } from "@/myt/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Languages,
  MessageSquare,
  Sparkles,
  FileText,
  CheckCircle2,
  History,
  Filter,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PGS as PG_LIST } from "@/supply-hub/data/pgs";

/**
 * Smart WhatsApp Layer - auto-suggests the right template per lead state,
 * offers one-tap multi-property pitch with PDFs, tracks reply outcomes,
 * and writes message-outcome rows for ROI analytics.
 */
export function SmartWaLayer({ lead }: { lead: Lead }) {
  const allTours = useApp((s) => s.tours);
  const properties = useApp((s) => s.properties);
  const tcms = useApp((s) => s.tcms);
  const sendMessage = useApp((s) => s.sendMessage);
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const allCalls = useCRM10x((s) => s.calls);
  const allOutcomes = useCRM10x((s) => s.messageOutcomes);
  const logMessageSend = useCRM10x((s) => s.logMessageSend);
  const markMessageReplied = useCRM10x((s) => s.markMessageReplied);
  const { settings } = useSettings();

  const tours = useMemo(() => allTours.filter((t) => t.leadId === lead.id), [allTours, lead.id]);
  const calls = useMemo(() => allCalls.filter((c) => c.leadId === lead.id), [allCalls, lead.id]);
  const outcomes = useMemo(
    () => allOutcomes.filter((o) => o.leadId === lead.id),
    [allOutcomes, lead.id],
  );

  const lastContactDays = calls[0] ? (Date.now() - +new Date(calls[0].ts)) / 86_400_000 : Infinity;

  const recommendation = useMemo(
    () => recommendTemplate({ lead, tours, lastContactDays }),
    [lead, tours, lastContactDays],
  );

  const [stage, setStage] = useState<TemplateStage>(recommendation.stage);
  const [lang, setLang] = useState<"english" | "hindi">(
    profile?.language === "hindi" ? "hindi" : "english",
  );

  const tour = tours[0];
  const prop = tour ? getProperty(tour.propertyId ?? undefined, properties) : undefined;
  const agent = tcms.find((t) => t.id === lead.assignedTcmId);

  const rendered = useMemo(
    () =>
      renderTemplate(stage, lang, {
        name: lead.name.split(" ")[0],
        agent: agent?.name ?? settings.siteName,
        area: lead.preferredArea,
        budget: Math.round(lead.budget / 1000) + "k",
        property: prop?.name ?? "the property",
        date: tour ? new Date(tour.scheduledAt).toLocaleDateString() : "",
        time: tour
          ? new Date(tour.scheduledAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        price: prop?.pricePerBed ?? lead.budget,
        phone: lead.phone,
      }),
    [stage, lang, lead, agent, prop, tour, settings.siteName],
  );

  const sendNow = () => {
    window.open(waLink(lead.phone, rendered), "_blank", "noopener,noreferrer");
    const rec = logMessageSend({
      leadId: lead.id,
      stage,
      language: lang,
      loggedBy: lead.assignedTcmId,
    });
    sendMessage(lead.id, `[${WA_TEMPLATES[stage].label} · ${lang}] sent`);
    toast.success("WhatsApp opened - reply tracker enabled", {
      action: {
        label: "Mark replied",
        onClick: () => {
          markMessageReplied(rec.id);
          toast.success("Reply logged");
        },
      },
      duration: 6000,
    });
  };

  // Multi-property pitch: pick top 2 PGs near lead's area
  const matchedPgs = useMemo(() => {
    const area = lead.preferredArea.toLowerCase();
    const filtered = PG_LIST.filter(
      (pg) => pg.area.toLowerCase().includes(area) || area.includes(pg.area.toLowerCase()),
    );
    return (filtered.length ? filtered : PG_LIST).slice(0, 2);
  }, [lead.preferredArea]);

  const sendPdfPitch = (pg: (typeof matchedPgs)[number]) => {
    const assets = getPropertyAssets(pg);
    const msg = buildPdfShareMessage(pg, {
      leadName: lead.name.split(" ")[0],
      siteName: settings.siteName,
      pdfUrl: assets.pdfUrl,
    });
    window.open(waLink(lead.phone, msg), "_blank", "noopener,noreferrer");
    logMessageSend({
      leadId: lead.id,
      stage: "follow-up",
      language: lang,
      loggedBy: lead.assignedTcmId,
      notes: `PDF pitch · ${pg.name}`,
    });
    sendMessage(lead.id, `PDF pitch sent · ${pg.name}`);
    toast.success(`Brochure sent · ${pg.name}`);
  };

  // (timeline component handles its own filtering - see MessageTimeline below)
  const repliedCount = outcomes.filter((o) => o.replied).length;
  const totalSent = outcomes.length;
  const replyRate = totalSent === 0 ? 0 : Math.round((repliedCount / totalSent) * 100);

  return (
    <div className="space-y-3">
      {/* Recommendation banner */}
      <div
        className={`rounded-lg border p-3 flex items-start gap-2 ${
          recommendation.urgency === "high"
            ? "border-accent/40 bg-accent/5"
            : recommendation.urgency === "medium"
              ? "border-warning/40 bg-warning/5"
              : "border-border bg-card"
        }`}
      >
        <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
        <div className="flex-1 text-xs">
          <div className="font-semibold flex items-center gap-1.5">
            Recommended: {WA_TEMPLATES[recommendation.stage].label}
            <Badge variant="outline" className="text-[9px] uppercase">
              {recommendation.urgency}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-0.5">{recommendation.reason}</div>
        </div>
        {stage !== recommendation.stage && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] shrink-0"
            onClick={() => setStage(recommendation.stage)}
          >
            Use it
          </Button>
        )}
      </div>

      {/* Template picker - grouped by intent */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <MessageSquare className="h-3.5 w-3.5" /> Template picker
        </div>
        {(["core", "non-responder", "scenario", "revival"] as const).map((g) => {
          const items = (
            Object.entries(WA_TEMPLATES) as [TemplateStage, (typeof WA_TEMPLATES)[TemplateStage]][]
          ).filter(([, v]) => v.group === g);
          if (items.length === 0) return null;
          const groupLabel: Record<typeof g, string> = {
            core: "Core lifecycle",
            "non-responder": "Non-responder ladder",
            scenario: "Scenario-specific",
            revival: "Revival",
          };
          return (
            <div key={g} className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                {groupLabel[g]}
              </div>
              <div className="flex gap-1 flex-wrap">
                {items.map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setStage(k)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                      stage === k
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setLang("english")}
            className={`flex-1 text-[10px] py-1 rounded-md border transition-colors ${
              lang === "english" ? "border-accent bg-accent/10 text-accent" : "border-border"
            }`}
          >
            <Languages className="inline h-3 w-3 mr-1" /> English
          </button>
          <button
            onClick={() => setLang("hindi")}
            className={`flex-1 text-[10px] py-1 rounded-md border transition-colors ${
              lang === "hindi" ? "border-accent bg-accent/10 text-accent" : "border-border"
            }`}
          >
            <Languages className="inline h-3 w-3 mr-1" /> हिंदी
          </button>
        </div>
        <Textarea readOnly value={rendered} rows={4} className="text-xs resize-none" />
        <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={sendNow}>
          <ExternalLink className="h-3 w-3" /> Send via WhatsApp
        </Button>
      </div>

      {/* Multi-property pitch with PDFs */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <FileText className="h-3.5 w-3.5" /> Pitch property + PDF (one-tap)
        </div>
        <div className="space-y-1.5">
          {matchedPgs.map((pg) => {
            const assets = getPropertyAssets(pg);
            return (
              <div key={pg.id} className="flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{pg.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {pg.area} · {assets.pdfIsDirect ? "Direct PDF" : "Drive search"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => sendPdfPitch(pg)}
                >
                  <FileText className="h-3 w-3" /> Send brochure
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-lead message timeline (sent · replied · booked-after) with template filter */}
      {totalSent > 0 && (
        <MessageTimeline
          lead={lead}
          outcomes={outcomes}
          onMarkReplied={markMessageReplied}
          replyRate={replyRate}
          repliedCount={repliedCount}
          totalSent={totalSent}
          bookedAfterCount={outcomes.filter((o) => o.bookedAfter).length}
        />
      )}
    </div>
  );
}

function MessageTimeline({
  lead,
  outcomes,
  onMarkReplied,
  replyRate,
  repliedCount,
  totalSent,
  bookedAfterCount,
}: {
  lead: Lead;
  outcomes: ReturnType<typeof useCRM10x.getState>["messageOutcomes"];
  onMarkReplied: (id: string) => void;
  replyRate: number;
  repliedCount: number;
  totalSent: number;
  bookedAfterCount: number;
}) {
  const [filter, setFilter] = useState<"all" | string>("all");
  const stages = Array.from(new Set(outcomes.map((o) => o.stage)));
  const filtered = filter === "all" ? outcomes : outcomes.filter((o) => o.stage === filter);
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="font-semibold flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Message timeline · {lead.name.split(" ")[0]}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> {repliedCount}/{totalSent} · {replyRate}%
          </Badge>
          {bookedAfterCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-success/50 text-success">
              <Trophy className="h-2.5 w-2.5" /> {bookedAfterCount} booked-after
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <button
          onClick={() => setFilter("all")}
          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
            filter === "all" ? "border-accent bg-accent/10 text-accent" : "border-border"
          }`}
        >
          All
        </button>
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
              filter === s ? "border-accent bg-accent/10 text-accent" : "border-border"
            }`}
          >
            {s.replace(/-/g, " ")}
          </button>
        ))}
      </div>
      <ol className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
        {filtered.length === 0 && (
          <li className="text-[11px] text-muted-foreground py-2 text-center">
            No sends for this filter.
          </li>
        )}
        {filtered.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-2 text-[11px] border-l-2 pl-2 py-0.5
            border-border"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium capitalize">{m.stage.replace(/-/g, " ")}</span>
                <span className="text-[9px] uppercase font-mono text-muted-foreground">
                  {m.language}
                </span>
                {m.replied && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1 border-info/40 text-info"
                  >
                    replied
                  </Badge>
                )}
                {m.bookedAfter && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1 border-success/50 text-success gap-0.5"
                  >
                    <Trophy className="h-2 w-2" /> booked
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-[10px]">
                {new Date(m.ts).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {m.notes && <span> · {m.notes}</span>}
              </div>
            </div>
            {!m.replied && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] shrink-0"
                onClick={() => {
                  onMarkReplied(m.id);
                  toast.success("Reply logged");
                }}
              >
                Mark replied
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
