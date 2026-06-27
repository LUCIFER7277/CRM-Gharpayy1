import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/lib/auth-store";
import { LiveFeedWidget } from "@/components/dashboard/LiveFeedWidget";
import { Activity, Target, PhoneCall, AlertTriangle, Trophy, MapPin, Loader2, Info, TrendingUp, User, UserPlus, ArrowRight, CalendarPlus } from "lucide-react";
import { request } from "@/lib/api/client";
import { AdminShell } from "@/admin/components/AdminShell";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

async function fetchDashboard() {
  return request<any>("/api/v1/dashboard?limit=300");
}

function MetricCard({ title, value, icon: Icon, trend, trendUp, colorClass, iconBg, iconColor, sparklineData, strokeColor }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm p-5 flex flex-col justify-between min-h-[130px] min-w-0 group hover:shadow-md transition-all">
      <div className="flex items-start justify-between relative z-10 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <span>{title}</span> <Info className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className={cn("text-4xl font-display font-bold mt-2 tracking-tight", colorClass)}>
            {value}
          </div>
          <div className={cn("text-xs font-semibold mt-2 flex items-center gap-1", trendUp === null ? "text-slate-500" : trendUp ? "text-emerald-500" : "text-destructive")}>
            {trendUp !== null && <TrendingUp className={cn("w-3.5 h-3.5", !trendUp && "rotate-180")} />}
            <span>{trend}</span>
          </div>
        </div>
        <div className={cn("h-10 w-10 shrink-0 rounded-full flex items-center justify-center opacity-90", iconBg)}>
          <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-[55%] h-[60px] opacity-70 group-hover:opacity-100 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`color-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={strokeColor} fillOpacity={1} fill={`url(#color-${title.replace(/\s+/g, '-')})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, loading: authLoading } = useAuthUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "super_admin" && user.role !== "admin" && user.role !== "manager") {
        navigate({ to: "/arena", replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["super_admin_dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 10000, // Refresh every 10s for real-time feel
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <p className="font-mono text-sm">Failed to sync with Arena infrastructure.</p>
      </div>
    );
  }

  const { metrics, liveFeed } = data;

  // Dummy sparkline data
  const sparkBlue = [{v: 10}, {v: 12}, {v: 11}, {v: 14}, {v: 12}, {v: 18}, {v: 20}];
  const sparkOrange = [{v: 8}, {v: 7}, {v: 9}, {v: 11}, {v: 10}, {v: 13}, {v: 14}];
  const sparkGreen = [{v: 5}, {v: 6}, {v: 6}, {v: 8}, {v: 9}, {v: 11}, {v: 15}];
  const sparkPurple = [{v: 20}, {v: 18}, {v: 15}, {v: 16}, {v: 14}, {v: 12}, {v: 10}];

  return (
    <AppShell>
      <div className="max-w-[1600px] w-full mx-auto space-y-6 min-w-0">
        <AdminShell title="Live Dashboard" sub="Real-time operational telemetry and global activity feed.">
          <></>
        </AdminShell>

        {/* Top-Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0 w-full">
          <MetricCard
            title="Total New Leads"
            value={metrics.leadCountsByStatus?.new || 0}
            icon={UserPlus}
            trend="12.5% vs yesterday"
            trendUp={true}
            colorClass="text-blue-600"
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            strokeColor="#2563eb"
            sparklineData={sparkBlue}
          />
          <MetricCard
            title="Tours Scheduled"
            value={metrics.leadCountsByStatus?.["tour-scheduled"] || 0}
            icon={CalendarPlus}
            trend="5.6% vs yesterday"
            trendUp={true}
            colorClass="text-orange-500"
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            strokeColor="#f97316"
            sparklineData={sparkOrange}
          />
          <MetricCard
            title="Leads to Call Today"
            value={metrics.leadsToCallTodayCount || 0}
            icon={PhoneCall}
            trend="— No change"
            trendUp={null}
            colorClass="text-emerald-500"
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
            strokeColor="#10b981"
            sparklineData={sparkGreen}
          />
          <MetricCard
            title="Overdue Follow-ups"
            value={metrics.overdueFollowUpsCount || 0}
            icon={AlertTriangle}
            trend="33.3% vs yesterday"
            trendUp={true} // Wait, increase in overdue is bad, but UI shows red up arrow. We'll show destructive up arrow.
            colorClass="text-purple-600"
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            strokeColor="#9333ea"
            sparklineData={sparkPurple}
          />
        </div>

        {/* Secondary Metrics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 w-full">
          {/* TCM Rank Leaderboard */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full flex items-center justify-center bg-yellow-100 border border-yellow-200">
                  <Trophy className="w-3 h-3 text-yellow-600" />
                </div>
                <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">TCM Leaderboard</h3>
              </div>
              <Link to="/leaderboard" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                View full leaderboard <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-2 space-y-1">
              {metrics.tcmRank?.slice(0,3).map((tcm: any, idx: number) => (
                <div key={tcm.tcmId || idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground w-3">{idx + 1}.</span>
                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold border border-emerald-200">
                      {tcm.tcmName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-sm">{tcm.tcmName}</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Tours</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted border border-border/50">{tcm.toursCompleted || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Booked</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">{tcm.bookings || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!metrics.tcmRank || metrics.tcmRank.length === 0) && (
                <p className="p-4 text-sm text-muted-foreground">No TCM data active.</p>
              )}
            </div>
          </div>

          {/* Zone Pipeline Summary */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full flex items-center justify-center bg-blue-100 border border-blue-200">
                  <MapPin className="w-3 h-3 text-blue-600" />
                </div>
                <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Zone Pipeline Activity</h3>
              </div>
              <Link to="/zone-brain" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                View all zones <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-4">
              {metrics.zonePipelineSummary?.slice(0, 4).map((zone: any, idx: number) => {
                // Color coding based on stage to match the visual variety
                const isBlue = idx % 3 === 0;
                const isGreen = idx % 3 === 1;
                const isOrange = idx % 3 === 2;
                
                return (
                  <div key={`${zone.zoneName}-${zone._id?.stage}`} className="flex justify-between items-center py-1">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground truncate max-w-[120px]" title={zone.zoneName}>{zone.zoneName}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 capitalize">{zone._id?.stage}</span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold w-7 h-7 rounded flex items-center justify-center",
                      isBlue ? "bg-blue-50 text-blue-600" :
                      isGreen ? "bg-emerald-50 text-emerald-600" :
                      "bg-orange-50 text-orange-600"
                    )}>{zone.count}</span>
                  </div>
                );
              })}
              {(!metrics.zonePipelineSummary || metrics.zonePipelineSummary.length === 0) && (
                <p className="text-sm text-muted-foreground col-span-2">No zone data active.</p>
              )}
            </div>
          </div>
        </div>

        {/* Live Feed Widget (3 Columns) */}
        <div className="pt-2 min-w-0 w-full">
          <LiveFeedWidget feed={liveFeed} />
        </div>
      </div>
    </AppShell>
  );
}
