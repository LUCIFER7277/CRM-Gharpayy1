import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useAuthUser } from "@/lib/auth-store";
import { format, isToday, isYesterday } from "date-fns";
import {
  Activity, MessageSquare, Calendar, CheckCircle2, AlertTriangle, Phone,
  ClipboardCheck, FileText, ArrowRightLeft, Building2, MapPin
} from "lucide-react";
import type { ActivityKind } from "@/lib/types";
import { personName } from "@/lib/people";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [{ title: "Activity - Gharpayy" }, { name: "description", content: "Auto-generated activity log across all leads, tours and follow-ups." }],
  }),
  component: ActivityPage,
});

const ICON: Record<ActivityKind, typeof Activity> = {
  lead_created: Activity,
  status_changed: ArrowRightLeft,
  tour_scheduled: Calendar,
  tour_started: Calendar,
  tour_completed: CheckCircle2,
  tour_cancelled: AlertTriangle,
  decision_logged: FileText,
  booking_confirmed: CheckCircle2,
  post_tour_filled: ClipboardCheck,
  follow_up_set: Calendar,
  follow_up_done: CheckCircle2,
  note_added: FileText,
  message_sent: MessageSquare,
  call_logged: Phone,
  site_visit: Calendar,
  escalation: AlertTriangle,
  stale_alert: AlertTriangle,
};

