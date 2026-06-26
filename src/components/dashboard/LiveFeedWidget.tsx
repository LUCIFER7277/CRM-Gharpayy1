import React from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Activity, User, Building2, Calendar, ClipboardList, Filter, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Types matching the backend response
export type ActivityItem = {
  id: string;
  ts: string;
  kind: string;
  actorName: string;
  actorRole: string;
  leadName: string;
  propertyName: string;
  subject: string;
  body: string;
  meta: any;
};

type LiveFeedProps = {
  feed: {
    items: ActivityItem[];
    categorized: {
      flowOps: ActivityItem[];
      tcm: ActivityItem[];
      adminAndHr: ActivityItem[];
      system: ActivityItem[];
    };
  };
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4 border border-orange-100">
        <ClipboardList className="w-8 h-8 text-orange-300" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No recent activity</h3>
      <p className="text-xs text-muted-foreground">You're all caught up!</p>
    </div>
  );
}

function formatBodyPart(part: string) {
  // If part looks like "key: value", style it
  const splitIdx = part.indexOf(":");
  if (splitIdx > 0) {
    const key = part.slice(0, splitIdx).trim();
    const value = part.slice(splitIdx + 1).trim();
    
    // Parse JSON arrays if it looks like one
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) {
          return (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="font-medium text-foreground/80 capitalize">{key}:</span>
              {arr.map((item, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                  {String(item).replace("impact:", "")}
                </span>
              ))}
            </div>
          );
        }
      } catch (e) {
        // ignore
      }
    }
    
    return (
      <span className="inline-flex items-center mr-3 mt-1">
        <span className="font-medium text-foreground/80 capitalize mr-1">{key}:</span>
        <span className="text-muted-foreground">{value.replace(/"/g, '')}</span>
      </span>
    );
  }
  return <span className="inline-block mr-3 mt-1">{part}</span>;
}

