// Supply Ops dashboard — cross-property roll-up that lives as a sub-tab
// inside Supply Hub. Surfaces work-to-do across the entire portfolio:
//   - Red-flagged properties (manual blocks)
//   - Visits scheduled in the next 7 days
//   - Owner pitch follow-ups due
//   - Properties with low onboarding completion (<60%)
//   - Live inventory counts (most recent edits)
// Every row opens the relevant property in PGDetail.

import { useMemo } from "react";
import type { PG } from "@/property-genius/data/types";
import { PGS } from "@/property-genius/data/pgs";
import {
  AlertOctagon, CalendarClock, IndianRupee, ListChecks, Package, ArrowRight, Activity, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAllSupply, dueVisits, dueOwnerFollowups, readinessGaps,
  effectiveScarcity, checklistCompletion,
} from "@/property-genius/lib/supply";

export function SupplyOps({ onOpen }: { onOpen: (pg: PG) => void }) {
  const store = useAllSupply();
  const byId = useMemo(() => new Map(PGS.map((p) => [p.id, p])), []);

  const flagged = useMemo(() => Object.values(store).filter((r) => r.redFlag).map((r) => byId.get(r.pgId)).filter((p): p is PG => !!p), [store, byId]);
  const visitsToday = useMemo(() => dueVisits("today"), [store]);
  const visitsWeek = useMemo(() => dueVisits("week"), [store]);
  const followups = useMemo(() => dueOwnerFollowups(), [store]);
  const gaps = useMemo(() => readinessGaps(PGS.map((p) => p.id)).slice(0, 8), [store]);
  const liveInventory = useMemo(() =>
    Object.values(store).filter((r) => r.inventory).sort((a, b) => (b.inventory!.updatedAt) - (a.inventory!.updatedAt)).slice(0, 6)
      .map((r) => byId.get(r.pgId)).filter((p): p is PG => !!p), [store, byId]);

  const totalActivity =
    Object.values(store).reduce((a, r) => a + r.visits.length + r.pitches.length + r.notes.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Activity className="h-4 w-4" />
          </span>
          <h2 className="font-display text-2xl font-bold">Supply Ops</h2>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Cross-portfolio control room. Everything that needs a rep&apos;s attention today, in one screen.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat label="Properties" value={String(PGS.length)} accent="info" />
        <Stat label="Red-flagged" value={String(flagged.length)} accent={flagged.length ? "danger" : "muted"} />
        <Stat label="Visits today" value={String(visitsToday.length)} accent={visitsToday.length ? "warning" : "muted"} />
        <Stat label="Pitches to chase" value={String(followups.length)} accent={followups.length ? "warning" : "muted"} />
        <Stat label="Activity logged" value={String(totalActivity)} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Red-flagged properties" icon={AlertOctagon} accent="danger" empty={flagged.length === 0 ? "No properties flagged. Reps can mark a PG red from its Owner panel." : null}>
          {flagged.map((pg) => {
            const rec = store[pg.id];
            return (
              <Row key={pg.id} pg={pg} onOpen={onOpen} right={
                <span className="rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-danger">Blocked</span>
              }>
                <div className="text-xs text-muted-foreground truncate">{rec?.redReason || "No reason recorded"}</div>
              </Row>
            );
          })}
        </Section>

        <Section title="Visits this week" icon={CalendarClock} accent="info" empty={visitsWeek.length === 0 ? "No visits scheduled in the next 7 days." : null}>
          {visitsWeek.slice(0, 8).map((v) => {
            const pg = byId.get(v.pgId)!;
            if (!pg) return null;
            const when = new Date(v.whenISO);
            const isToday = when.toDateString() === new Date().toDateString();
            return (
              <Row key={v.id} pg={pg} onOpen={onOpen} right={
                <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-mono",
                  isToday ? "bg-warning/15 text-[hsl(38_76%_36%)]" : "bg-info/10 text-info")}>
                  {when.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              }>
                <div className="text-xs text-muted-foreground truncate">
                  <b className="text-foreground">{v.leadName}</b>{v.leadPhone && ` · ${v.leadPhone}`}
                </div>
              </Row>
            );
          })}
        </Section>

        <Section title="Owner pitch follow-ups" icon={IndianRupee} accent="warning" empty={followups.length === 0 ? "No owner follow-ups pending. Negotiate something via the Owner Panel." : null}>
          {followups.slice(0, 8).map((p) => {
            const pg = byId.get(p.pgId);
            if (!pg) return null;
            return (
              <Row key={p.id} pg={pg} onOpen={onOpen} right={
                <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-mono text-[hsl(38_76%_36%)]">
                  {p.followUpISO ? new Date(p.followUpISO).toLocaleDateString() : "—"}
                </span>
              }>
                <div className="text-xs text-muted-foreground truncate">
                  ₹{p.proposedRent.toLocaleString("en-IN")} · {p.forSharing} · <i>{p.reaction}</i>
                  {p.nextStep && ` · ${p.nextStep}`}
                </div>
              </Row>
            );
          })}
        </Section>

        <Section title="Onboarding gaps" icon={ListChecks} accent="warning" empty={gaps.length === 0 ? "All properties are 100% complete. 🎉" : null}>
          {gaps.map(({ pgId, pct }) => {
            const pg = byId.get(pgId);
            if (!pg) return null;
            return (
              <Row key={pgId} pg={pg} onOpen={onOpen} right={
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn("h-full", pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-xs tabular-nums w-8 text-right">{pct}%</span>
                </div>
              } />
            );
          })}
        </Section>

        <Section title="Live inventory edits" icon={Package} accent="success" empty={liveInventory.length === 0 ? "No live inventory entered yet. Open any PG → Owner → Inventory." : null}>
          {liveInventory.map((pg) => {
            const eff = effectiveScarcity(pg);
            return (
              <Row key={pg.id} pg={pg} onOpen={onOpen} right={
                <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                  eff.hot ? "border-danger/40 bg-danger/10 text-danger"
                  : eff.level === "FULL" ? "border-border bg-muted text-muted-foreground"
                  : "border-success/40 bg-success/10 text-success")}>
                  {eff.level}
                </span>
              }>
                <div className="font-mono text-xs text-muted-foreground">
                  {eff.perBed.triple !== null && `T:${eff.perBed.triple} `}
                  {eff.perBed.double !== null && `D:${eff.perBed.double} `}
                  {eff.perBed.single !== null && `S:${eff.perBed.single}`}
                </div>
              </Row>
            );
          })}
        </Section>

        <Section title="Top-IQ inventory" icon={TrendingUp} accent="info" empty={null}>
          {[...PGS].sort((a, b) => b.iq - a.iq).slice(0, 6).map((pg) => (
            <Row key={pg.id} pg={pg} onOpen={onOpen} right={
              <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-bold",
                pg.iq >= 75 ? "bg-success/15 text-success"
                : pg.iq >= 60 ? "bg-warning/15 text-[hsl(38_76%_36%)]"
                : "bg-danger/15 text-danger")}>
                IQ {pg.iq}
              </span>
            }>
              <div className="text-xs text-muted-foreground truncate">{pg.area} · {pg.gender} · {pg.tier}</div>
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

/* ---------- atoms ---------- */

function Stat({ label, value, accent }: { label: string; value: string; accent: "success" | "warning" | "info" | "danger" | "muted" }) {
  const map: Record<typeof accent, string> = {
    success: "border-success/40 bg-success/5 text-success",
    warning: "border-warning/40 bg-warning/10 text-[hsl(38_76%_36%)]",
    info:    "border-info/40 bg-info/5 text-info",
    danger:  "border-danger/40 bg-danger/10 text-danger",
    muted:   "border-border bg-card text-muted-foreground",
  };
  return (
    <div className={cn("rounded-lg border p-3 shadow-card", map[accent])}>
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-bold leading-none tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, icon: Icon, accent, children, empty }: { title: string; icon: typeof Package; accent: "success" | "warning" | "info" | "danger"; children?: React.ReactNode; empty: string | null }) {
  const accentMap: Record<typeof accent, string> = {
    success: "text-success",
    warning: "text-[hsl(38_76%_36%)]",
    info:    "text-info",
    danger:  "text-danger",
  };
  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon className={cn("h-4 w-4", accentMap[accent])} /> {title}
        </h3>
      </header>
      <div className="p-2">
        {empty ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{empty}</div>
        ) : (
          <div className="space-y-1">{children}</div>
        )}
      </div>
    </section>
  );
}

function Row({ pg, onOpen, right, children }: { pg: PG; onOpen: (pg: PG) => void; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <button onClick={() => onOpen(pg)}
      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-smooth hover:bg-surface-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold truncate">{pg.name}</span>
          <span className="text-[10px] text-muted-foreground truncate">{pg.area}</span>
        </div>
        {children}
      </div>
      {right && <div className="shrink-0">{right}</div>}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
