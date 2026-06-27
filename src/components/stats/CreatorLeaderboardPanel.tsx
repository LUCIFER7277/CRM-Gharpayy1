import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Sparkles, CalendarDays, CheckCircle2, RefreshCw, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreatorLeaderboard, type CreatorLeaderboardEntry, type LeaderboardPeriod } from "@/hooks/use-stats";
import { useAuthUser } from "@/lib/auth-store";
import { api } from "@/lib/api/client";

const PERIOD_OPTIONS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "today", label: "Today" },
  { key: "all_time", label: "All Time" },
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500 drop-shadow-md" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400 drop-shadow-md" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-500 drop-shadow-md" />;
  return <Trophy className="h-5 w-5 text-slate-300" />;
}

function PodiumCard({ item, index }: { item: CreatorLeaderboardEntry; index: number }) {
  const roleLabel = item.role === "tcm" ? "TCM" : "Member";
  const isFirst = item.rank === 1;
  const isSecond = item.rank === 2;
  const isThird = item.rank === 3;
  
  const rankColor = isFirst ? "text-amber-500" : isSecond ? "text-slate-500" : isThird ? "text-orange-600" : "text-slate-400";
  const badgeColor = isFirst ? "bg-amber-50 text-amber-700 border-amber-200" : 
                     isSecond ? "bg-blue-50 text-blue-700 border-blue-200" : 
                     isThird ? "bg-orange-50 text-orange-700 border-orange-200" : 
                     "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-start gap-4">
          <div className="relative mt-1">
            <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isFirst ? 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300/50 shadow-inner' : isSecond ? 'bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300/50 shadow-inner' : 'bg-gradient-to-br from-orange-100 to-orange-200 border border-orange-300/50 shadow-inner'}`}>
              <span className={`text-2xl font-black ${rankColor} drop-shadow-sm`}>{item.rank}</span>
            </div>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white rounded-full p-0.5 shadow-sm">
               <RankIcon rank={item.rank} />
            </div>
          </div>
          <div>
            <p className={`text-[10px] font-bold tracking-wider uppercase mb-0.5 ${isFirst ? 'text-amber-600' : isSecond ? 'text-blue-600' : 'text-orange-600'}`}>Rank {item.rank}</p>
            <p className="text-xl font-bold text-slate-900 leading-tight">{item.name}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{roleLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-0.5">Total Score</p>
          <p className="text-3xl font-black text-slate-900 leading-none">{item.toursCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="flex items-center gap-3 rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 shadow-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100/50 text-green-600">
             <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Scheduled</p>
            <p className="text-base font-bold text-slate-900 leading-tight">{item.scheduledCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 shadow-sm">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100/50 text-purple-600">
             <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Completed</p>
            <p className="text-base font-bold text-slate-900 leading-tight">{item.completedCount}</p>
          </div>
        </div>
      </div>

      {item.zones.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 justify-center md:justify-start">
          {item.zones.map((z) => (
            <Badge key={`${item.userId}-${z.zone}`} variant="outline" className={`text-[10px] font-semibold border ${badgeColor}`}>
              {z.zone}: {z.count}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function CreatorLeaderboardPanel({ compact = false }: { compact?: boolean }) {
  const authUser = useAuthUser((s) => s.user);
  const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");
  const [selectedZone, setSelectedZone] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: officeZones } = useQuery({
    queryKey: ["office-zones"],
    queryFn: () => api.zones.list(),
    staleTime: 60_000,
  });

  const handlePeriodSelect = (nextPeriod: LeaderboardPeriod) => {
    setFromDate("");
    setToDate("");
    setPeriod(nextPeriod);
  };

  const hasValidCustomRange = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return new Date(fromDate) <= new Date(toDate);
  }, [fromDate, toDate]);

  const customRange = useMemo(
    () => (hasValidCustomRange ? { from: fromDate, to: toDate } : undefined),
    [hasValidCustomRange, fromDate, toDate],
  );

  const effectivePeriod: LeaderboardPeriod | "custom" = hasValidCustomRange ? "custom" : period;
  const { data, isLoading, isError } = useCreatorLeaderboard(effectivePeriod, selectedZone, customRange);

  const zoneNames = useMemo(() => {
    const names = (officeZones ?? []).map((z) => String(z.name || "").trim()).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [officeZones]);

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) return `${fromDate} to ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `To ${toDate}`;
    return "Date Range";
  }, [fromDate, toDate]);

  const rankings = data?.rankings ?? [];
  const topThree = rankings.slice(0, 3);
  const topCount = rankings[0]?.toursCount ?? 0;

  const currentUserEntry = useMemo(
    () => rankings.find((r) => r.userId === authUser?.id) ?? null,
    [rankings, authUser?.id],
  );

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-orange-50 px-3 py-1">
              <Trophy className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-orange-600">Tour Leaders</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Members ranked by tours scheduled + tours completed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="h-7 w-[130px] text-[11px]">
                <SelectValue placeholder="All zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All zones</SelectItem>
                {zoneNames.map((zone) => (
                  <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={period === opt.key ? "default" : "outline"}
                size="sm"
                className="h-7 px-3 text-[11px]"
                onClick={() => handlePeriodSelect(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={hasValidCustomRange ? "default" : "outline"}
                  size="sm"
                  className="h-7 min-w-[175px] justify-start px-2.5 text-[11px] font-normal"
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  <span className="truncate">{dateRangeLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[260px] p-3">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</p>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 text-[11px]" aria-label="From date" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</p>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 text-[11px]" aria-label="To date" />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-destructive">Could not load leaderboard right now.</p>
        </div>
      )}

      {!isLoading && !isError && rankings.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Trophy className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">No tour activity in this period.</p>
          <p className="text-xs text-muted-foreground">Schedule tours to climb the board.</p>
        </div>
      )}

      {!isLoading && !isError && rankings.length > 0 && (
        <>
          {topThree.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {topThree.slice(0, 2).map((entry, idx) => (
                <PodiumCard key={entry.userId} item={entry} index={idx} />
              ))}
            </div>
          )}

          {currentUserEntry && (authUser?.role === "member" || authUser?.role === "tcm") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Your Rank: #{currentUserEntry.rank}</p>
                <Badge variant="secondary" className="text-[10px]">{currentUserEntry.toursCount} tours</Badge>
              </div>
              <div className="mt-3">
                <Progress value={topCount > 0 ? Math.min(100, (currentUserEntry.toursCount / topCount) * 100) : 0} className="h-2" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {topCount > 0
                    ? `${Math.max(0, topCount - currentUserEntry.toursCount)} more to match #1`
                    : "You are setting the pace"}
                </p>
              </div>
            </motion.div>
          )}

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            <header className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Full Ranking</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                <span>Updated {new Date(data?.generatedAt ?? Date.now()).toLocaleString()}</span>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded border-border" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </header>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white">
                  <tr>
                    <th className="px-6 py-4 font-semibold w-16">#</th>
                    <th className="px-6 py-4 font-semibold min-w-[200px]">Member</th>
                    <th className="px-6 py-4 font-semibold text-center">Scheduled</th>
                    <th className="px-6 py-4 font-semibold text-center">Completed</th>
                    <th className="px-6 py-4 font-semibold text-center w-32">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankings.map((entry, idx) => {
                    const isMe = entry.userId === authUser?.id;
                    const isFirst = entry.rank === 1;
                    const isSecond = entry.rank === 2;
                    const isThird = entry.rank === 3;
                    const initials = entry.name.charAt(0).toUpperCase();
                    
                    return (
                      <motion.tr 
                        key={entry.userId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(0.02 * idx, 0.2), duration: 0.2 }}
                        className={`hover:bg-slate-50/80 transition-colors ${isMe ? 'bg-primary/5' : 'bg-white'}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isFirst ? <Crown className="w-6 h-6 text-amber-500 mx-auto drop-shadow-sm" /> :
                           isSecond ? <Medal className="w-5 h-5 text-slate-400 mx-auto drop-shadow-sm" /> :
                           isThird ? <Medal className="w-5 h-5 text-orange-600 mx-auto drop-shadow-sm" /> :
                           <div className="w-6 h-6 mx-auto flex items-center justify-center font-bold text-slate-400 text-sm">
                             {entry.rank}
                           </div>}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isFirst ? 'bg-amber-100 text-amber-700' : isSecond ? 'bg-blue-100 text-blue-700' : isThird ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-[15px]">{entry.name}</span>
                                {isMe && <Badge className="text-[9px] px-1.5 py-0 h-4">You</Badge>}
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600 border-none hover:bg-slate-200">
                                  {entry.role === "tcm" ? "TCM" : "Member"}
                                </Badge>
                              </div>
                              {entry.zones.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {entry.zones.map((z) => (
                                    <Badge key={`${entry.userId}-${z.zone}`} variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border ${isFirst ? 'bg-amber-50 text-amber-700 border-amber-200' : isSecond ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                      {z.zone}: {z.count}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <CalendarDays className="w-4 h-4 text-green-500" />
                            <span className="font-bold text-slate-700 text-[15px]">{entry.scheduledCount}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-purple-500" />
                            <span className="font-bold text-slate-700 text-[15px]">{entry.completedCount}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex items-center justify-center min-w-[3.5rem] px-4 py-1.5 rounded-md font-bold text-[15px] ${isFirst || isSecond ? 'bg-green-50 text-green-700 border border-green-100' : entry.toursCount > 0 ? 'bg-slate-50 text-slate-700 border border-slate-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                            {entry.toursCount}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {rankings.length === 0 && (
               <div className="text-center p-8 text-slate-400 text-sm">No data available</div>
            )}
          </div>
          
          {/* Informational Footer */}
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
            <Info className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <p className="font-semibold text-blue-900">
                Scoring is calculated as: (Scheduled Tours + Completed Tours) / 2
              </p>
              <p className="mt-0.5 text-blue-700/80">
                Both scheduled and completed tours contribute equally to the total score.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
