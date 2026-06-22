import { useMemo, useState } from "react";
import {
  pickLeadsForHardAction,
  topSuggestion,
  mapNbaToFocusAction,
  type HardActionKey,
  type LeadFocusAction,
  type ImpactEnrichedPick,
} from "@/lib/crm10x/impact-hard-actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar,
  FileText,
  Flame,
  Handshake,
  Home,
  KeyRound,
  Phone,
  RotateCcw,
  Sparkles,
  ArchiveX,
  ChevronDown,
} from "lucide-react";

type ActionDef = {
  key: HardActionKey;
  label: string;
  sub?: string;
  icon: typeof Phone;
  className: string;
  activeStages: string[];
};

const ACTIONS: ActionDef[] = [
  {
    key: "call-hot",
    label: "Call",
    sub: "HOT",
    icon: Flame,
    className: "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10",
    activeStages: ["new", "contacted"],
  },
  {
    key: "schedule",
    label: "Schedule",
    icon: Calendar,
    className: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20",
    activeStages: ["new", "contacted"],
  },
  {
    key: "quote",
    label: "Quote",
    icon: FileText,
    className: "border-border bg-card hover:border-warning/40 hover:bg-warning/5",
    activeStages: ["tour-done", "on-tour", "tour-scheduled"],
  },
  {
    key: "negotiate",
    label: "Negotiate",
    icon: Handshake,
    className: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
    activeStages: ["negotiation", "quote-sent"],
  },
  {
    key: "book",
    label: "Book",
    icon: Home,
    className: "border-success/40 bg-success/10 text-success hover:bg-success/20",
    activeStages: ["negotiation", "quote-sent"],
  },
  {
    key: "checkin",
    label: "Check-in",
    icon: KeyRound,
    className: "border-border bg-card hover:border-accent/40 hover:bg-accent/5",
    activeStages: ["booked"],
  },
  {
    key: "revive",
    label: "Revive",
    icon: RotateCcw,
    className: "border-border bg-card hover:border-muted-foreground/50 hover:bg-muted/40",
    activeStages: ["not-responding-3d", "not-responding-7d", "dropped"],
  },
];

function leadFirst(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function ActionButton({
  action,
  list,
  onPickLead,
}: {
  action: ActionDef;
  list: ImpactEnrichedPick[];
  onPickLead: (leadId: string, name: string, action: LeadFocusAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = list[0];
  const Icon = action.icon;

  if (list.length === 0) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${action.className}`}
      >
        <span className="inline-flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          {action.label}
          {action.sub ? <span className="text-[9px] uppercase">{action.sub}</span> : null}
        </span>
        <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          0
        </span>
      </button>
    );
  }

  // Single lead — click directly
  if (list.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onPickLead(top.lead.id, top.lead.name, action.key)}
        title={`${action.label} · ${top.lead.name}`}
        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition ${action.className}`}
      >
        <span className="inline-flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          {action.label}
          {action.sub ? <span className="text-[9px] uppercase">{action.sub}</span> : null}
        </span>
        <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          1
        </span>
        <span className="max-w-[58px] truncate text-[10px] opacity-75">
          {leadFirst(top.lead.name)}
        </span>
      </button>
    );
  }

  // Multiple leads — show dropdown
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition ${action.className}`}
        >
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" />
            {action.label}
            {action.sub ? <span className="text-[9px] uppercase">{action.sub}</span> : null}
          </span>
          <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {list.length}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5 space-y-0.5 max-h-72 overflow-y-auto" sideOffset={6}>
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border mb-1">
          {action.label} — {list.length} lead{list.length !== 1 ? "s" : ""}
        </div>
        {list.map((e) => (
          <button
            key={e.lead.id}
            type="button"
            onClick={() => {
              setOpen(false);
              onPickLead(e.lead.id, e.lead.name, action.key);
            }}
            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
          >
            <div className="text-[12px] font-semibold text-foreground truncate">{e.lead.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {e.lead.phone}
              {e.lead.preferredArea ? ` · ${e.lead.preferredArea}` : ""}
              {e.nba?.label ? ` · ${e.nba.label}` : ""}
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ImpactHardActionsBar({
  enriched,
  onPickLead,
  onOpenDropped,
}: {
  enriched: ImpactEnrichedPick[];
  onPickLead: (leadId: string, name: string, action: LeadFocusAction) => void;
  onOpenDropped?: () => void;
}) {
  const picks = useMemo(() => {
    const map = {} as Record<HardActionKey, ImpactEnrichedPick[]>;
    (["call-hot", "schedule", "quote", "negotiate", "book", "checkin", "revive"] as HardActionKey[]).forEach(
      (key) => {
        map[key] = pickLeadsForHardAction(key, enriched, 20);
      },
    );
    return map;
  }, [enriched]);

  const suggested = useMemo(() => topSuggestion(enriched), [enriched]);

  return (
    <div className="overflow-hidden rounded-lg bg-transparent">
      {/* Suggested now */}
      {suggested && suggested.nba.verb !== "rest" && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-gradient-to-r from-accent/15 via-card to-primary/10 px-3 py-2">
          <Sparkles className="h-4 w-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Suggested now
            </div>
            <div className="text-sm font-semibold">
              {suggested.nba.label} · <span className="text-accent">{suggested.lead.name}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{suggested.nba.reason}</div>
          </div>
          <Button
            size="sm"
            className="h-8 px-4 text-xs font-semibold shrink-0"
            onClick={() =>
              onPickLead(
                suggested.lead.id,
                suggested.lead.name,
                mapNbaToFocusAction(
                  suggested.nba.verb,
                  suggested.column,
                  Boolean(suggested.lastQuote),
                ),
              )
            }
          >
            Do it
          </Button>
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Hard actions
        </span>
        {ACTIONS.map((action) => (
          <ActionButton
            key={action.key}
            action={action}
            list={picks[action.key]}
            onPickLead={onPickLead}
          />
        ))}
        {onOpenDropped && (
          <button
            type="button"
            onClick={onOpenDropped}
            title="View dropped or lost leads"
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-3 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10"
          >
            <ArchiveX className="h-3.5 w-3.5" />
            Dropped
          </button>
        )}
      </div>
    </div>
  );
}
