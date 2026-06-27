import React from "react";
import { format } from "date-fns";
import { Activity, X, Loader2, Calendar, MessageSquare, AlertTriangle, Phone, FileText, CheckCircle2, User, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/api-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityItem } from "./LiveFeedWidget";

function formatBodyPart(part: string) {
  if (!part) return null;
  
  let displayPart = part;
  const bookingMatch = displayPart.match(/Booking ([0-9A-Z]{26})/);
  if (bookingMatch) {
    displayPart = displayPart.replace(` ${bookingMatch[1]}`, "");
  }
  
  const splitIdx = displayPart.indexOf(":");
  if (splitIdx > 0) {
    const key = displayPart.slice(0, splitIdx).trim();
    const value = displayPart.slice(splitIdx + 1).trim();
    
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) {
          return (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="font-medium text-foreground/80 capitalize">{key}:</span>
              {arr.map((item, i) => {
                let displayItem = String(item).replace("impact:", "");
                if (displayItem === "qualification") {
                  displayItem = "Verifying lead's requirements and budget";
                }
                return (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                    {displayItem}
                  </span>
                );
              })}
            </div>
          );
        }
      } catch (e) {}
    }
    
    return (
      <span className="inline-flex items-center mr-3 mt-1">
        <span className="font-medium text-foreground/80 capitalize mr-1">{key}:</span>
        <span className="text-muted-foreground">{value.replace(/"/g, '')}</span>
      </span>
    );
  }
  return <span className="inline-block mr-3 mt-1 font-medium text-foreground/90">{displayPart}</span>;
}

function getEventStyles(kind: string) {
  const k = (kind || "").toLowerCase();
  if (k.includes("tour") || k.includes("visit")) return { icon: Calendar, color: "text-blue-500", bg: "bg-blue-500", lightBg: "bg-blue-500/10", border: "border-blue-500/20", glow: "shadow-[0_0_15px_rgba(59,130,246,0.5)]" };
  if (k.includes("call") || k.includes("phone")) return { icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500", lightBg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]" };
  if (k.includes("message") || k.includes("email") || k.includes("whatsapp")) return { icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500", lightBg: "bg-purple-500/10", border: "border-purple-500/20", glow: "shadow-[0_0_15px_rgba(168,85,247,0.5)]" };
  if (k.includes("alert") || k.includes("escalation") || k.includes("cancel")) return { icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500", lightBg: "bg-rose-500/10", border: "border-rose-500/20", glow: "shadow-[0_0_15px_rgba(244,63,94,0.5)]" };
  if (k.includes("created") || k.includes("approve")) return { icon: CheckCircle2, color: "text-teal-500", bg: "bg-teal-500", lightBg: "bg-teal-500/10", border: "border-teal-500/20", glow: "shadow-[0_0_15px_rgba(20,184,166,0.5)]" };
  if (k.includes("note") || k.includes("update") || k.includes("change")) return { icon: FileText, color: "text-amber-500", bg: "bg-amber-500", lightBg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-[0_0_15px_rgba(245,158,11,0.5)]" };
  
  return { icon: Zap, color: "text-primary", bg: "bg-primary", lightBg: "bg-primary/10", border: "border-primary/20", glow: "shadow-[0_0_15px_rgba(var(--primary),0.5)]" };
}

interface EntityTimelineDrawerProps {
  entityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  entityName?: string;
}

export function EntityTimelineDrawer({ entityId, isOpen, onClose, entityName }: EntityTimelineDrawerProps) {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && entityId) {
      setLoading(true);
      setError(null);
      apiClient.get<{ items: any[] }>(`/activities`, { params: { entityId } })
        .then(data => {
          setActivities(data.items || []);
        })
        .catch(err => {
          console.error("Failed to load timeline", err);
          setError("Failed to load history.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setActivities([]);
    }
  }, [isOpen, entityId]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 border-l border-border/20 shadow-2xl bg-gradient-to-b from-background to-muted/20">
        <SheetHeader className="p-6 border-b border-border/40 bg-card/60 backdrop-blur-xl shrink-0 sticky top-0 z-20">
          <SheetTitle className="flex flex-col gap-1.5 text-left">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Activity Timeline
            </span>
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent truncate pb-1">
              {entityName || "History"}
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
                  <Loader2 className="w-10 h-10 animate-spin text-primary relative z-10" />
                </div>
                <span className="text-sm font-semibold tracking-wide">Loading history...</span>
              </div>
            ) : error ? (
              <div className="text-center py-20 text-destructive text-sm font-semibold bg-destructive/10 rounded-2xl border border-destructive/20">{error}</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm font-semibold">No history found.</div>
            ) : (
              <div className="relative border-l-[3px] border-border/40 ml-5 space-y-10 pb-10">
                {activities.map((a, i) => {
                  const style = getEventStyles(a.kind || a.subject);
                  const Icon = style.icon;
                  
                  return (
                    <div key={a.id || a._id} className="relative pl-10 group">
                      {/* Glowing Dot */}
                      <div className={`absolute -left-[19px] top-1.5 w-9 h-9 rounded-full border-4 border-background flex items-center justify-center z-10 transition-all duration-300 group-hover:scale-110 ${style.bg} ${style.glow}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      
                      {/* Card */}
                      <div className={`flex flex-col gap-1.5 bg-card/60 backdrop-blur-md border ${style.border} p-5 rounded-2xl relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:bg-card/90`}>
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${style.color}`}>
                            {format(new Date(a.occurredAt || a.ts), "MMM d, yyyy • h:mm a")}
                          </span>
                        </div>
                        
                        <h4 className="text-base font-bold text-foreground tracking-tight">
                          {a.subject ? a.subject.replace("Updated: tags", "Updated Lead Tags") : (a.kind || "Event")}
                        </h4>
                        
                        {a.body && (
                          <div className="text-[13px] leading-relaxed mt-2.5 flex flex-wrap items-center bg-muted/40 p-3.5 rounded-xl border border-border/50">
                            {a.body.split("·").map((part: string, i: number) => (
                              <React.Fragment key={i}>
                                {formatBodyPart(part)}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                        
                        {a.actor && (
                          <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${style.lightBg} ${style.color}`}>
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] font-bold text-muted-foreground/80 tracking-wide">
                              {a.actor === 'system' ? 'SYSTEM AUTOMATED' : (a.actorName || a.actor).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
