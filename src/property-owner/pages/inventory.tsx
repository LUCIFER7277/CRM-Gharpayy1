import {
  Package, Building2, MapPin, Users, CheckCircle2, Lock,
  ChevronRight, TrendingUp, Home, BarChart3,
} from "lucide-react";
import { useGetRealOwnerProperties, useGetOwnerStats } from "@/property-owner/lib/api";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

// ── sub-components ────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: any;
  value: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-0.5 px-4 py-3 rounded-2xl border ${colorClass} min-w-[72px]`}>
      <Icon className="w-4 h-4 mb-0.5 opacity-75" />
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
    </div>
  );
}

function OccupancyBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  const textColor =
    pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-500";
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Occupancy</span>
        <span className={`text-xs font-black ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function SummaryKpiBar({ stats }: { stats: any }) {
  const overall = stats?.overall;
  if (!overall) return null;

  const overallPct = overall.occupancyPct ?? 0;
  const barColor = overallPct >= 80 ? "bg-emerald-500" : overallPct >= 50 ? "bg-amber-400" : "bg-rose-400";
  const iconColor = overallPct >= 80 ? "text-emerald-500" : overallPct >= 50 ? "text-amber-500" : "text-rose-400";

  const kpis = [
    { label: "Properties", value: overall.totalProperties, icon: Home, color: "text-violet-600 bg-violet-50 border-violet-100" },
    { label: "Total Beds", value: overall.totalBeds, icon: BarChart3, color: "text-slate-600 bg-slate-50 border-slate-200" },
    { label: "Occupied", value: overall.occupiedBeds, icon: Users, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
    { label: "Vacant", value: overall.vacantBeds, icon: CheckCircle2, color: "text-blue-700 bg-blue-50 border-blue-100" },
    { label: "Blocked", value: overall.blockedBeds, icon: Lock, color: "text-red-600 bg-red-50 border-red-100" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${k.color}`}>
              <k.icon className="w-4 h-4 opacity-80" />
              <span className="text-xl font-black leading-none">{k.value}</span>
              <span className="text-xs font-semibold opacity-75">{k.label}</span>
            </div>
          ))}
        </div>

        {/* Overall Occupancy — sourced from /api/v1/owner/stats */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100 min-w-[180px]">
          <TrendingUp className={`w-4 h-4 shrink-0 ${iconColor}`} />
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
              <span>Overall Occupancy</span>
              <span className="text-slate-800">{overallPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PropertyCard({
  property,
  statsByPropertyId,
  idx,
}: {
  property: any;
  statsByPropertyId: Map<string, any>;
  idx: number;
}) {
  // Look up the pre-computed per-property stats from the API
  const propIds = [property.id, property._id, property.customId].filter(Boolean).map(String);
  const ps = propIds.reduce<any>((found, id) => found ?? statsByPropertyId.get(id), undefined);

  const occupied = ps?.occupiedBeds ?? 0;
  const vacant = ps?.vacantBeds ?? 0;
  const blocked = ps?.blockedBeds ?? 0;
  const total = ps?.totalBeds ?? 0;
  const pct = ps?.occupancyPct ?? 0;

  return (
    <Link to="/property-owner/properties/$id/rooms" params={{ id: property.id.toString() }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: idx * 0.06 }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="group bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-primary/8 hover:border-primary/25 transition-all cursor-pointer overflow-hidden"
      >
        {/* Top gradient accent on hover */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="p-5 flex flex-col md:flex-row md:items-center gap-5">
          {/* Left: Icon + info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center border border-orange-100/70 group-hover:border-primary/20 group-hover:from-primary/5 group-hover:to-primary/10 transition-all shrink-0">
              <Building2 className="w-7 h-7 text-orange-400 group-hover:text-primary transition-colors" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black text-slate-800 truncate group-hover:text-primary transition-colors duration-200">
                {property.name}
              </h3>
              <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{property.address}</span>
              </div>

              {/* Per-property occupancy bar — from /api/v1/owner/stats */}
              {total > 0 ? (
                <div className="mt-3 max-w-xs">
                  <OccupancyBar pct={pct} />
                </div>
              ) : (
                <span className="mt-2 inline-block text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                  No rooms yet
                </span>
              )}
            </div>
          </div>

          {/* Right: Stats + chevron */}
          <div className="flex items-center gap-3 shrink-0 mt-1 md:mt-0">
            <div className="flex items-center gap-2">
              <StatPill
                icon={Users}
                value={occupied}
                label="Occupied"
                colorClass="bg-emerald-50 border-emerald-100 text-emerald-700"
              />
              <StatPill
                icon={CheckCircle2}
                value={vacant}
                label="Vacant"
                colorClass="bg-blue-50 border-blue-100 text-blue-700"
              />
              <StatPill
                icon={Lock}
                value={blocked}
                label="Blocked"
                colorClass="bg-red-50 border-red-100 text-red-600"
              />
            </div>

            <div className="hidden md:flex w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center text-slate-300 group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all shrink-0 ml-1">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function OwnerInventoryPage() {
  const { data: apiProperties, isLoading: isPropsLoading } = useGetRealOwnerProperties();
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError } = useGetOwnerStats();

  const properties = apiProperties ?? [];

  const isLoading = isPropsLoading || isStatsLoading;

  // Memoize lookup map: propertyId → per-property stats (avoids rebuilding every render)
  const statsByPropertyId = useMemo(
    () => new Map<string, any>((stats?.properties ?? []).map((p: any) => [p.propertyId, p])),
    [stats]
  );

  return (
    <div className="property-owner-page">
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-black text-slate-900">Inventory</h1>
            </div>
            <p className="text-slate-400 text-sm ml-0.5">
              Live overview of room stock across all your properties
            </p>
          </div>
        </motion.div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20 rounded-2xl" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : !properties || properties.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-100 rounded-2xl p-14 text-center"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">No Properties Found</h2>
            <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm leading-relaxed">
              You don't have any properties listed yet. Contact support to onboard your properties.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Subtle warning if stats API failed */}
            {isStatsError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                <span>Occupancy data could not be loaded. Stats may be outdated.</span>
              </div>
            )}

            {/* Overall summary KPI bar with overall occupancy from /api/v1/owner/stats */}
            <SummaryKpiBar stats={stats} />

            {/* Per-property cards with individual occupancy from /api/v1/owner/stats */}
            <div className="flex flex-col gap-3">
              {properties.map((property: any, idx: number) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  statsByPropertyId={statsByPropertyId}
                  idx={idx}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