function ActivityPage() {
  const { activities, leads, tcms, tours, properties, selectLead } = useApp();
  const authUser = useAuthUser((s) => s.user);

  const groupedActivities = activities.reduce((acc, activity) => {
    const date = new Date(activity.ts);
    let dateLabel = format(date, "MMMM d, yyyy");
    if (isToday(date)) dateLabel = "Today";
    else if (isYesterday(date)) dateLabel = "Yesterday";
    
    if (!acc[dateLabel]) {
      acc[dateLabel] = [];
    }
    acc[dateLabel].push(activity);
    return acc;
  }, {} as Record<string, typeof activities>);

  return (
    <AppShell>
      <div className="w-full min-h-[calc(100vh-4rem)] bg-background/30">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent mb-3">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  System Events
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">Activity Timeline</h1>
                <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-2xl">
                  A comprehensive, auto-generated timeline of all operations and events across the platform.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-16">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center rounded-3xl border border-dashed border-border/60 bg-card/30">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-6 ring-8 ring-background">
                <Activity className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">No activity yet</h3>
              <p className="text-base text-muted-foreground mt-2 max-w-sm">
                Activities from leads, tours, and follow-ups will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {Object.entries(groupedActivities).map(([dateLabel, dayActivities]) => (
                <div key={dateLabel} className="relative">
                  {/* Date Badge */}
                  <div className="sticky top-32 z-20 flex justify-start md:justify-center mb-12 pl-12 md:pl-0">
                    <span className="inline-flex items-center px-5 py-2 rounded-full bg-card border border-border shadow-sm text-xs font-bold tracking-widest text-foreground uppercase ring-4 ring-background">
                      {dateLabel}
                    </span>
                  </div>
                  
                  <div className="relative">
                    {/* Vertical line connecting the dots */}
                    <div className="absolute top-0 bottom-0 left-[28px] md:left-1/2 md:-ml-px w-0.5 bg-gradient-to-b from-transparent via-border to-transparent"></div>
                    
                    <div className="space-y-8">
                      {dayActivities.map((a, index) => {
                        const Icon = ICON[a.kind] ?? Activity;
                        const lead = a.leadId ? leads.find((l) => l.id === a.leadId) : null;
                        const tour = a.tourId ? tours.find(t => t.id === a.tourId) : null;
                        const property = a.propertyId ? properties.find(p => p.id === a.propertyId) : 
                                         tour?.propertyId ? properties.find(p => p.id === tour.propertyId) : null;
                        
                        let actor = "System";
                        if (a.actor !== "system") {
                          const tcm = tcms.find((t) => t.id === a.actor);
                          if (tcm) {
                            actor = tcm.name;
                          } else if (authUser && a.actor === authUser.id) {
                            actor = authUser.fullName || authUser.name || "Me";
                          } else if (a.actor === a.leadId && lead) {
                            actor = lead.name;
                          } else {
                            const pn = personName(a.actor, "");
                            if (pn) {
                              actor = pn;
                            } else {
                              actor = a.actor.length > 20 ? "User" : a.actor;
                            }
                          }
                        }
                        
                        const isAlert = a.kind === "stale_alert" || a.kind === "escalation" || a.kind === "tour_cancelled";
                        const isSuccess = a.kind === "booking_confirmed" || a.kind === "tour_completed" || a.kind === "follow_up_done";
                        
                        // For alternating layout
                        const isLeft = index % 2 === 0;

                        return (
                          <div key={a.id} className={`relative flex items-center justify-start md:justify-center group/card`}>
                            {/* The Dot */}
                            <div className="absolute left-6 md:left-1/2 md:-ml-[18px] w-9 h-9 rounded-full border-[3px] border-background flex items-center justify-center z-10 shadow-sm transition-transform duration-300 group-hover/card:scale-110
                              bg-card
                              text-muted-foreground
                              data-[success=true]:bg-green-500/10 data-[success=true]:text-green-600 data-[success=true]:border-green-100
                              data-[alert=true]:bg-destructive/10 data-[alert=true]:text-destructive data-[alert=true]:border-destructive/20
                            " data-success={isSuccess} data-alert={isAlert}>
                              <Icon className="h-4 w-4" />
                            </div>

                            {/* Card Content - alternating sides on desktop */}
                            <div className={`w-full md:w-1/2 pl-16 md:pl-0 ${isLeft ? 'md:pr-14 md:text-right' : 'md:pl-14 md:ml-auto'}`}>
                              <div className="bg-card border border-border/40 p-4 md:p-5 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-border/80 group-hover/card:-translate-y-0.5">
                                <div className={`flex flex-col ${isLeft ? 'md:items-end' : 'md:items-start'}`}>
                                  <div className="flex items-center justify-between w-full mb-1">
                                    <h4 className="text-[15px] font-semibold text-foreground/90 tracking-tight">{a.text}</h4>
                                    <time className="text-xs font-medium text-muted-foreground/60 whitespace-nowrap bg-muted/40 px-2 py-1 rounded-md border border-border/30 ml-3">
                                      {format(new Date(a.ts), "h:mm a")}
                                    </time>
                                  </div>
                                  
                                  {/* Additional Details row */}
                                  {(property || tour) && (
                                    <div className={`flex flex-wrap gap-2 mt-2 mb-1 w-full ${isLeft ? 'md:justify-end' : 'md:justify-start'}`}>
                                      {property && (
                                        <div className="inline-flex items-center text-[11px] font-medium text-muted-foreground/80 bg-muted/30 px-2 py-1 rounded-md border border-border/40">
                                          <Building2 className="w-3 h-3 mr-1.5" />
                                          {property.name}
                                        </div>
                                      )}
                                      {tour && (
                                        <div className="inline-flex items-center text-[11px] font-medium text-muted-foreground/80 bg-muted/30 px-2 py-1 rounded-md border border-border/40">
                                          <Calendar className="w-3 h-3 mr-1.5" />
                                          {format(new Date(tour.scheduledAt), "MMM d, h:mm a")}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className={`flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/50 w-full ${isLeft ? 'md:flex-row-reverse' : ''}`}>
                                    {lead ? (
                                      <button 
                                        onClick={() => selectLead(lead.id)} 
                                        className={`text-[13px] text-muted-foreground hover:text-accent font-medium transition-colors flex items-center group/lead bg-muted/30 hover:bg-accent/10 px-2.5 py-1.5 rounded-md border border-transparent hover:border-accent/20 ${isLeft ? 'md:ml-0 md:mr-auto' : 'md:mr-auto'}`}
                                      >
                                        <ArrowRightLeft className={`h-3.5 w-3.5 text-muted-foreground/70 group-hover/lead:text-accent transition-colors ${isLeft ? 'ml-2 order-2' : 'mr-2'}`} />
                                        <span>{lead.name}</span>
                                      </button>
                                    ) : <div className="mr-auto"></div>}
                                    
                                    <div className="flex items-center gap-1.5 opacity-90 group-hover/card:opacity-100 transition-opacity">
                                      <span className="inline-flex items-center justify-center h-6 px-3 rounded-full bg-secondary/80 text-secondary-foreground text-[11px] font-medium border border-border/40 shadow-sm">
                                        {actor}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
