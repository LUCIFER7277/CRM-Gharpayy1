import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo, useState, useRef } from "react";
import { useMountedNow } from "@/hooks/use-now";
import {
  useVisitWar,
  STAGE_META,
  probabilityFor,
  fmtElapsed,
  OBJECTION_CATALOG,
  type VisitRecord,
  type VisitStage,
  type Reaction,
  type Decision,
  type ObjectionCategory,
  type FollowUpStage,
  type LostReason,
} from "@/lib/visits/war-store";
import type { Tour, Lead, Property } from "@/lib/types";
import { PGS } from "@/property-genius/data/pgs";
import {
  Radio,
  Activity,
  Flame,
  BarChart3,
  Bell,
  X,
  Phone,
  MessageCircle,
  AlertTriangle,
  Building2,
  Clock,
  TrendingUp,
  CalendarClock,
  Wallet,
  Gauge,
  Siren,
  ChevronRight,
  Plus,
  Users,
  Map as MapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RoleLensSwitcher } from "@/components/visits/RoleLensSwitcher";
import { TeamPulseGrid } from "@/components/visits/TeamPulseGrid";
import { WarMapPanel } from "@/components/visits/WarMapPanel";
import { VisitCopyChips } from "@/components/visits/VisitCopyChips";
import { CoachNoteThread } from "@/components/visits/CoachNoteThread";
import { selectByLens, defaultLensFor, type Lens } from "@/lib/visits/selectors";
import { upsertVisitEvent, archiveVisitEvent } from "@/lib/calendar-store";
import { visitBlock } from "@/lib/impact/copy-formats";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/visit-war")({
  head: () => ({ meta: [{ title: "Visit Command Center · War Room" }] }),
  component: () => (
    <AppShell>
      <VisitWarRoom />
    </AppShell>
  ),
});

function stageTone(stage: VisitStage): { className: string; dot: string } {
  switch (stage) {
    case "scheduled":
      return {
        className: "bg-muted text-muted-foreground border-border",
        dot: "bg-muted-foreground",
      };
    case "started":
      return { className: "bg-info/10 text-info border-info/30", dot: "bg-info" };
    case "at-property":
      return { className: "bg-success/10 text-success border-success/30", dot: "bg-success" };
    case "tour-ongoing":
      return {
        className: "bg-warning/15 text-warning-foreground border-warning/40",
        dot: "bg-warning",
      };
    case "completed":
      return { className: "bg-info/10 text-info border-info/30", dot: "bg-info" };
    case "objection":
      return {
        className: "bg-warning/15 text-warning-foreground border-warning/40",
        dot: "bg-warning",
      };
    case "follow-up":
      return { className: "bg-accent/10 text-accent border-accent/30", dot: "bg-accent" };
    case "booked":
      return { className: "bg-success/15 text-success border-success/40", dot: "bg-success" };
    case "lost":
      return {
        className: "bg-destructive/10 text-destructive border-destructive/30",
        dot: "bg-destructive",
      };
  }
}

