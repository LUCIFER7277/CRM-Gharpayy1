/**
 * Best-Fit drawer panel - Matching Engine v2 with COMPACT cards.
 *
 * Design intent:
 *  - Default view is small: badge, name, area, score, 3 stat chips, primary
 *    actions (Pitch · Send PDF · More). Anything else is hidden behind
 *    "More" so the rep sees A and B above the fold.
 *  - "More" reveals the full dossier: rents, deposit, food, amenities,
 *    safety, manager contacts, maps, brochure link, full property page.
 *  - Direct WhatsApp PDF send: pulls from the Drive folder (or per-PG direct
 *    URL when curated), and pre-builds the customer message.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  MapPin,
  Flame,
  ExternalLink,
  Send,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageCircle,
  Copy,
  ShieldCheck,
  Utensils,
  Navigation,
  GitCompare,
  Award,
  FileText,
  FolderOpen,
} from "lucide-react";
import type { Lead as AppLead } from "@/lib/types";
import { perDayLabel, scarcity } from "@/supply-hub/lib/intel";
import { buildWaCard, telLink, waLink } from "@/supply-hub/lib/wa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/myt/lib/settings-context";
import { useAutomation } from "@/lib/automation";
import type { MatchV2 } from "@/lib/matcher-v2";
import { toast } from "sonner";
import { buildPdfShareMessage, getPropertyAssets } from "@/lib/property-assets";

interface Props {
  lead: AppLead;
  limit?: number;
  onNavigateAway?: () => void;
}

export function SupplyMatchPanel({ lead, limit, onNavigateAway }: Props) {
  const { settings } = useSettings();
  const generateForLead = useAutomation((s) => s.generateForLead);
  const cached = useAutomation((s) => s.matches[lead.id]);

  useEffect(() => {
    generateForLead(lead, settings.matching);
  }, [lead, settings.matching, generateForLead]);

  const result = cached ?? generateForLead(lead, settings.matching);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [showSecondary, setShowSecondary] = useState(false);

  const cap = limit ?? settings.matching.topMatchCount;
  const visiblePrimary = useMemo(
    () => result.primary.filter((m): m is MatchV2 => !!m).slice(0, settings.matching.primaryCount),
    [result.primary, settings.matching.primaryCount],
  );
  const visibleSecondary = useMemo(
    () => result.secondary.slice(0, Math.max(0, cap - visiblePrimary.length)),
    [result.secondary, cap, visiblePrimary.length],
  );

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const sendBothPitch = () => {
    const [a, b] = visiblePrimary;
    if (!a) return;
    const lines: string[] = [
      `Hi ${lead.name},`,
      "",
      "I've shortlisted *2 strong options* for you - please tell me which fits better:",
      "",
      `*Option 1 - ${a.pg.name}* (${a.pg.area})`,
      `${a.bedLabel} · ${a.distance.km != null ? `${a.distance.km} km` : "distance TBC"} · ${a.reasoning}`,
    ];
    if (b) {
      lines.push("", `*Option 2 - ${b.pg.name}* (${b.pg.area})`);
      lines.push(`${b.bedLabel} · ${b.distance.km != null ? `${b.distance.km} km` : "distance TBC"} · ${b.reasoning}`);
    }
    lines.push("", "Want me to lock visit slots for both?", `- Team ${settings.siteName}`);
    window.open(waLink(lead.phone, lines.join("\n")), "_blank", "noopener");
    toast.success("Dual-pitch opened in WhatsApp");
  };

  if (visiblePrimary.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        No supply matches in the verified network.
        <div className="mt-1">Try editing the lead's preferred area or budget, or relax the Settings filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Best fit · Normal fit · Alternatives - top {visiblePrimary.length + visibleSecondary.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {visiblePrimary.length === 2 && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={sendBothPitch}>
              <GitCompare className="mr-1 h-3 w-3" /> Pitch Best+Normal
            </Button>
          )}
          <Link
            to="/supply-hub/match"
            onClick={onNavigateAway}
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Matcher <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {result.singleton && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-[11px] text-foreground/80">
          Only one strong option - widen radius or budget in Settings to surface a Normal fit.
        </div>
      )}

      <div className="space-y-1.5">
        {visiblePrimary.map((m, idx) => (
          <MatchCard
            key={m.pg.id}
            lead={lead}
            match={m}
            label={idx === 0 ? "Best" : "Normal"}
            expanded={!!expandedIds[m.pg.id]}
            onToggle={() => toggleExpanded(m.pg.id)}
            onNavigateAway={onNavigateAway}
            onCopy={copyText}
          />
        ))}
      </div>

      {visibleSecondary.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setShowSecondary((v) => !v)}
            className="inline-flex w-full items-center justify-between rounded-md border border-dashed border-border bg-muted/10 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/30"
          >
            <span>{showSecondary ? "Hide" : "Show"} {visibleSecondary.length} more alternatives</span>
            {showSecondary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showSecondary &&
            visibleSecondary.map((m) => (
              <MatchCard
                key={m.pg.id}
                lead={lead}
                match={m}
                label={`Alt ${m.rank}`}
                expanded={!!expandedIds[m.pg.id]}
                onToggle={() => toggleExpanded(m.pg.id)}
                onNavigateAway={onNavigateAway}
                onCopy={copyText}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  lead,
  match,
  label,
  expanded,
  onToggle,
  onNavigateAway,
  onCopy,
}: {
  lead: AppLead;
  match: MatchV2;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigateAway?: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const { settings } = useSettings();
  const sc = scarcity(match.pg);
  const assets = getPropertyAssets(match.pg);

  const pitchText = buildWaCard(match.pg, {
    leadName: lead.name,
    bedLabel: match.bedLabel,
    commuteKm: match.distance.km,
    landmarkName: lead.preferredArea,
  });
  const leadPitchLink = waLink(lead.phone, pitchText);
  const pdfMsg = buildPdfShareMessage(match.pg, {
    leadName: lead.name,
    siteName: settings.siteName,
    pdfUrl: assets.pdfUrl,
  });
  const pdfWaLink = waLink(lead.phone, pdfMsg);
  const managerCallLink = telLink(match.pg.manager.phone);
  const managerWaLink = waLink(match.pg.manager.phone, `Hi ${match.pg.manager.name}, checking availability for ${match.pg.name}.`);

  const bandClasses =
    match.band === "primary"
      ? "border-accent/50 bg-accent/5"
      : match.band === "strong"
        ? "border-info/40 bg-info/5"
        : "border-border bg-card/60";

  const labelStyle =
    match.band === "primary"
      ? "bg-accent/20 text-accent"
      : match.band === "strong"
        ? "bg-info/20 text-info"
        : "bg-muted text-muted-foreground";

  return (
    <div className={cn("rounded-md border px-2.5 py-2 transition-colors", bandClasses)}>
      {/* Compact header row */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase", labelStyle)}>
          {label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/supply-hub/$id"
              params={{ id: match.pg.id }}
              onClick={onNavigateAway}
              className="truncate text-[13px] font-medium leading-tight hover:text-accent"
            >
              {match.pg.name}
            </Link>
            {sc.hot && (
              <span className="inline-flex items-center gap-0.5 rounded border border-destructive/40 bg-destructive/10 px-1 py-0 text-[9px] font-semibold text-destructive">
                <Flame className="h-2.5 w-2.5" /> {sc.level}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5" />
            <span className="truncate">
              {match.pg.area} · {match.pg.gender} ·{" "}
              <span className="text-foreground/80">{match.bedLabel}</span>
              {match.distance.km != null && (
                <> · {match.distance.km} km · {match.distance.peakMins}m peak</>
              )}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-base font-semibold leading-none">{match.score}%</div>
          <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
            {match.dominantDriver}
          </div>
        </div>
      </div>

      {/* One-line "why" */}
      <div className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Why:</span> {match.reasoning}
        {match.diversityReason && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-accent">
            <Award className="h-2.5 w-2.5" /> {match.diversityReason}
          </span>
        )}
      </div>

      {/* Compact action row - the only buttons in default state */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <a
          href={leadPitchLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:opacity-90"
        >
          <Send className="h-3 w-3" /> Pitch
        </a>
        <a
          href={pdfWaLink}
          target="_blank"
          rel="noreferrer"
          title={assets.pdfIsDirect ? "Sends the curated brochure" : "Opens Drive folder filtered to this property - copy direct link, then send"}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
        >
          <FileText className="h-3 w-3" /> Send PDF
        </a>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onCopy(pitchText, "Pitch")}>
          <Copy className="h-3 w-3" />
        </Button>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {/* Expanded dossier */}
      {expanded && (
        <div className="mt-2 space-y-2.5 rounded-md border border-border bg-background/60 p-2.5">
          {/* Rents */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <Stat label="Single" value={match.pg.prices.single ? `₹${(match.pg.prices.single / 1000).toFixed(0)}k` : "-"} />
            <Stat label="Double" value={match.pg.prices.double ? `₹${(match.pg.prices.double / 1000).toFixed(0)}k` : "-"} />
            <Stat label="Triple" value={match.pg.prices.triple ? `₹${(match.pg.prices.triple / 1000).toFixed(0)}k` : "-"} />
            <Stat label="Deposit" value={match.pg.deposit || "-"} />
            <Stat label="Min stay" value={match.pg.minStay || "-"} />
            <Stat label="Per day" value={match.bedPrice ? perDayLabel(match.bedPrice) : "-"} />
          </div>

          {settings.matching.showScoreBreakdown && (
            <div className="flex flex-wrap gap-1 text-[10px]">
              {match.parts.map((p) => (
                <span
                  key={p.label}
                  className={cn(
                    "rounded border px-1.5 py-0.5",
                    p.pts >= p.max * 0.7
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-muted/20 text-muted-foreground",
                  )}
                >
                  {p.label} {p.pts}/{p.max}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <SectionLabel icon={Utensils}>Food &amp; stay</SectionLabel>
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <Row k="Food" v={match.pg.foodType} />
                <Row k="Meals" v={match.pg.mealsIncluded} />
                <Row k="Cleaning" v={match.pg.cleaning} />
                <Row k="Utilities" v={match.pg.utilities} />
                <Row k="Furnishing" v={match.pg.furnishing} />
                {match.pg.usp && <Row k="USP" v={match.pg.usp} />}
              </div>
            </div>
            <div>
              <SectionLabel icon={ShieldCheck}>Amenities &amp; safety</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {match.pg.amenities.slice(0, 10).map((a) => (
                  <span key={a} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {a}
                  </span>
                ))}
                {match.pg.safety.slice(0, 6).map((s) => (
                  <span key={s} className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {match.pg.nearbyLandmarks.length > 0 && (
            <div>
              <SectionLabel icon={MapPin}>Nearby</SectionLabel>
              <div className="space-y-0.5">
                {match.pg.nearbyLandmarks.slice(0, 4).map((lm) => (
                  <div key={`${match.pg.id}-${lm.n}`} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{lm.n} · {lm.t}</span>
                    <span>{lm.d < 1 ? `${Math.round(lm.d * 1000)}m` : `${lm.d} km`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secondary actions in expanded view */}
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
            <a
              href={assets.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <FileText className="h-3 w-3" /> {assets.pdfIsDirect ? "View brochure" : "Find brochure"}
            </a>
            <a
              href={assets.folderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <FolderOpen className="h-3 w-3" /> Drive folder
            </a>
            {settings.matching.showMapsAction && match.pg.mapsLink && (
              <a href={match.pg.mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">
                <MapPin className="h-3 w-3" /> Maps
              </a>
            )}
            {settings.matching.showManagerContacts && managerCallLink && (
              <a href={managerCallLink} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">
                <Phone className="h-3 w-3" /> Manager
              </a>
            )}
            {settings.matching.showManagerContacts && match.pg.manager.phone && (
              <a href={managerWaLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">
                <MessageCircle className="h-3 w-3" /> WA mgr
              </a>
            )}
            <Link
              to="/myt/schedule"
              onClick={onNavigateAway}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <Navigation className="h-3 w-3" /> Schedule
            </Link>
            <Link
              to="/supply-hub/$id"
              params={{ id: match.pg.id }}
              onClick={onNavigateAway}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> Full page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted/20 px-1.5 py-1">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[11px] font-medium leading-tight">{value}</div>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3 w-3" /> {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="truncate"><span className="text-foreground">{k}:</span> {v}</div>
  );
}