function EventCard({ event, colorClass, forceExpand = false }: { event: ActivityItem, colorClass: string, forceExpand?: boolean }) {
  const [isExpandedLocal, setIsExpandedLocal] = React.useState(forceExpand);
  
  React.useEffect(() => {
    setIsExpandedLocal(forceExpand);
  }, [forceExpand]);

  const isExpanded = isExpandedLocal;
  const timeAgo = formatDistanceToNow(new Date(event.ts), { addSuffix: true });
  const { propertyDetails, tourDetails, assignedToName } = event.meta || {};

  return (
    <div 
      className="flex flex-col p-4 text-sm border-b border-border/50 bg-card relative hover:bg-muted/20 transition-colors min-w-0 w-full cursor-pointer group"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpandedLocal(!isExpandedLocal); }}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", colorClass)} />
      
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-semibold text-xs flex items-center gap-1.5 text-muted-foreground truncate">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{event.actorName}</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">{timeAgo}</span>
        </div>
        
        <div className="flex items-center justify-between gap-2 min-w-0 mt-0.5">
          <div className="flex flex-col min-w-0 flex-1 gap-1.5">
            {/* New Contextual Header */}
            <div className={cn("font-bold text-[13px] break-words leading-snug flex flex-wrap items-center gap-1.5", colorClass.replace("bg-", "text-").replace("-500", "-600"))}>
              {propertyDetails ? (
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {propertyDetails.name}</span>
              ) : (
                <span>Lead: {event.leadName !== "Unknown Lead" ? event.leadName : "New Lead"}</span>
              )}
              
              {assignedToName && (
                <>
                  <span className="text-muted-foreground/50 mx-0.5">•</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/50 text-muted-foreground font-semibold flex items-center gap-1">
                    {event.meta?.assignedToRole === "flow-ops" ? "Flow Ops" : event.meta?.assignedToRole === "hr" ? "HR" : "TCM"}: {assignedToName}
                  </span>
                </>
              )}
              
              {tourDetails && (
                <>
                  <span className="text-muted-foreground/50 mx-0.5">•</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/50 text-muted-foreground font-semibold flex items-center gap-1 capitalize">
                    <Calendar className="w-3 h-3" /> Visit: {tourDetails.status}
                  </span>
                </>
              )}
            </div>
            
            {/* Additional Context Sub-header */}
            {(event.leadStage || event.leadArea || event.leadBudget) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                {event.leadStage && (
                  <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/30 border border-border/40">
                    {event.leadStage.replace("-", " ")}
                  </span>
                )}
                {event.leadArea && (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    {event.leadArea}
                  </span>
                )}
                {event.leadBudget && (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    ₹{event.leadBudget.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors p-1">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" height="16" viewBox="0 0 24 24" fill="none" 
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
              className={cn("transition-transform duration-200", isExpanded ? "rotate-180" : "")}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Action Subject that was moved from header */}
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            {event.subject.replace("Updated: tags", "Updated Lead Tags")}
          </div>

          {/* Show Post-Visit / Meta Info */}
          {tourDetails && tourDetails.outcome && (
            <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-emerald-800">Post-Visit Outcome:</span>
              <span className="text-[12px] text-emerald-700 leading-relaxed break-words">{tourDetails.outcome}</span>
            </div>
          )}

          {event.body && (
            <div className="text-[11px] text-muted-foreground break-words leading-relaxed flex flex-wrap items-center mb-3">
              {event.body.split("·").map((part, i) => (
                <React.Fragment key={i}>
                  {formatBodyPart(part)}
                </React.Fragment>
              ))}
            </div>
          )}

          {event.meta?.rawSource && (
            <div className="mt-4 p-4 rounded-xl border border-border/60 bg-muted/10 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3">
                <div className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                  Data was automatically extracted from <strong>{event.meta.source === "WhatsApp Paste" ? "a WhatsApp message" : event.meta.source}</strong> with <span className="text-foreground/80 font-semibold">{event.meta.aiConfidence || event.meta.confidence || 100}% confidence</span>.
                </div>
              </div>
              
              {event.meta.missing && event.meta.missing.length > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-orange-50/50 border border-orange-100/50">
                  <span className="text-[11px] font-bold text-orange-800 flex items-center tracking-wide uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> 
                    Information still needed
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {event.meta.missing.map((field: string) => {
                      const readable = field
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .replace("Reqs", "Requirements")
                        .replace("Move In", "Move-in Date")
                        .replace("Movein", "Move-in Date")
                        .trim();
                      
                      return (
                        <span key={field} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-white text-orange-700 border border-orange-200 shadow-sm">
                          {readable}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <div className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Original Text</div>
                <div className="relative p-3.5 rounded-lg bg-gradient-to-br from-muted/80 to-muted/30 border border-border/50 text-[11px]">
                  <p className="whitespace-pre-wrap break-words leading-loose font-medium text-foreground/90">
                    {event.meta.rawSource}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function mergeAiEvents(activities: ActivityItem[]): ActivityItem[] {
  const merged: ActivityItem[] = [];
  const skipIds = new Set<string>();

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (skipIds.has(a.id)) continue;

    if (a.kind === "lead_created" || a.kind === "created") {
      const aiEvent = activities.find(
        (x) => x.kind === "ai_parse" && 
               x.id !== a.id && 
               x.actorName === a.actorName && 
               Math.abs(new Date(a.ts).getTime() - new Date(x.ts).getTime()) < 300000 &&
               (x.leadName === a.leadName || (x as any).entityId === (a as any).entityId)
      );

      if (aiEvent) {
        merged.push({
          ...a,
          kind: "lead_created_ai",
          subject: "AI Extraction & Lead Creation",
          meta: {
            ...a.meta,
            ...aiEvent.meta,
          }
        });
        skipIds.add(aiEvent.id);
        continue;
      }
    }

    if (a.kind === "ai_parse") {
      const relatedCreation = activities.find(
        (x) => (x.kind === "lead_created" || x.kind === "created") && 
               x.id !== a.id && 
               x.actorName === a.actorName && 
               Math.abs(new Date(a.ts).getTime() - new Date(x.ts).getTime()) < 300000 &&
               (x.leadName === a.leadName || (x as any).entityId === (a as any).entityId)
      );

      if (relatedCreation) {
        continue; // Handled when lead_created is processed
      }
    }

    merged.push(a);
  }

  return merged;
}

export function LiveFeedWidget({ feed }: LiveFeedProps) {
  const [expandFlowOps, setExpandFlowOps] = React.useState(false);

  if (!feed || !feed.categorized) return null;

  const adminAndSystem = [...feed.categorized.system, ...feed.categorized.adminAndHr].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const mergedFlowOps = React.useMemo(() => mergeAiEvents(feed.categorized.flowOps), [feed.categorized.flowOps]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col mb-10 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-border/50 gap-4 bg-muted/10 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-orange-100 border border-orange-200 text-orange-600">
            <Activity className="w-3.5 h-3.5 shrink-0" />
          </div>
          <h2 className="text-sm font-bold text-foreground truncate">Global Activity Feed</h2>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none min-w-0 w-full sm:w-auto">
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">All Feeds</button>
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground whitespace-nowrap">FlowOps</button>
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground whitespace-nowrap">TCM</button>
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground whitespace-nowrap">System & Admin</button>
          <button type="button" className="text-xs font-semibold px-3 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5 whitespace-nowrap ml-2">
            <Filter className="w-3 h-3 shrink-0" /> Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/50 min-w-0 w-full">
        {/* Column 1: FlowOps */}
        <div className="flex flex-col h-[500px] min-w-0 w-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <h3 className="text-xs font-bold truncate">FlowOps Feed</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link 
                to="/activity"
                className="text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
              >
                View All FlowOps
              </Link>
              <span className="text-xs font-bold text-foreground">{mergedFlowOps.length}</span>
            </div>
          </div>
          <ScrollArea className="flex-1 bg-card min-w-0">
            <div className="flex flex-col min-w-0">
              {mergedFlowOps.length > 0 ? (
                mergedFlowOps.map(e => <EventCard key={e.id} event={e} colorClass="bg-blue-500" forceExpand={expandFlowOps} />)
              ) : (
                <EmptyState />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: TCM */}
        <div className="flex flex-col h-[500px] min-w-0 w-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <h3 className="text-xs font-bold truncate">TCM Feed</h3>
            </div>
            <span className="text-xs font-bold text-foreground shrink-0">{feed.categorized.tcm.length}</span>
          </div>
          <ScrollArea className="flex-1 bg-card min-w-0">
            <div className="flex flex-col min-w-0">
              {feed.categorized.tcm.length > 0 ? (
                feed.categorized.tcm.map(e => <EventCard key={e.id} event={e} colorClass="bg-orange-500" />)
              ) : (
                <EmptyState />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 3: System & Admin */}
        <div className="flex flex-col h-[500px] min-w-0 w-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <h3 className="text-xs font-bold truncate">System & Admin Feed</h3>
            </div>
            <span className="text-xs font-bold text-foreground shrink-0">{adminAndSystem.length}</span>
          </div>
          <ScrollArea className="flex-1 bg-card min-w-0">
            <div className="flex flex-col min-w-0">
              {adminAndSystem.length > 0 ? (
                adminAndSystem.map(e => <EventCard key={e.id} event={e} colorClass="bg-purple-500" />)
              ) : (
                <EmptyState />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