function probTone(p: number) {
  if (p >= 75) return "bg-success/15 text-success border-success/30";
  if (p >= 45) return "bg-warning/15 text-warning-foreground border-warning/40";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function timerTone(elapsedSec: number) {
  if (elapsedSec >= 75 * 60) return "text-destructive";
  if (elapsedSec >= 45 * 60) return "text-warning-foreground";
  if (elapsedSec >= 30 * 60) return "text-warning";
  return "text-success";
}

type Tab = "live" | "upcoming" | "hot" | "team" | "map" | "stats" | "alerts";

// ─── helpers that work directly on the real tours array ───────────────────────
function tourScheduledMs(t: import("@/lib/types").Tour): number {
  return +new Date(t.scheduledAt);
}
function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isLiveTour(t: import("@/lib/types").Tour): boolean {
  return t.status !== "cancelled" && tourScheduledMs(t) < Date.now();
}
function isUpcomingTour(t: import("@/lib/types").Tour, now: number): boolean {
  const ms = tourScheduledMs(t);
  return t.status !== "cancelled" && ms >= now && ms < now + 24 * 3600_000;
}
function isTodayTour(t: import("@/lib/types").Tour, now: number): boolean {
  const scheduled = new Date(t.scheduledAt);
  return t.status !== "cancelled" && isSameLocalDay(scheduled, new Date(now));
}
function isHotTour(t: import("@/lib/types").Tour, now: number): boolean {
  return t.status === "completed" && now - tourScheduledMs(t) < 24 * 3600_000;
}

function VisitWarRoom() {
  const { leads, properties, tours, tcms, role, currentTcmId, setProperties } = useApp();
  const { records, alerts, upsert, patch, pushAlert, markAlertsSeen, addObjection, alertsSeenAt } =
    useVisitWar();
  const [now, mounted] = useMountedNow(1000);
  const [lens, setLens] = useState<Lens>(() => defaultLensFor(role));
  const [tab, setTab] = useState<Tab>("live");
  const [focusTour, setFocusTour] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"prob" | "dur" | "obj" | "update">("prob");

  useEffect(() => {
    setLens(defaultLensFor(role));
  }, [role]);

  const seededTours = useRef(new Set<string>());

  // ── Prune stale war-store records (older than 48h) on mount ──────────────────
  useEffect(() => {
    if (!mounted) return;
    const cutoff = Date.now() - 48 * 3600_000;
    const cur = useVisitWar.getState().records;
    const stale = Object.values(cur).filter((v) => v.scheduledAt < cutoff);
    stale.forEach((v) => {
      // Remove by patching stage to lost — keeps the store consistent
      // Actually just delete directly via patch to a sentinel, then filter
    });
    // Direct removal: rebuild records without stale entries
    if (stale.length > 0) {
      const fresh = Object.fromEntries(
        Object.entries(cur).filter(([, v]) => v.scheduledAt >= cutoff),
      );
      useVisitWar.setState({ records: fresh });
      console.debug("[VisitWar] pruned", stale.length, "stale records");
    }
  }, [mounted]);

  // Seed properties from the same static PGS catalog that Property Hub uses.
  // This guarantees the war room always has property data regardless of API state.
  // We also attempt to enrich from the API (MongoDB) and merge — API wins on overlap.
  useEffect(() => {
    if (!mounted) return;

    // Step 1: immediately populate from PGS static catalog (same as Property Hub)
    const fromPgs: import("@/lib/types").Property[] = PGS.map((pg) => ({
      id: pg.id,
      name: pg.name,
      zoneId: pg.area,
      area: pg.area,
      address: pg.locality || pg.area,
      totalBeds: 0,
      vacantBeds: 0,
      daysSinceLastBooking: 0,
      pricePerBed: pg.prices?.triple || pg.prices?.double || pg.prices?.min || 0,
    }));
    setProperties(fromPgs);
    console.debug("[VisitWar] properties seeded from PGS catalog:", fromPgs.length);

    // Step 2: try to enrich from API (MongoDB properties collection)
    api.properties
      .list()
      .then((props) => {
        const raw = props as any;
        if (!raw) return;
        const list: any[] = Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? []);
        if (list.length === 0) {
          console.debug("[VisitWar] API properties empty — using PGS catalog only");
          return;
        }
        // Merge: API records override PGS entries with the same id; keep PGS-only entries
        const apiById = new Map(list.map((p: any) => [p.id || p._id, p]));
        const merged: import("@/lib/types").Property[] = fromPgs.map((p) => {
          const apiProp = apiById.get(p.id);
          if (!apiProp) return p;
          return {
            id: apiProp.id || apiProp._id,
            name: apiProp.name || p.name,
            zoneId: apiProp.zoneId || p.zoneId,
            area: apiProp.area || p.area,
            address: apiProp.address || p.address,
            totalBeds: apiProp.totalBeds ?? p.totalBeds,
            vacantBeds: apiProp.vacantBeds ?? p.vacantBeds,
            daysSinceLastBooking: apiProp.daysSinceLastBooking ?? p.daysSinceLastBooking,
            pricePerBed: apiProp.pricePerBed ?? p.pricePerBed,
          };
        });
        // Also add any API-only properties not in PGS
        list.forEach((p: any) => {
          const id = p.id || p._id;
          if (!fromPgs.some((x) => x.id === id)) {
            merged.push({
              id,
              name: p.name || "",
              zoneId: p.zoneId || "",
              area: p.area || "",
              address: p.address || "",
              totalBeds: p.totalBeds || 0,
              vacantBeds: p.vacantBeds || 0,
              daysSinceLastBooking: p.daysSinceLastBooking || 0,
              pricePerBed: p.pricePerBed || 0,
            });
          }
        });
        console.debug("[VisitWar] properties merged API+PGS:", merged.length);
        setProperties(merged);
      })
      .catch((e) =>
        console.debug(
          "[VisitWar] API properties unavailable, using PGS only:",
          (e as Error)?.message,
        ),
      );
  }, [mounted, setProperties]);

  useEffect(() => {
    if (!mounted) return;
    const toAdd = tours.filter((t) => !seededTours.current.has(t.id));
    if (toAdd.length === 0) return;
    toAdd.forEach((t) => {
      const lead = leads.find((l) => l.id === t.leadId);
      const prop = properties.find((p) => p.id === t.propertyId);
      const tcm = tcms.find((m) => m.id === t.tcmId);
      const sched = +new Date(t.scheduledAt);
      let stage: VisitStage = "scheduled";
      if (t.status === "completed") stage = "completed";
      else if (t.status === "cancelled" || t.status === "no-show") stage = "lost";
      else if (sched < Date.now() - 10 * 60_000) stage = "tour-ongoing";
      upsert({
        tourId: t.id,
        leadId: t.leadId,
        leadName: lead?.name ?? "Lead",
        leadPhone: lead?.phone ?? "—",
        propertyId: t.propertyId ?? "",
        propertyName: prop?.name || t.customPropertyName || "No property",
        propertyArea: prop?.area ?? "—",
        tcmId: t.tcmId,
        tcmName: tcm?.name ?? "Coordinator",
        scheduledAt: sched,
        stage,
        startedAt: stage !== "scheduled" ? sched : undefined,
        completedAt: stage === "completed" ? sched + 35 * 60_000 : undefined,
        objections: [],
        outcome: stage === "completed" ? "thinking" : null,
        lastUpdateAt: Date.now(),
      });
      seededTours.current.add(t.id);
    });
  }, [tours, upsert, mounted, leads, properties, tcms]);

  useEffect(() => {
    if (!mounted) return;
    const cur = useVisitWar.getState().records;
    let changed = false;
    Object.values(cur).forEach((v) => {
      const lead = leads.find((l) => l.id === v.leadId);
      const prop = properties.find((p) => p.id === v.propertyId);
      const tcm = tcms.find((m) => m.id === v.tcmId);
      const name = lead?.name ?? v.leadName;
      const phone = lead?.phone ?? v.leadPhone;
      const pName = prop?.name || v.propertyName || "No property";
      const pArea = prop?.area ?? v.propertyArea;
      const tcmName = tcm?.name ?? v.tcmName;
      const t = tours.find((t) => t.id === v.tourId);
      // Sync stage back from global status
      let nextStage = v.stage;
      if (lead && lead.stage === "booked") nextStage = "booked";
      else if (lead && ["dropped"].includes(lead.stage)) nextStage = "lost";
      else if (t && (t.status === "cancelled" || t.status === "no-show")) nextStage = "lost";

      if (
        name !== v.leadName ||
        phone !== v.leadPhone ||
        pName !== v.propertyName ||
        pArea !== v.propertyArea ||
        tcmName !== v.tcmName ||
        nextStage !== v.stage
      ) {
        changed = true;
        patch(v.tourId, {
          leadName: name,
          leadPhone: phone,
          propertyName: pName,
          propertyArea: pArea,
          tcmName,
          stage: nextStage,
        });
      }
    });
    if (!changed) return;
  }, [leads, properties, tcms, patch, mounted]);

  useEffect(() => {
    if (!mounted) return;
    Object.values(records).forEach((v) => {
      if (v.stage === "scheduled" && now - v.scheduledAt > 15 * 60_000 && !v.warnedDelay) {
        patch(v.tourId, { warnedDelay: true });
        pushAlert({
          tourId: v.tourId,
          leadName: v.leadName,
          severity: "warn",
          kind: "delay",
          message: "Delayed · no start 15m past schedule",
        });
      }
      if (
        (v.stage === "started" || v.stage === "at-property") &&
        v.startedAt &&
        now - v.startedAt > 30 * 60_000 &&
        !v.warnedAtRisk
      ) {
        patch(v.tourId, { warnedAtRisk: true });
        pushAlert({
          tourId: v.tourId,
          leadName: v.leadName,
          severity: "warn",
          kind: "delay",
          message: "At risk · no update 30m after start",
        });
      }
      if (
        (v.stage === "started" || v.stage === "at-property" || v.stage === "tour-ongoing") &&
        v.startedAt &&
        now - v.startedAt > 60 * 60_000 &&
        !v.warnedEscalate
      ) {
        patch(v.tourId, { warnedEscalate: true, escalated: true });
        pushAlert({
          tourId: v.tourId,
          leadName: v.leadName,
          severity: "risk",
          kind: "escalate",
          message: "ESCALATE · 60m no update — manager notified",
        });
      }
      if (
        v.stage === "completed" &&
        v.completedAt &&
        now - v.completedAt > 6 * 3600_000 &&
        (!v.outcome || v.outcome === "thinking") &&
        !v.warnedGhost
      ) {
        patch(v.tourId, { warnedGhost: true });
        pushAlert({
          tourId: v.tourId,
          leadName: v.leadName,
          severity: "risk",
          kind: "ghost",
          message: "Ghost · post-visit silence 6h+",
        });
      }
    });
  }, [now, records, patch, pushAlert, mounted]);

  useEffect(() => {
    if (!mounted) return;
    Object.values(records).forEach((v) => {
      if (v.stage === "lost") {
        archiveVisitEvent(v.tourId);
        return;
      }
      upsertVisitEvent({
        tourId: v.tourId,
        leadId: v.leadId,
        leadName: v.leadName,
        leadPhone: v.leadPhone,
        propertyName: v.propertyName,
        propertyArea: v.propertyArea,
        scheduledAt: v.scheduledAt,
        description: visitBlock({
          leadName: v.leadName,
          leadPhone: v.leadPhone,
          propertyName: v.propertyName,
          propertyArea: v.propertyArea,
          scheduledAt: v.scheduledAt,
        }),
        durationMin: 60,
      });
    });
  }, [records, mounted]);

  // ── Stats computed directly from real tours (ground truth) ──────────────────
  // Use local date comparison to avoid timezone drift for scheduledAt strings.
  const todaysTours = useMemo(() => tours.filter((t) => isTodayTour(t, now)), [tours, now]);
  const upcomingTours = useMemo(() => tours.filter((t) => isUpcomingTour(t, now)), [tours, now]);
  const liveTours = useMemo(() => tours.filter((t) => isLiveTour(t)), [tours]);
  const hotTours = useMemo(() => tours.filter((t) => isHotTour(t, now)), [tours, now]);
  const allToursCount = useMemo(
    () => tours.filter((t) => t.status !== "cancelled").length,
    [tours],
  );

  // Revenue walking: sum over live + hot tours using property price × probability
  const revenueWalking = useMemo(() => {
    const pool = [...liveTours, ...hotTours];
    return pool.reduce((sum, t) => {
      const prop = properties.find((p) => p.id === t.propertyId);
      const price = prop?.pricePerBed ?? 12000;
      // Use war-store record probability if available, else default 50%
      const rec = records[t.id];
      const prob = rec ? probabilityFor(rec.reaction, rec.objections.length, rec.stage) / 100 : 0.5;
      return sum + price * prob;
    }, 0);
  }, [liveTours, hotTours, properties, records]);

  // Expected bookings: completed tours in last 24h, weighted by probability
  const expectedBookings = useMemo(
    () =>
      Math.round(
        hotTours.reduce((s, t) => {
          const rec = records[t.id];
          const prob = rec
            ? probabilityFor(rec.reaction, rec.objections.length, rec.stage) / 100
            : 0.5;
          return s + prob;
        }, 0),
      ),
    [hotTours, records],
  );

  // ── War-store derived lists (for interactive panels) ─────────────────────────
  const lensRecords = useMemo(() => {
    const filtered = selectByLens(records, lens, {
      tcmId: currentTcmId ?? undefined,
      ownerCode: undefined,
    });
    return filtered;
  }, [records, lens, currentTcmId]);

  const list = useMemo(() => lensRecords, [lensRecords]);

  const sorted = useMemo(() => {
    const arr = [...list];
    arr.sort((a, b) => {
      if (sortMode === "prob") {
        return (
          probabilityFor(b.reaction, b.objections.length, b.stage) -
          probabilityFor(a.reaction, a.objections.length, a.stage)
        );
      }
      if (sortMode === "dur") {
        const da = a.startedAt ? now - a.startedAt : 0;
        const db = b.startedAt ? now - b.startedAt : 0;
        return db - da;
      }
      if (sortMode === "obj") return b.objections.length - a.objections.length;
      return b.lastUpdateAt - a.lastUpdateAt;
    });
    return arr;
  }, [list, sortMode, now]);

  // Live/upcoming/hot for the interactive panels — merge war-store stage with real tours
  const liveList = useMemo(() => {
    // Prefer war-store records for stage info; fall back to real tour status
    const warLive = list.filter((v) =>
      ["started", "at-property", "tour-ongoing"].includes(v.stage),
    );
    // Also include tours that are live by time but not yet in war-store
    const warIds = new Set(warLive.map((v) => v.tourId));
    const extraLive = liveTours
      .filter((t) => !warIds.has(t.id))
      .map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const prop = properties.find((p) => p.id === t.propertyId);
        const tcm = tcms.find((m) => m.id === t.tcmId);
        return {
          tourId: t.id,
          leadId: t.leadId,
          leadName: lead?.name ?? "Lead",
          leadPhone: lead?.phone ?? "—",
          propertyId: t.propertyId ?? "",
          propertyName: prop?.name || t.customPropertyName || "No property",
          propertyArea: prop?.area ?? "—",
          tcmId: t.tcmId,
          tcmName: tcm?.name ?? "Coordinator",
          scheduledAt: +new Date(t.scheduledAt),
          stage: "tour-ongoing" as import("@/lib/visits/war-store").VisitStage,
          objections: [],
          outcome: null,
          lastUpdateAt: Date.now(),
        } satisfies import("@/lib/visits/war-store").VisitRecord;
      });
    return [...warLive, ...extraLive];
  }, [list, liveTours, leads, properties, tcms]);

  const upcoming = useMemo(() => {
    // Prefer war-store records; supplement with real upcoming tours not yet seeded
    const warUpcoming = list.filter(
      (v) =>
        v.stage === "scheduled" &&
        v.scheduledAt > now - 5 * 60_000 &&
        v.scheduledAt < now + 24 * 3600_000,
    );
    const warIds = new Set(warUpcoming.map((v) => v.tourId));
    const extraUpcoming = upcomingTours
      .filter((t) => !warIds.has(t.id))
      .map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const prop = properties.find((p) => p.id === t.propertyId);
        const tcm = tcms.find((m) => m.id === t.tcmId);
        return {
          tourId: t.id,
          leadId: t.leadId,
          leadName: lead?.name ?? "Lead",
          leadPhone: lead?.phone ?? "—",
          propertyId: t.propertyId ?? "",
          propertyName: prop?.name || t.customPropertyName || "No property",
          propertyArea: prop?.area ?? "—",
          tcmId: t.tcmId,
          tcmName: tcm?.name ?? "Coordinator",
          scheduledAt: +new Date(t.scheduledAt),
          stage: "scheduled" as import("@/lib/visits/war-store").VisitStage,
          objections: [],
          outcome: null,
          lastUpdateAt: Date.now(),
        } satisfies import("@/lib/visits/war-store").VisitRecord;
      });
    return [...warUpcoming, ...extraUpcoming].sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [list, upcomingTours, leads, properties, tcms, now]);

  const hot = useMemo(() => {
    const warHot = list.filter(
      (v) =>
        v.stage === "completed" &&
        v.completedAt &&
        now - v.completedAt < 24 * 3600_000 &&
        v.outcome !== "booked",
    );
    const warIds = new Set(warHot.map((v) => v.tourId));
    const extraHot = hotTours
      .filter((t) => !warIds.has(t.id))
      .map((t) => {
        const lead = leads.find((l) => l.id === t.leadId);
        const prop = properties.find((p) => p.id === t.propertyId);
        const tcm = tcms.find((m) => m.id === t.tcmId);
        return {
          tourId: t.id,
          leadId: t.leadId,
          leadName: lead?.name ?? "Lead",
          leadPhone: lead?.phone ?? "—",
          propertyId: t.propertyId ?? "",
          propertyName: prop?.name || t.customPropertyName || "No property",
          propertyArea: prop?.area ?? "—",
          tcmId: t.tcmId,
          tcmName: tcm?.name ?? "Coordinator",
          scheduledAt: +new Date(t.scheduledAt),
          stage: "completed" as import("@/lib/visits/war-store").VisitStage,
          completedAt: +new Date(t.scheduledAt) + 45 * 60_000,
          objections: [],
          outcome: null,
          lastUpdateAt: Date.now(),
        } satisfies import("@/lib/visits/war-store").VisitRecord;
      });
    return [...warHot, ...extraHot];
  }, [list, hotTours, leads, properties, tcms, now]);

  const unreadAlerts = alerts.filter((a) => a.ts > alertsSeenAt).length;
  const intervention = list.filter((v) => {
    const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
    const sevObj = v.objections.some((o) => o.resolution === "unresolved");
    return (
      v.escalated ||
      prob >= 80 ||
      (v.startedAt && now - v.startedAt > 30 * 60_000 && !v.completedAt) ||
      sevObj
    );
  });

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <main className="container py-4 sm:py-6 pb-24 space-y-6">
        {/* Cinematic Hero Header */}
        <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 p-6 rounded-3xl overflow-hidden mb-2 bg-card border shadow-sm group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[url('/bg-grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/30 text-destructive shadow-[0_0_15px_rgba(var(--color-destructive),0.2)]">
                <span className="absolute inset-0 rounded-xl bg-destructive/20 animate-ping opacity-75" />
                <Radio className="h-5 w-5 animate-pulse relative z-10" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Visit Command Center
                </h1>
                <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase mt-0.5">
                  Gharpayy <span className="opacity-50 mx-1">•</span> Mission Control
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-4">
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success rounded-full text-[11px] font-mono px-3 py-1 gap-2 shadow-[0_0_10px_rgba(var(--color-success),0.1)] backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                {liveTours.length} LIVE
              </Badge>
              {intervention.length > 0 && (
                <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive rounded-full text-[11px] font-mono px-3 py-1 gap-2 shadow-[0_0_10px_rgba(var(--color-destructive),0.2)] backdrop-blur-md">
                  <Siren className="h-3.5 w-3.5 animate-pulse" /> {intervention.length} INTERVENTION
                </Badge>
              )}
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col items-end gap-3 self-end">
            <RoleLensSwitcher value={lens} onChange={setLens} />
            <div className="flex items-center gap-2 text-sm tabular-nums font-mono text-primary shadow-[0_0_15px_rgba(var(--color-primary),0.15)] bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl backdrop-blur-md">
              <Clock className="h-4 w-4" />
              {mounted ? new Date(now).toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
            </div>
          </div>
        </header>

        {/* Bento Grid: 12 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4">
          
          {/* Bento KPIs - 4 cols */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <Metric icon={Activity} label="Visits today" value={todaysTours.length} />
            <Metric icon={CalendarClock} label="Next 24h" value={upcomingTours.length} />
            <Metric icon={Gauge} label="All visits" value={allToursCount} />
            <Metric icon={Flame} label="Hot (<24h)" value={hotTours.length} />
            <Metric
              icon={Wallet}
              label="Revenue walking"
              value={`₹${(revenueWalking / 1000).toFixed(0)}k`}
            />
            <Metric
              icon={TrendingUp}
              label="Expected bookings"
              value={expectedBookings}
            />
          </div>

          {/* Bento Team Pulse - 5 cols */}
          <div className="lg:col-span-5 rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex flex-col min-h-[180px]">
            <header className="px-5 py-4 border-b border-border/40 bg-muted/10 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-sm font-semibold">Team Pulse Overview</h2>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <TeamPulseGrid now={now} />
            </div>
          </div>

          {/* Bento Alerts - 3 cols */}
          <div className="lg:col-span-3 rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex flex-col min-h-[180px]">
            <header className="px-5 py-4 border-b border-border/40 bg-muted/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-semibold">Live Alerts</h2>
              </div>
              {unreadAlerts > 0 && <Badge variant="destructive" className="h-4 px-1">{unreadAlerts}</Badge>}
            </header>
            <div className="flex-1 overflow-y-auto p-0 max-h-[260px]">
              <AlertFeed />
            </div>
          </div>

        </div>

        <DayPlanner
          visits={Object.values(records)}
          allTours={tours}
          now={now}
          onFocus={setFocusTour}
          focusTourId={focusTour}
        />

        <section className="rounded-2xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
            <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border/40 bg-muted/10">
              <TabsList className="h-11 justify-start self-start bg-muted/40 rounded-xl p-1 shadow-inner gap-1 overflow-x-auto overflow-y-hidden">
                <TabsTrigger value="live" className="text-sm gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative">
                  {tab === "live" && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(var(--color-primary),0.5)]" />}
                  <Activity className={cn("h-4 w-4", tab === "live" && "text-primary")} /> Live ({liveTours.length})
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="text-sm gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative">
                  {tab === "upcoming" && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-info rounded-t-full shadow-[0_-2px_8px_rgba(var(--color-info),0.5)]" />}
                  <CalendarClock className={cn("h-4 w-4", tab === "upcoming" && "text-info")} /> Upcoming ({upcomingTours.length})
                </TabsTrigger>
                <TabsTrigger value="hot" className="text-sm gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative">
                  {tab === "hot" && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-accent rounded-t-full shadow-[0_-2px_8px_rgba(var(--color-accent),0.5)]" />}
                  <Flame className={cn("h-4 w-4", tab === "hot" ? "text-accent animate-pulse" : "text-muted-foreground")} /> Hot ({hotTours.length})
                </TabsTrigger>
                <TabsTrigger value="map" className="text-sm gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative">
                  {tab === "map" && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-foreground rounded-t-full" />}
                  <MapIcon className={cn("h-4 w-4", tab === "map" ? "text-foreground" : "text-muted-foreground")} /> Map
                </TabsTrigger>
                <TabsTrigger value="stats" className="text-sm gap-2 h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative">
                  {tab === "stats" && <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-foreground rounded-t-full" />}
                  <BarChart3 className={cn("h-4 w-4", tab === "stats" ? "text-foreground" : "text-muted-foreground")} /> Stats
                </TabsTrigger>
              </TabsList>

              {tab === "live" && (
                <div className="ml-auto flex items-center gap-1.5 bg-card border rounded-lg p-1 shadow-sm">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase px-2">Sort</span>
                  <div className="h-4 w-px bg-border mx-1" />
                  {(["prob", "dur", "obj", "update"] as const).map((m) => (
                    <Button key={m} size="sm" variant={sortMode === m ? "secondary" : "ghost"} className={cn("h-7 px-2.5 text-[11px] uppercase font-mono rounded-md", sortMode === m && "bg-muted shadow-sm")} onClick={() => setSortMode(m)}>
                      {m === "prob" ? "Prob" : m === "dur" ? "Dur" : m === "obj" ? "Obj" : "Upd"}
                    </Button>
                  ))}
                </div>
              )}
            </header>

            <div className="p-4 relative min-h-[500px]">
              <TabsContent value="live" className="m-0"><LiveBoard list={sorted.filter((v) => !["booked", "lost"].includes(v.stage))} now={now} mounted={mounted} onFocus={setFocusTour} focus={focusTour} /></TabsContent>
              <TabsContent value="upcoming" className="m-0"><UpcomingPanel list={upcoming} now={now} mounted={mounted} onFocus={setFocusTour} /></TabsContent>
              <TabsContent value="hot" className="m-0"><HotRoom list={hot} now={now} mounted={mounted} onFocus={setFocusTour} /></TabsContent>
              <TabsContent value="map" className="m-0"><WarMapPanel now={now} /></TabsContent>
              <TabsContent value="stats" className="m-0"><WarRoomStats list={list} tours={tours} leads={leads} properties={properties} records={records} /></TabsContent>

              {/* Conditional Overlay Slide-out for Visit Details */}
              {focusTour && records[focusTour] && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 bg-background/40 z-40 backdrop-blur-sm transition-opacity" 
                    onClick={() => setFocusTour(null)} 
                  />
                  {/* Slide-out Drawer */}
                  <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-card border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="flex-1 overflow-y-auto">
                      <VisitDetailPanel
                        key={focusTour}
                        v={records[focusTour]}
                        now={now}
                        onClose={() => setFocusTour(null)}
                        onPatch={(p) => patch(focusTour, p)}
                        onAddObjection={(o) => addObjection(focusTour, o)}
                        onAlert={(severity, kind, message) => pushAlert({ tourId: focusTour, leadName: records[focusTour].leadName, severity, kind, message })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

const STAGE_BG: Record<VisitStage, string> = {
  scheduled: "bg-muted/80 text-muted-foreground",
  started: "bg-success/20 text-success border border-success/60",
  "at-property": "bg-amber-500/80 text-white",
  "tour-ongoing": "bg-orange-500/20 text-orange-700 border border-orange-500/60",
  completed: "bg-info/60 text-white",
  objection: "bg-warning/70 text-warning-foreground",
  "follow-up": "bg-accent/70 text-white",
  booked: "bg-success text-white",
  lost: "bg-destructive/70 text-white",
};

function DayPlanner({
  visits,
  allTours,
  now,
  onFocus,
  focusTourId,
}: {
  visits: VisitRecord[];
  allTours: import("@/lib/types").Tour[];
  now: number;
  onFocus: (tourId: string) => void;
  focusTourId?: string | null;
}) {
  const storeLeads = useApp((s) => s.leads);
  const storeProperties = useApp((s) => s.properties);
  const storeTcms = useApp((s) => s.tcms);
  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return +d;
  })();
  const dayEnd = today + 24 * 3600_000;

  // Build a unified list: real tours for today, enriched with war-store stage if available
  const warById = useMemo(() => {
    const m = new Map<string, VisitRecord>();
    visits.forEach((v) => m.set(v.tourId, v));
    return m;
  }, [visits]);

  const todayRealTours = allTours.filter((t) => {
    const ms = +new Date(t.scheduledAt);
    return ms >= today && ms < dayEnd && t.status !== "cancelled";
  });

  // Merge: for each real tour, use war-store stage if available
  const todayVisits: VisitRecord[] = todayRealTours.map((t) => {
    const war = warById.get(t.id);
    if (war) return war;
    const lead = storeLeads.find((l) => l.id === t.leadId);
    const prop = storeProperties.find((p) => p.id === t.propertyId);
    const tcm = storeTcms.find((m) => m.id === t.tcmId);
    let stage: VisitStage = "scheduled";
    if (t.status === "completed") stage = "completed";
    else if (t.status === "no-show" || t.status === "cancelled") stage = "lost";
    else if (+new Date(t.scheduledAt) < now - 10 * 60_000) stage = "tour-ongoing";
    return {
      tourId: t.id,
      leadId: t.leadId,
      leadName: lead?.name ?? "Lead",
      leadPhone: lead?.phone ?? "—",
      propertyId: t.propertyId ?? "",
      propertyName: prop?.name || t.customPropertyName || "No property",
      propertyArea: prop?.area ?? "—",
      tcmId: t.tcmId,
      tcmName: tcm?.name ?? "Coordinator",
      scheduledAt: +new Date(t.scheduledAt),
      stage,
      objections: [],
      outcome: null,
      lastUpdateAt: Date.now(),
    };
  });

  if (todayVisits.length === 0) {
    // Show next upcoming tours
    const nextUp = allTours
      .filter((t) => +new Date(t.scheduledAt) >= dayEnd && t.status === "scheduled")
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
      .slice(0, 3);
    return (
      <Card className="px-3 py-2.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">No visits scheduled today.</span>
          {nextUp.length > 0 && (
            <span className="text-accent font-semibold">
              Next:{" "}
              {nextUp
                .map((t) => {
                  const l = storeLeads.find((x) => x.id === t.leadId);
                  return `${l?.name || "Lead"} (${new Date(t.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})`;
                })
                .join(", ")}
            </span>
          )}
        </div>
      </Card>
    );
  }

  const startHour = 10;
  const endHour = 20;
  const span = endHour - startHour;
  const laneMap: Record<string, { tcmName: string; visits: VisitRecord[] }> = {};
  todayVisits.forEach((v) => {
    if (!laneMap[v.tcmId]) laneMap[v.tcmId] = { tcmName: v.tcmName, visits: [] };
    laneMap[v.tcmId].visits.push(v);
  });
  const lanes = Object.entries(laneMap);
  const nowFrac = Math.max(0, Math.min(1, ((now - today) / 3600_000 - startHour) / span));

  const propName = (v: VisitRecord) => {
    const p = storeProperties.find((x) => x.id === v.propertyId);
    return (p?.name || v.propertyName || "No property").split(" ")[0];
  };

  return (
    <div className="rounded-3xl bg-card border shadow-sm p-6 overflow-hidden relative">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-grid opacity-[0.03] pointer-events-none" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center border border-info/20 shadow-[0_0_10px_rgba(var(--color-info),0.1)]">
            <CalendarClock className="h-4 w-4 text-info" />
          </div>
          <h2 className="font-display text-lg font-bold">Day Planner</h2>
          <Badge variant="secondary" className="font-mono text-[11px] ml-1 bg-muted/50 backdrop-blur-sm border-border/50">
            {new Date(today).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground font-mono bg-muted/40 backdrop-blur-sm border border-border/50 px-3 py-1.5 rounded-lg shadow-inner">
          10:00 - 20:00 <span className="opacity-50 mx-1.5">•</span> <span className="font-semibold text-foreground">{todayVisits.length}</span> visits
        </div>
      </div>

      <div className="relative h-4 mb-1 border-b border-border/60">
        {Array.from({ length: span + 1 }).map((_, i) => {
          const left = (i / span) * 100;
          return (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 text-[9px] text-muted-foreground font-mono"
              style={{ left: `${left}%` }}
            >
              {String(startHour + i).padStart(2, "0")}
            </div>
          );
        })}
      </div>

      <div className="relative">
        {nowFrac > 0 && nowFrac < 1 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-destructive z-10 pointer-events-none"
            style={{ left: `${nowFrac * 100}%` }}
          >
            <div className="absolute -top-1 -left-[3px] h-1.5 w-1.5 rounded-full bg-destructive" />
          </div>
        )}

        <div className="space-y-1.5">
          {lanes.map(([tcmId, lane]) => (
            <div key={tcmId} className="relative h-10 rounded-xl bg-muted/20 border border-border/30 backdrop-blur-sm hover:bg-muted/40 transition-colors group">
              <div className="absolute inset-y-0 left-2 flex items-center z-[5] pointer-events-none">
                <div className="h-6 min-w-6 px-1.5 rounded bg-card border shadow-sm flex items-center justify-center text-[10px] font-bold text-foreground font-display tracking-tight group-hover:scale-110 transition-transform">
                  {lane.tcmName.split(" ")[0].slice(0, 2).toUpperCase()}
                </div>
              </div>
              {lane.visits.map((v) => {
                const startH = (v.scheduledAt - today) / 3600_000;
                const left = ((startH - startHour) / span) * 100;
                const width = Math.max(2, (1 / span) * 100);
                const focused = focusTourId === v.tourId;
                
                // Get gradient class based on stage
                let gradCls = "";
                if (v.stage === "started") gradCls = "bg-gradient-to-r from-success/80 to-success hover:from-success hover:to-success/90 text-white shadow-[0_0_10px_rgba(var(--color-success),0.3)]";
                else if (v.stage === "at-property") gradCls = "bg-gradient-to-r from-amber-500/80 to-amber-500 hover:from-amber-500 hover:to-amber-500/90 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]";
                else if (v.stage === "tour-ongoing") gradCls = "bg-gradient-to-r from-orange-500/80 to-orange-500 hover:from-orange-500 hover:to-orange-500/90 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]";
                else if (v.stage === "completed") gradCls = "bg-gradient-to-r from-info/80 to-info hover:from-info hover:to-info/90 text-white shadow-[0_0_10px_rgba(var(--color-info),0.3)]";
                else if (v.stage === "booked") gradCls = "bg-gradient-to-r from-success/90 to-emerald-500 hover:from-success hover:to-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-1 ring-emerald-300/50";
                else if (v.stage === "lost") gradCls = "bg-gradient-to-r from-destructive/80 to-destructive hover:from-destructive hover:to-destructive/90 text-white shadow-[0_0_10px_rgba(var(--color-destructive),0.3)]";
                else gradCls = "bg-card border border-border text-foreground hover:bg-muted shadow-sm";

                return (
                  <button
                    key={v.tourId}
                    onClick={() => onFocus(v.tourId)}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md text-[10px] font-semibold px-1.5 truncate transition-all duration-200 transform",
                      gradCls,
                      focused && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.02] z-10",
                      v.escalated && "ring-2 ring-destructive animate-pulse ring-offset-1 ring-offset-background z-10",
                    )}
                    style={{ left: `${Math.max(0, left)}%`, width: `${width}%` }}
                    title={`${v.leadName} · ${propName(v)} · ${new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                  >
                    {propName(v)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-[9px] text-muted-foreground">
        <Badge
          variant="outline"
          className="bg-success/10 text-success border-success/40 text-[9px]"
        >
          Started
        </Badge>
        <Badge
          variant="outline"
          className="bg-amber-500/20 text-amber-600 border-amber-500/40 text-[9px]"
        >
          At property
        </Badge>
        <Badge
          variant="outline"
          className="bg-orange-500/10 text-orange-600 border-orange-500/40 text-[9px]"
        >
          Tour ongoing
        </Badge>
        <Badge variant="outline" className="bg-muted text-muted-foreground text-[9px]">
          Scheduled
        </Badge>
        <span className="ml-auto">Red line = now</span>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  tone?: "info" | "warning" | "success" | "accent";
}) {
  const toneCls =
    tone === "info"
      ? "text-info bg-info/10"
      : tone === "warning"
        ? "text-warning-foreground bg-warning/15"
        : tone === "success"
          ? "text-success bg-success/10"
          : tone === "accent"
            ? "text-accent bg-accent/10"
            : "text-foreground bg-muted";
  const toneBorder =
    tone === "info"
      ? "border-l-info shadow-[0_4px_24px_rgba(var(--color-info),0.1)]"
      : tone === "warning"
        ? "border-l-warning shadow-[0_4px_24px_rgba(var(--color-warning),0.1)]"
        : tone === "success"
          ? "border-l-success shadow-[0_4px_24px_rgba(var(--color-success),0.1)]"
          : tone === "accent"
            ? "border-l-accent shadow-[0_4px_24px_rgba(var(--color-accent),0.1)]"
            : "border-l-border shadow-sm";
            
  return (
    <div className={cn("bg-card border border-border/50 border-l-4 p-5 rounded-2xl flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md group relative overflow-hidden", toneBorder)}>
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity",
        tone === "info" ? "bg-info" : tone === "warning" ? "bg-warning" : tone === "success" ? "bg-success" : tone === "accent" ? "bg-accent" : "bg-primary"
      )} />
      
      <div className="flex items-center gap-3 relative z-10">
        <div className={cn("h-8 w-8 flex items-center justify-center rounded-xl", toneCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs text-muted-foreground font-semibold tracking-wide uppercase">{label}</div>
      </div>
      <div className="mt-4 text-3xl font-bold tabular-nums font-mono relative z-10 tracking-tight">{value}</div>
    </div>
  );
}

function StagePill({ stage }: { stage: VisitStage }) {
  const m = STAGE_META[stage];
  const tone = stageTone(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
        tone.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {m.label}
    </span>
  );
}

function LiveTimer({
  since,
  kind = "visit",
}: {
  since: number;
  kind?: "visit" | "post" | "journey";
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const elapsed = Date.now() - since;
  const sec = Math.floor(elapsed / 1000);
  const tone =
    kind === "post"
      ? elapsed < 4 * 3600_000
        ? "text-success"
        : elapsed < 12 * 3600_000
          ? "text-warning-foreground"
          : "text-destructive"
      : timerTone(sec);
  return (
    <span className={cn("font-mono text-xs tabular-nums font-semibold", tone)}>
      {fmtElapsed(elapsed)}
    </span>
  );
}

function Countdown({ to }: { to: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const ms = to - Date.now();
  if (ms <= 0) return <span className="font-mono text-xs text-destructive font-semibold">NOW</span>;
  const tone =
    ms < 15 * 60_000
      ? "text-destructive"
      : ms < 60 * 60_000
        ? "text-warning-foreground"
        : "text-info";
  return (
    <span className={cn("font-mono text-xs tabular-nums font-semibold", tone)}>
      in {fmtElapsed(ms)}
    </span>
  );
}

function UpcomingPanel({
  list,
  mounted,
  onFocus,
}: {
  list: VisitRecord[];
  now: number;
  mounted: boolean;
  onFocus: (id: string) => void;
}) {
  const storeLeads = useApp((s) => s.leads);
  const storeProperties = useApp((s) => s.properties);
  if (list.length === 0) {
    return (
      <div className="text-sm py-16 text-center text-muted-foreground">
        No visits scheduled in the next 24 hours.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((v) => {
        const lead = storeLeads.find((l) => l.id === v.leadId);
        const prop = storeProperties.find((p) => p.id === v.propertyId);
        const ms = v.scheduledAt - Date.now();
        const risk = ms < 30 * 60_000 ? "high" : ms < 2 * 3600_000 ? "med" : "low";
        const riskCls =
          risk === "high"
            ? "border-l-destructive"
            : risk === "med"
              ? "border-l-warning"
              : "border-l-info";
        return (
          <div
            key={v.tourId}
            onClick={() => onFocus(v.tourId)}
            className={cn(
              "p-5 rounded-2xl bg-card border border-border/50 border-l-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group relative overflow-hidden",
              riskCls,
            )}
          >
            {/* Hover subtle glow */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity",
              risk === "high" ? "bg-destructive" : risk === "med" ? "bg-warning" : "bg-info"
            )} />
            
            <div className="flex items-center gap-4 flex-wrap relative z-10">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate text-foreground group-hover:text-primary transition-colors">{v.leadName}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {prop?.name || v.propertyName || "No property"} <span className="opacity-50 mx-1">•</span>{" "}
                  {prop?.area || v.propertyArea || "—"} <span className="opacity-50 mx-1">•</span> <span className="font-medium text-foreground/80">{v.tcmName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono tabular-nums text-foreground/90 font-medium">
                  {mounted
                    ? new Date(v.scheduledAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </div>
                <Countdown to={v.scheduledAt} />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "uppercase backdrop-blur-sm",
                  risk === "high"
                    ? "border-destructive/40 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(var(--color-destructive),0.2)]"
                    : risk === "med"
                      ? "border-warning/40 bg-warning/15 text-warning-foreground shadow-[0_0_10px_rgba(var(--color-warning),0.1)]"
                      : "border-info/40 bg-info/10 text-info"
                )}
              >
                {risk === "high" ? "Imminent" : risk === "med" ? "Soon" : "Scheduled"}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors group-hover:translate-x-0.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveBoard({
  list,
  now,
  mounted,
  onFocus,
  focus,
}: {
  list: VisitRecord[];
  now: number;
  mounted: boolean;
  onFocus: (id: string) => void;
  focus: string | null;
}) {
  const patch = useVisitWar((s) => s.patch);
  const pushAlert = useVisitWar((s) => s.pushAlert);
  const storeLeads = useApp((s) => s.leads);
  const storeProperties = useApp((s) => s.properties);
  if (list.length === 0) {
    return (
      <div className="text-sm py-16 text-center text-muted-foreground">
        No active visits. Schedule one from the Impact Queue to begin.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((v) => {
        const lead = storeLeads.find((l) => l.id === v.leadId);
        const prop = storeProperties.find((p) => p.id === v.propertyId);
        const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
        const latestObj = v.objections[0];
        const isFocus = focus === v.tourId;
        const leftTint = v.escalated
          ? "border-l-destructive"
          : v.warnedAtRisk
            ? "border-l-warning"
            : v.stage === "tour-ongoing"
              ? "border-l-warning"
              : v.stage === "at-property"
                ? "border-l-success"
                : v.stage === "started"
                  ? "border-l-info"
                  : "border-l-muted";
        const sec = v.startedAt ? Math.floor((now - v.startedAt) / 1000) : 0;
        const postSec = v.completedAt ? Math.floor((now - v.completedAt) / 1000) : 0;
        const outcomeLabel =
          v.outcome === "booked"
            ? "Booked"
            : v.outcome === "lost"
              ? "Lost"
              : v.outcome === "thinking"
                ? "Thinking"
                : v.outcome === "follow-up"
                  ? "Follow-up"
                  : null;
        return (
          <div
            key={v.tourId}
            onClick={() => onFocus(v.tourId)}
            className={cn(
              "p-5 rounded-2xl bg-card border border-border/50 border-l-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group relative overflow-hidden",
              leftTint,
              isFocus && "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5",
            )}
          >
            {/* Subtle stage-based hover background */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none",
              v.escalated ? "bg-destructive" : "bg-foreground"
            )} />
            
            <div className="flex flex-col md:flex-row md:items-center gap-4 relative z-10">
              <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:flex-wrap gap-4 md:gap-5">
                <div className="md:w-[240px] shrink-0">
                  <div className="font-semibold truncate flex items-center gap-2 group-hover:text-primary transition-colors">
                    <div className="h-6 min-w-6 px-1.5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border">
                      {v.leadName.slice(0, 2).toUpperCase()}
                    </div>
                    {v.leadName}
                    {lead?.intent && (
                      <span
                        className={cn(
                          "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm ml-auto backdrop-blur-sm",
                          lead.intent === "hot"
                            ? "bg-success/20 text-success shadow-[0_0_8px_rgba(var(--color-success),0.2)]"
                            : lead.intent === "cold"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-warning/15 text-warning-foreground",
                        )}
                      >
                        {lead.intent}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-1.5 flex items-center gap-2">
                    {v.leadPhone} <span className="h-1 w-1 rounded-full bg-border" /> {v.tcmName}
                  </div>
                  {(lead?.source || lead?.budget) && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {lead?.source && <span className="bg-muted px-1.5 rounded">{lead.source}</span>}
                      {lead?.budget ? <span className="ml-1.5">₹{(lead.budget / 1000).toFixed(0)}k</span> : null}
                      {lead?.preferredArea ? <span className="ml-1.5">in {lead.preferredArea}</span> : null}
                    </div>
                  )}
                </div>
                
                <div className="md:w-[180px] shrink-0 min-w-0 border-l border-border/50 pl-4">
                  <div className="text-xs truncate font-medium text-foreground/90">
                    {prop?.name || v.propertyName || "No property"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {prop?.area || v.propertyArea || "—"}
                  </div>
                  {prop && (
                    <div className="text-[10px] text-muted-foreground truncate mt-1">
                      ₹{(prop.pricePerBed / 1000).toFixed(0)}k/bed <span className="opacity-50 mx-1">•</span> <span className={cn("font-medium", prop.vacantBeds < 5 ? "text-warning-foreground" : "")}>{prop.vacantBeds}/{prop.totalBeds} beds</span>
                    </div>
                  )}
                </div>
                
                <div className="md:w-[80px] shrink-0 text-center">
                  <div className="text-xs font-mono font-medium text-foreground/90 tabular-nums">
                    {mounted
                      ? new Date(v.scheduledAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "--:--"}
                  </div>
                  <div className="flex justify-center mt-1.5">
                    <StagePill stage={v.stage} />
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-end gap-3 shrink-0">
                  {outcomeLabel && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2",
                        v.outcome === "booked"
                          ? "border-success/40 bg-success/10 text-success shadow-[0_0_10px_rgba(var(--color-success),0.2)]"
                          : v.outcome === "lost"
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-warning/40 bg-warning/15 text-warning-foreground",
                      )}
                    >
                      {outcomeLabel}
                    </Badge>
                  )}
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {v.startedAt && !v.completedAt && (
                        <span className={cn("font-mono text-xs tabular-nums font-bold", timerTone(sec))}>
                          {fmtElapsed(now - v.startedAt)}
                        </span>
                      )}
                      {v.completedAt && (
                        <span className={cn("font-mono text-xs tabular-nums font-bold", postSec < 4 * 3600 ? "text-success" : postSec < 12 * 3600 ? "text-warning-foreground" : "text-destructive")}>
                          {fmtElapsed(now - v.completedAt)}
                        </span>
                      )}
                      <span className={cn("font-mono font-bold tabular-nums text-xs", probTone(prob).replace("bg-", "text-").split(" ")[1] || "text-foreground")}>
                        {prob}%
                      </span>
                    </div>
                    {/* Visual Probability Bar */}
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", prob >= 75 ? "bg-success shadow-[0_0_8px_rgba(var(--color-success),0.5)]" : prob >= 45 ? "bg-warning" : "bg-destructive")} style={{ width: `${prob}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="shrink-0 self-end md:self-center ml-2 border-l pl-4 border-border/50">
                <NextActionButton
                  v={v}
                  onPatch={(p) => patch(v.tourId, p)}
                  onAlert={(severity, kind, message) =>
                    pushAlert({
                      tourId: v.tourId,
                      leadName: v.leadName,
                      severity,
                      kind: kind as "started" | "completed",
                      message,
                    })
                  }
                  onFocus={() => onFocus(v.tourId)}
                />
              </div>
            </div>
            
            {v.escalated && (
              <div className="mt-4 pt-3 border-t border-border/40 relative">
                <div className="absolute inset-0 bg-destructive/5 rounded-b-xl pointer-events-none" />
                <Badge variant="destructive" className="text-[10px] h-5 px-2 animate-pulse relative z-10 shadow-[0_0_10px_rgba(var(--color-destructive),0.4)]">
                  <Siren className="h-3 w-3 mr-1" /> ESCALATED
                </Badge>
              </div>
            )}
            
            {latestObj && (
              <div className="mt-4 pt-3 border-t border-border/40 flex items-start gap-2 text-[11px] bg-warning/5 -mx-5 px-5 pb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-warning-foreground font-bold uppercase tracking-wide">
                    {latestObj.category} <span className="opacity-50 mx-1">•</span> {latestObj.subType}
                  </span>
                  {latestObj.customerSaid && (
                    <span className="text-foreground/80 italic line-clamp-1 mt-0.5">
                      "{latestObj.customerSaid}"
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div
              className={cn("mt-3 pt-3 border-t border-border/40", latestObj && "border-t-0 mt-1 pt-1")}
              onClick={(e) => e.stopPropagation()}
            >
              <VisitCopyChips v={v} layout="inline" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextActionButton({
  v,
  onPatch,
  onAlert,
  onFocus,
}: {
  v: VisitRecord;
  onPatch: (p: Partial<VisitRecord>) => void;
  onAlert: (
    severity: "info" | "warn" | "risk" | "win",
    kind: import("@/lib/visits/war-store").VisitAlert["kind"],
    message: string,
  ) => void;
  onFocus: () => void;
}) {
  if (v.stage === "scheduled") {
    return (
      <Button
        size="sm"
        className="h-7 text-[11px] gap-1 whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation();
          onPatch({ stage: "started", startedAt: Date.now() });
          onAlert("info", "started", "Visit started");
        }}
      >
        Mark Started <ChevronRight className="h-3 w-3" />
      </Button>
    );
  }
  if (v.stage === "tour-ongoing") {
    return (
      <Button
        size="sm"
        className="h-7 text-[11px] gap-1 whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation();
          onPatch({ stage: "completed", completedAt: Date.now(), outcome: "thinking" });
          onAlert("info", "completed", "Visit completed");
        }}
      >
        Complete <ChevronRight className="h-3 w-3" />
      </Button>
    );
  }
  if (v.stage === "started" || v.stage === "at-property") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1 whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
        }}
      >
        Capture <ChevronRight className="h-3 w-3" />
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-[11px] gap-1 whitespace-nowrap"
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
      }}
    >
      Open <ChevronRight className="h-3 w-3" />
    </Button>
  );
}

function HotRoom({
  list,
  now,
  onFocus,
}: {
  list: VisitRecord[];
  now: number;
  mounted: boolean;
  onFocus: (id: string) => void;
}) {
  const storeLeads = useApp((s) => s.leads);
  const storeProperties = useApp((s) => s.properties);
  if (list.length === 0) {
    return (
      <div className="text-sm py-16 text-center text-muted-foreground">
        No hot leads in the 24-hour window.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list
        .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
        .map((v) => {
          const lead = storeLeads.find((l) => l.id === v.leadId);
          const prop = storeProperties.find((p) => p.id === v.propertyId);
          const remaining = 24 * 3600_000 - (now - (v.completedAt ?? now));
          const hrsLeft = Math.max(0, Math.floor(remaining / 3600_000));
          const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
          return (
            <div
              key={v.tourId}
              onClick={() => onFocus(v.tourId)}
              className="p-5 rounded-2xl bg-card border border-border/50 border-l-4 border-l-accent cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md group relative overflow-hidden"
            >
              {/* Flame background glow */}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-accent/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              
              <div className="flex items-center gap-4 flex-wrap relative z-10">
                <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(var(--color-accent),0.2)]">
                  <Flame className="h-5 w-5 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-foreground group-hover:text-accent transition-colors">{v.leadName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {prop?.name || v.propertyName || "No property"} <span className="opacity-50 mx-1">•</span>{" "}
                    {prop?.area || v.propertyArea || "—"}
                  </div>
                  {v.objections[0] && (
                    <div className="text-[11px] mt-1 text-warning-foreground font-medium flex items-center gap-1.5 bg-warning/10 px-2 py-0.5 rounded-sm w-fit">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{v.objections[0].subType}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase text-muted-foreground tracking-wider font-semibold">
                    Window
                  </div>
                  <div
                    className={cn(
                      "font-mono text-sm font-bold",
                      hrsLeft < 6 ? "text-destructive drop-shadow-[0_0_5px_rgba(var(--color-destructive),0.5)]" : "text-warning-foreground"
                    )}
                  >
                    {hrsLeft}h left
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5 ml-2 border-l border-border/50 pl-4">
                  <Badge variant="outline" className={cn("font-mono font-bold backdrop-blur-sm border-transparent shadow-sm", probTone(prob).replace("text-", "bg-").replace("-foreground", "") + "/10", probTone(prob))}>
                    {prob}%
                  </Badge>
                  <div className="flex gap-1.5">
                    <Button
                      asChild
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-md hover:bg-foreground hover:text-background"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a href={`tel:${v.leadPhone}`}>
                        <Phone className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 rounded-md border-success/40 text-success hover:bg-success hover:text-success-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={`https://wa.me/${v.leadPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function WarRoomStats({
  list,
  ..._rest
}: {
  list: VisitRecord[];
  tours?: Tour[];
  leads?: Lead[];
  properties?: Property[];
  records?: Record<string, VisitRecord>;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = +today;
  const todays = list.filter((v) => v.scheduledAt >= todayMs);
  const scheduled = todays.length;
  const started = todays.filter((v) => v.startedAt).length;
  const completed = todays.filter((v) => v.completedAt).length;
  const booked = todays.filter((v) => v.outcome === "booked").length;
  const lost = todays.filter((v) => v.outcome === "lost").length;
  const conv = completed > 0 ? Math.round((booked / completed) * 100) : 0;

  const durations = todays
    .filter((v) => v.startedAt && v.completedAt)
    .map((v) => (v.completedAt! - v.startedAt!) / 60_000);
  const avgDur = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const objCount: Record<string, number> = {};
  list.forEach((v) =>
    v.objections.forEach((o) => {
      objCount[o.subType] = (objCount[o.subType] ?? 0) + 1;
    }),
  );
  const topObj = Object.entries(objCount).sort((a, b) => b[1] - a[1])[0];

  const propCount: Record<string, number> = {};
  todays.forEach((v) => {
    propCount[v.propertyName] = (propCount[v.propertyName] ?? 0) + 1;
  });
  const topProp = Object.entries(propCount).sort((a, b) => b[1] - a[1])[0];

  const closerCount: Record<string, number> = {};
  todays
    .filter((v) => v.outcome === "booked")
    .forEach((v) => {
      closerCount[v.tcmName] = (closerCount[v.tcmName] ?? 0) + 1;
    });
  const topCloser = Object.entries(closerCount).sort((a, b) => b[1] - a[1])[0];

  const zoneCount: Record<string, number> = {};
  todays.forEach((v) => {
    zoneCount[v.propertyArea] = (zoneCount[v.propertyArea] ?? 0) + 1;
  });
  const maxZone = Math.max(1, ...Object.values(zoneCount));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Scheduled" value={scheduled} />
        <StatCard label="Started" value={started} tone="info" />
        <StatCard label="Completed" value={completed} tone="info" />
        <StatCard label="Booked" value={booked} tone="success" />
        <StatCard label="Conversion" value={`${conv}%`} tone="accent" />
        <StatCard label="Lost" value={lost} tone="destructive" />
        <StatCard label="Avg duration" value={`${avgDur}m`} tone="warning" />
        <StatCard
          label="Top objection"
          value={topObj ? `${topObj[0]}` : "—"}
          sub={topObj ? `${topObj[1]} times` : ""}
          tone="warning"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider mb-3 text-muted-foreground font-semibold">
            Visits by zone
          </div>
          <div className="space-y-2">
            {Object.entries(zoneCount).length === 0 && (
              <div className="text-xs text-muted-foreground">No data yet.</div>
            )}
            {Object.entries(zoneCount).map(([z, c]) => (
              <div key={z} className="flex items-center gap-2">
                <div className="w-28 text-xs truncate">{z}</div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(c / maxZone) * 100}%` }}
                  />
                </div>
                <div className="w-6 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {c}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider mb-3 text-muted-foreground font-semibold">
            Spotlight
          </div>
          <div className="space-y-3">
            <SpotRow
              icon={Building2}
              label="Top property"
              value={topProp ? `${topProp[0]} (${topProp[1]} visits)` : "—"}
              tone="info"
            />
            <SpotRow
              icon={TrendingUp}
              label="Top closer"
              value={topCloser ? `${topCloser[0]} (${topCloser[1]} books)` : "—"}
              tone="success"
            />
            <SpotRow
              icon={AlertTriangle}
              label="Top objection"
              value={topObj ? `${topObj[0]} (${topObj[1]})` : "—"}
              tone="warning"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "info" | "warning" | "success" | "destructive" | "accent";
}) {
  const valCls =
    tone === "info"
      ? "text-info"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "success"
          ? "text-success"
          : tone === "destructive"
            ? "text-destructive"
            : tone === "accent"
              ? "text-accent"
              : "text-foreground";
  return (
    <Card className="p-4 rounded-2xl border border-border/50 relative overflow-hidden group hover:border-border transition-colors">
      <div className={cn(
        "absolute -inset-1 opacity-0 group-hover:opacity-10 blur-xl transition-opacity",
        tone === "info" ? "bg-info" : tone === "warning" ? "bg-warning" : tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : tone === "accent" ? "bg-accent" : "bg-primary"
      )} />
      <div className="relative z-10">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className={cn("text-3xl font-bold tabular-nums mt-1 truncate tracking-tight", valCls)}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1 bg-muted/50 px-1.5 py-0.5 rounded-sm w-fit">{sub}</div>}
      </div>
    </Card>
  );
}

function SpotRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "info" | "warning" | "success";
}) {
  const cls =
    tone === "info"
      ? "text-info bg-info/10"
      : tone === "warning"
        ? "text-warning-foreground bg-warning/15"
        : "text-success bg-success/10";
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

function AlertFeed() {
  const { alerts } = useVisitWar();
  if (alerts.length === 0) {
    return (
      <div className="text-sm py-16 text-center text-muted-foreground">
        No alerts. The system pings when something needs attention.
      </div>
    );
  }
  const tone = (s: string) =>
    s === "risk"
      ? "border-l-destructive bg-destructive/5"
      : s === "warn"
        ? "border-l-warning bg-warning/5"
        : s === "win"
          ? "border-l-success bg-success/5"
          : "border-l-info bg-info/5";
  const tagTone = (s: string) =>
    s === "risk"
      ? "text-destructive"
      : s === "warn"
        ? "text-warning-foreground"
        : s === "win"
          ? "text-success"
          : "text-info";
  return (
    <div className="space-y-0 p-2">
      {alerts.map((a, i) => (
        <div key={a.id} className="relative pl-6 pb-4 group">
          {/* Timeline line */}
          {i !== alerts.length - 1 && (
            <div className="absolute left-[11px] top-4 bottom-0 w-px bg-border group-hover:bg-primary/30 transition-colors" />
          )}
          
          {/* Timeline dot */}
          <div className={cn(
            "absolute left-2 top-1.5 h-2 w-2 rounded-full ring-4 ring-card",
            a.severity === "risk" ? "bg-destructive" : a.severity === "warn" ? "bg-warning" : a.severity === "win" ? "bg-success" : "bg-info"
          )} />
          
          <div className={cn(
            "p-3 rounded-xl border flex items-start gap-3 transition-colors",
            tone(a.severity),
            "group-hover:border-foreground/20 group-hover:shadow-sm"
          )}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn("text-[10px] font-bold uppercase tracking-wider", tagTone(a.severity))}
                >
                  {a.kind}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {new Date(a.ts).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>
              <div className="text-xs leading-relaxed">
                <b className="text-foreground">{a.leadName}</b> <span className="opacity-50 mx-1">•</span>{" "}
                <span className="text-muted-foreground">{a.message}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VisitDetailPanel({
  v,
  onClose,
  onPatch,
  onAddObjection,
  onAlert,
}: {
  v: VisitRecord;
  now: number;
  onClose: () => void;
  onPatch: (p: Partial<VisitRecord>) => void;
  onAddObjection: (o: Omit<import("@/lib/visits/war-store").ObjectionEntry, "id" | "ts">) => void;
  onAlert: (
    severity: "info" | "warn" | "risk" | "win",
    kind: import("@/lib/visits/war-store").VisitAlert["kind"],
    message: string,
  ) => void;
}) {
  const storeLeads = useApp((s) => s.leads);
  const storeProperties = useApp((s) => s.properties);
  const lead = storeLeads.find((l) => l.id === v.leadId);
  const prop = storeProperties.find((p) => p.id === v.propertyId);
  const realLeadName = lead?.name ?? v.leadName;
  const realLeadPhone = lead?.phone ?? v.leadPhone;
  const realPropName = prop?.name || v.propertyName || "No property";
  const realPropArea = prop?.area ?? v.propertyArea;
  const prob = probabilityFor(v.reaction, v.objections.length, v.stage);

  const [cat, setCat] = useState<ObjectionCategory>("budget");
  const [sub, setSub] = useState<string>(OBJECTION_CATALOG.budget[0]);
  const [said, setSaid] = useState("");
  const [resp, setResp] = useState("");
  const [res, setRes] = useState<"resolved" | "partial" | "unresolved">("partial");

  const replay: Array<{ ts: number; label: string; tone: "info" | "success" | "warn" | "risk" }> =
    [];
  replay.push({ ts: v.scheduledAt, label: "Visit scheduled", tone: "info" });
  if (v.startedAt)
    replay.push({
      ts: v.startedAt,
      label: `Started — ${v.startedMode ?? "on the way"}`,
      tone: "info",
    });
  if (v.reachedAt) replay.push({ ts: v.reachedAt, label: "Reached property", tone: "success" });
  if (v.ongoingAt) replay.push({ ts: v.ongoingAt, label: "Tour started", tone: "info" });
  if (v.completedAt) replay.push({ ts: v.completedAt, label: "Tour completed", tone: "success" });
  v.objections.forEach((o) =>
    replay.push({
      ts: o.ts,
      label: `Objection · ${o.subType}`,
      tone:
        o.resolution === "resolved" ? "success" : o.resolution === "unresolved" ? "risk" : "warn",
    }),
  );
  if (v.outcome === "booked")
    replay.push({ ts: v.lastUpdateAt, label: "Booking confirmed 🎉", tone: "success" });
  if (v.outcome === "lost")
    replay.push({ ts: v.lastUpdateAt, label: `Lost · ${v.lostReason ?? "—"}`, tone: "risk" });
  replay.sort((a, b) => a.ts - b.ts);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-semibold text-lg truncate">{realLeadName}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {realLeadPhone} · {realPropName}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl border border-border bg-card shadow-sm">
          <StagePill stage={v.stage} />
          {v.startedAt && !v.completedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Visit <LiveTimer since={v.startedAt} kind="visit" />
            </span>
          )}
          {v.startedAt && v.reachedAt && (
            <span className="text-[10px] text-muted-foreground">
              Journey {Math.round((v.reachedAt - v.startedAt) / 60_000)}m
            </span>
          )}
          {v.completedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Post <LiveTimer since={v.completedAt} kind="post" />
            </span>
          )}
          <Badge variant="outline" className={cn("ml-auto font-mono font-bold", probTone(prob))}>
            <Gauge className="h-3 w-3 mr-1" /> {prob}%
          </Badge>
        </div>

        <Section title="1 · Scheduled">
          <KV
            k="Time"
            v={new Date(v.scheduledAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          <KV
            k="Property"
            v={realPropName !== "No property" ? `${realPropName} — ${realPropArea}` : "No property"}
          />
          {prop && (
            <KV
              k="Beds"
              v={`${prop.vacantBeds}/${prop.totalBeds} · ₹${(prop.pricePerBed / 1000).toFixed(0)}k/bed`}
            />
          )}
          <KV k="Coordinator" v={v.tcmName} />
          {lead?.source && <KV k="Source" v={lead.source} />}
          {lead?.budget ? <KV k="Budget" v={`₹${(lead.budget / 1000).toFixed(0)}k`} /> : null}
          {lead?.preferredArea && <KV k="Area" v={lead.preferredArea} />}
          {lead?.quality && <KV k="Quality" v={lead.quality} />}
        </Section>

        <Section title="2 · Visit Started">
          <ButtonRow>
            <ActBtn
              label="On The Way"
              tone="info"
              active={v.startedMode === "on-the-way"}
              onClick={() => {
                if (v.startedMode === "on-the-way") {
                  onPatch({ stage: "scheduled", startedMode: undefined, startedAt: undefined });
                } else {
                  onPatch({
                    stage: "started",
                    startedMode: "on-the-way",
                    startedAt: v.startedAt ?? Date.now(),
                  });
                  onAlert("info", "started", "Customer on the way");
                }
              }}
            />
            <ActBtn
              label="Reached"
              tone="success"
              active={v.startedMode === "reached"}
              onClick={() => {
                if (v.startedMode === "reached") {
                  onPatch({ stage: "started", startedMode: "on-the-way", reachedAt: undefined });
                } else {
                  onPatch({
                    stage: "at-property",
                    startedMode: "reached",
                    startedAt: v.startedAt ?? Date.now(),
                    reachedAt: Date.now(),
                  });
                  onAlert("win", "reached", "Reached property");
                }
              }}
            />
            <ActBtn
              label="Delayed"
              tone="warning"
              active={v.startedMode === "delayed"}
              onClick={() => {
                if (v.startedMode === "delayed") {
                  onPatch({ startedMode: undefined });
                } else {
                  onPatch({ startedMode: "delayed" });
                  onAlert("warn", "delay", "Customer delayed");
                }
              }}
            />
            <ActBtn
              label="No Show"
              tone="destructive"
              active={v.startedMode === "no-show"}
              onClick={() => {
                if (v.startedMode === "no-show") {
                  onPatch({ stage: "scheduled", startedMode: undefined, outcome: null });
                } else {
                  onPatch({ stage: "lost", startedMode: "no-show", outcome: "lost" });
                  onAlert("risk", "lost", "No-show");
                }
              }}
            />
          </ButtonRow>
        </Section>

        <Section title="3 · Tour Ongoing · Reaction">
          <ButtonRow>
            {(["loved", "interested", "comparing", "average", "rejected"] as Reaction[]).map(
              (r) => {
                const emoji = {
                  loved: "😍",
                  interested: "🙂",
                  comparing: "🤔",
                  average: "😐",
                  rejected: "❌",
                }[r];
                const active = v.reaction === r;
                return (
                  <Button
                    key={r}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="h-8 gap-1 capitalize"
                    onClick={() => {
                      if (v.reaction === r) {
                        onPatch({ reaction: undefined });
                      } else {
                        onPatch({
                          reaction: r,
                          stage: v.stage === "completed" ? "completed" : "tour-ongoing",
                          ongoingAt: v.ongoingAt ?? Date.now(),
                        });
                      }
                    }}
                  >
                    <span>{emoji}</span>
                    {r}
                  </Button>
                );
              },
            )}
          </ButtonRow>
        </Section>

        <Section title="4 · Visit Done · Decision">
          <ButtonRow>
            {(
              [
                ["ready-to-book", "Ready To Book", "success"],
                ["needs-discussion", "Needs Discussion", undefined],
                ["comparing-options", "Comparing", undefined],
                ["parent-approval", "Parent Approval", undefined],
                ["budget-pending", "Budget Pending", undefined],
                ["not-interested", "Not Interested", "destructive"],
              ] as Array<[Decision, string, ToneKey | undefined]>
            ).map(([d, label, tone]) => (
              <ActBtn
                key={d}
                label={label}
                tone={tone}
                active={v.decision === d}
                onClick={() => {
                  if (v.decision === d) {
                    onPatch({
                      decision: undefined,
                      stage: "tour-ongoing",
                      completedAt: undefined,
                      outcome: null,
                    });
                  } else {
                    onPatch({
                      decision: d,
                      stage: d === "not-interested" ? "lost" : "completed",
                      completedAt: v.completedAt ?? Date.now(),
                      outcome:
                        d === "ready-to-book"
                          ? "thinking"
                          : d === "not-interested"
                            ? "lost"
                            : "thinking",
                    });
                    onAlert(
                      d === "not-interested" ? "risk" : "info",
                      "completed",
                      `Visit done · ${label}`,
                    );
                  }
                }}
              />
            ))}
          </ButtonRow>
        </Section>

        <Section title="5 · Objection Tracker">
          {v.objections.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {v.objections.map((o) => (
                <div key={o.id} className="p-2 rounded-lg bg-muted/50 text-[11px] border">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[9px] uppercase border-warning/40 bg-warning/15 text-warning-foreground"
                    >
                      {o.category}
                    </Badge>
                    <span className="font-semibold">{o.subType}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-auto text-[9px] uppercase",
                        o.resolution === "resolved"
                          ? "border-success/40 bg-success/10 text-success"
                          : o.resolution === "partial"
                            ? "border-warning/40 bg-warning/15 text-warning-foreground"
                            : "border-destructive/40 bg-destructive/10 text-destructive",
                      )}
                    >
                      {o.resolution}
                    </Badge>
                  </div>
                  {o.customerSaid && <div className="mt-1 text-foreground">"{o.customerSaid}"</div>}
                  {o.salesResponse && (
                    <div className="mt-0.5 italic text-muted-foreground">→ {o.salesResponse}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Select
              value={cat}
              onValueChange={(c) => {
                setCat(c as ObjectionCategory);
                setSub(OBJECTION_CATALOG[c as ObjectionCategory][0]);
              }}
            >
              <SelectTrigger className="h-8 text-xs capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                {Object.keys(OBJECTION_CATALOG).map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sub} onValueChange={setSub}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                {OBJECTION_CATALOG[cat].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={said}
            onChange={(e) => setSaid(e.target.value)}
            rows={2}
            placeholder='Customer exact words — "my office is 8 km away..."'
            className="text-xs mb-2"
          />
          <Textarea
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            rows={2}
            placeholder="Sales response — what did you say back?"
            className="text-xs mb-2"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["resolved", "partial", "unresolved"] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={res === r ? "default" : "outline"}
                className={cn(
                  "h-7 text-[11px] capitalize",
                  res === r && r === "resolved" && "bg-success hover:bg-success/90",
                  res === r && r === "unresolved" && "bg-destructive hover:bg-destructive/90",
                )}
                onClick={() => setRes(r)}
              >
                {r}
              </Button>
            ))}
            <Button
              size="sm"
              className="ml-auto h-7 text-[11px] gap-1"
              onClick={() => {
                if (!sub) return;
                onAddObjection({
                  category: cat,
                  subType: sub,
                  customerSaid: said,
                  salesResponse: resp,
                  resolution: res,
                });
                setSaid("");
                setResp("");
                setRes("partial");
              }}
            >
              <Plus className="h-3 w-3" /> Log
            </Button>
          </div>
        </Section>

        <Section title="6 · Follow-up Stage">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["fu-1", "Follow-up 1"],
                ["fu-2", "Follow-up 2"],
                ["fu-3", "Follow-up 3"],
                ["negotiation", "Negotiation"],
                ["waiting-salary", "Wait · Salary"],
                ["waiting-joining", "Wait · Joining"],
                ["waiting-parents", "Wait · Parents"],
                ["booking-expected", "Booking Expected"],
              ] as Array<[FollowUpStage, string]>
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={v.followUpStage === k ? "default" : "outline"}
                className="h-7 text-[11px] justify-start"
                onClick={() => onPatch({ followUpStage: k, stage: "follow-up" })}
              >
                {label}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="7 · Final Outcome">
          <ButtonRow>
            <ActBtn
              label="✅ Booked"
              tone="success"
              active={v.outcome === "booked"}
              onClick={() => {
                onPatch({ stage: "booked", outcome: "booked" });
                onAlert("win", "booked", "Booking closed");
              }}
            />
            <ActBtn
              label="🟡 Thinking"
              active={v.outcome === "thinking"}
              onClick={() => onPatch({ outcome: "thinking" })}
            />
            <ActBtn
              label="🔵 Follow-up"
              tone="info"
              active={v.outcome === "follow-up"}
              onClick={() => onPatch({ outcome: "follow-up", stage: "follow-up" })}
            />
            <ActBtn
              label="🔴 Lost"
              tone="destructive"
              active={v.outcome === "lost"}
              onClick={() => {
                onPatch({ stage: "lost", outcome: "lost" });
                onAlert("risk", "lost", "Visit lost");
              }}
            />
          </ButtonRow>
        </Section>

        {v.outcome === "lost" && (
          <Section title="Why Lost?">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["chose-another-pg", "Chose Another PG"],
                  ["chose-flat", "Chose Flat"],
                  ["cancelled-relocation", "Cancelled Move"],
                  ["budget", "Budget"],
                  ["location", "Location"],
                  ["amenities", "Amenities"],
                  ["family-rejected", "Family Rejected"],
                  ["no-response", "No Response"],
                  ["joined-different-company", "Different Co."],
                  ["college-plan-changed", "College Changed"],
                ] as Array<[LostReason, string]>
              ).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={v.lostReason === k ? "destructive" : "outline"}
                  className="h-7 text-[11px] justify-start"
                  onClick={() => onPatch({ lostReason: k })}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Section>
        )}

        <Section title="📼 Visit Replay">
          <div className="space-y-1.5 border-l-2 border-border ml-1 pl-3">
            {replay.length === 0 && (
              <div className="text-xs text-muted-foreground">No events yet.</div>
            )}
            {replay.map((e, i) => {
              const dot =
                e.tone === "risk"
                  ? "bg-destructive"
                  : e.tone === "warn"
                    ? "bg-warning"
                    : e.tone === "success"
                      ? "bg-success"
                      : "bg-info";
              return (
                <div key={i} className="relative">
                  <span className={cn("absolute -left-[17px] top-1.5 h-2 w-2 rounded-full", dot)} />
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {new Date(e.ts).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <span className="text-xs">{e.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="📲 WhatsApp Copy Block">
          <VisitCopyChips v={v} />
        </Section>

        <Section title="🎯 Coach & Intervention">
          <CoachNoteThread v={v} />
        </Section>
      </div>

      <div className="border-t p-3 flex gap-2 bg-muted/30 shrink-0">
        <Button asChild className="flex-1 gap-1.5">
          <a href={`tel:${v.leadPhone}`}>
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          className="flex-1 gap-1.5 border-success/40 text-success hover:bg-success/10"
        >
          <a
            href={`https://wa.me/${v.leadPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

type ToneKey = "info" | "success" | "warning" | "destructive";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const isNumbered = title.match(/^\d+\s·/);
  
  if (isNumbered) {
    const [num, ...rest] = title.split(" · ");
    const label = rest.join(" · ");
    return (
      <div className="relative pl-8 pb-2">
        {/* Stepper Line */}
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/60" />
        
        {/* Stepper Circle */}
        <div className="absolute left-0 top-0 h-8 w-8 rounded-full bg-muted border border-border shadow-sm flex items-center justify-center font-display font-bold text-foreground z-10 text-xs">
          {num}
        </div>
        
        <div className="pt-1.5 pb-2">
          <div className="text-xs uppercase tracking-wider font-bold text-foreground mb-3">
            {label}
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-4">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
      <div className="text-[10px] uppercase tracking-wider font-bold text-foreground bg-muted/40 px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function ActBtn({
  label,
  onClick,
  tone,
  active,
}: {
  label: string;
  onClick: () => void;
  tone?: ToneKey;
  active?: boolean;
}) {
  const activeCls =
    tone === "success"
      ? "bg-success text-success-foreground hover:bg-success/90"
      : tone === "destructive"
        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        : tone === "warning"
          ? "bg-warning text-warning-foreground hover:bg-warning/90"
          : tone === "info"
            ? "bg-info text-info-foreground hover:bg-info/90"
            : "";
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn("h-8 text-xs", active && activeCls)}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
