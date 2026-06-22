import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { summarizeWhyNotClosing, summarizeTopObjections } from "@/admin/lib/selectors";
import { useApp } from "@/lib/store";
import { useVisitWar } from "@/lib/visits/war-store";
import { useAuditLog } from "@/lib/crm10x/audit-log";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { AdminLeadRow } from "@/admin/lib/selectors";
import type { ObjectionRecord } from "@/lib/crm10x/types";

export const Route = createFileRoute("/admin/")(
  {
    component: AdminCockpit,
  }
);

type WhyTab = "all" | "tour-done" | "negotiation" | "contacted" | "new" | "by-tcm";
type ObjTab = "all" | "by-tcm";

const WHY_TABS: { key: WhyTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tour-done", label: "Tour done" },
  { key: "negotiation", label: "Negotiation" },
  { key: "contacted", label: "Contacted" },
  { key: "new", label: "New" },
  { key: "by-tcm", label: "By TCM" },
];

const OBJ_TABS: { key: ObjTab; label: string }[] = [
  { key: "all", label: "All codes" },
  { key: "by-tcm", label: "By TCM" },
];

type DrawerContent =
  | { kind: "why-list"; title: string; leads: AdminLeadRow[] }
  | { kind: "obj-list"; title: string; leads: AdminLeadRow[] }
  | { kind: "lead-detail"; row: AdminLeadRow }
  | { kind: "tcm-list"; title: string; leads: AdminLeadRow[] }
  | null;

function AdminCockpit() {
  const rows = useAdminRows();
  const { tcms, leads } = useApp();
  const visits = useVisitWar((s) => s.records);
  const audit = useAuditLog((s) => s.entries)
    .filter((e) => e.action.startsWith("admin."))
    .slice(0, 8);
  const now = Date.now();

  const leadNameMap = useMemo(() => {
    const m = new Map<string, string>();
    leads.forEach((l) => m.set(l.id, l.name));
    return m;
  }, [leads]);
  const tcmNameMap = useMemo(() => {
    const m = new Map<string, string>();
    tcms.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tcms]);

  const [whyTab, setWhyTab] = useState<WhyTab>("all");
  const [objTab, setObjTab] = useState<ObjTab>("all");
  const [objTcmFilter, setObjTcmFilter] = useState("all");
  const [tcmFilter, setTcmFilter] = useState("all");
  const [drawer, setDrawer] = useState<DrawerContent>(null);

  const open = rows.filter((r) => r.status === "open" || r.status === "dormant");
  const hot = open.filter((r) => r.probability >= 70);
  const booked = rows.filter((r) => r.booked);
  const lost = rows.filter((r) => r.status === "lost");
  const walking = lost.reduce((s, r) => s + r.lead.budget * 12, 0);
  const revenue = booked.reduce((s, r) => s + (r.bookings[0]?.amount ?? r.lead.budget) * 12, 0);

  const whys = useMemo(() => summarizeWhyNotClosing(rows), [rows]);

  const filteredWhys = useMemo(() => {
    if (whyTab === "all" || whyTab === "by-tcm") return whys;
    const stageMap: Record<string, string> = {
      "tour-done": "tour-done",
      "negotiation": "negotiation",
      "contacted": "contacted",
      "new": "new",
    };
    const stage = stageMap[whyTab];
    const filtered = rows.filter((r) => r.lead.stage === stage && !r.booked);
    return summarizeWhyNotClosing(filtered);
  }, [rows, whyTab, whys]);

  const whyByTcm = useMemo(() => {
    if (whyTab !== "by-tcm") return [];
    const map = new Map<string, Map<string, AdminLeadRow[]>>();
    open.forEach((r) => {
      const name = r.tcm?.name || "Unassigned";
      if (!map.has(name)) map.set(name, new Map());
      const reasons = map.get(name)!;
      if (!reasons.has(r.whyNotClosed)) reasons.set(r.whyNotClosed, []);
      reasons.get(r.whyNotClosed)!.push(r);
    });
    return [...map.entries()]
      .map(([tcm, reasons]) => ({
        tcm,
        entries: [...reasons.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3),
        total: [...reasons.values()].reduce((s, v) => s + v.length, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [open, whyTab]);

  const hasRealObjections = useMemo(() => {
    return rows.some((r) =>
      r.objections.some((o) => o.code !== "none") ||
      (r.lead.primaryObjection !== undefined && r.lead.primaryObjection !== null && r.lead.primaryObjection !== "" && r.lead.primaryObjection !== "none") ||
      r.visits.some((v) => v.objections && v.objections.length > 0) ||
      r.tours.some((t) => t.postTour?.objection && t.postTour.objection !== "" && t.postTour.objection !== "none"),
    );
  }, [rows]);

  const objectionDetails = useMemo(() => {
    if (!hasRealObjections) return [];
    const counts = new Map<string, { raised: number; lost: number }>();
    rows.forEach((r) => {
      const codes = new Set<string>();
      r.objections.filter((o) => o.code !== "none").forEach((o) => codes.add(o.code));
      if (r.lead.primaryObjection && r.lead.primaryObjection !== "none" && r.lead.primaryObjection !== "") codes.add(r.lead.primaryObjection);
      r.visits.forEach((v) => {
        (v.objections || []).forEach((o) => {
          const code: string = o.category || o.subType || "";
          if (code) codes.add(code);
        });
      });
      r.tours.forEach((t) => {
        const obj = t.postTour?.objection;
        if (obj && obj !== "none" && obj !== "") codes.add(obj);
      });
      codes.forEach((code) => {
        if (!counts.has(code)) counts.set(code, { raised: 0, lost: 0 });
        counts.get(code)!.raised++;
        if (r.status === "lost") counts.get(code)!.lost++;
      });
    });
    return [...counts.entries()]
      .map(([code, { raised, lost }]) => ({
        code,
        raised,
        lost,
        lossPct: raised > 0 ? Math.round((lost / raised) * 100) : 0,
      }))
      .sort((a, b) => b.lossPct - a.lossPct)
      .slice(0, 8);
  }, [rows, hasRealObjections]);

  const filteredObjectionDetails = useMemo(() => {
    if (!hasRealObjections) return objectionDetails;
    if (objTab !== "by-tcm" || objTcmFilter === "all") return objectionDetails;
    const rowsWithTcm = rows.filter((r) => r.lead.assignedTcmId === objTcmFilter);
    const counts = new Map<string, { raised: number; lost: number }>();
    rowsWithTcm.forEach((r) => {
      const codes = new Set<string>();
      r.objections.filter((o) => o.code !== "none").forEach((o) => codes.add(o.code));
      if (r.lead.primaryObjection && r.lead.primaryObjection !== "none" && r.lead.primaryObjection !== "") codes.add(r.lead.primaryObjection);
      r.visits.forEach((v) => {
        (v.objections || []).forEach((o) => {
          const code: string = o.category || o.subType || "";
          if (code) codes.add(code);
        });
      });
      r.tours.forEach((t) => {
        const obj = t.postTour?.objection;
        if (obj && obj !== "none" && obj !== "") codes.add(obj);
      });
      codes.forEach((code) => {
        if (!counts.has(code)) counts.set(code, { raised: 0, lost: 0 });
        counts.get(code)!.raised++;
        if (r.status === "lost") counts.get(code)!.lost++;
      });
    });
    return [...counts.entries()]
      .map(([code, { raised, lost }]) => ({ code, raised, lost, lossPct: raised > 0 ? Math.round((lost / raised) * 100) : 0 }))
      .sort((a, b) => b.lossPct - a.lossPct)
      .slice(0, 8);
  }, [rows, objTab, objTcmFilter, hasRealObjections, objectionDetails]);

  const objTcmOptions = useMemo(() => {
    const activeIds = new Set<string>();
    rows.forEach((r) => {
      if (r.objections.some((o) => o.code !== "none") || r.lead.primaryObjection) {
        if (r.lead.assignedTcmId) activeIds.add(r.lead.assignedTcmId);
      }
    });
    return tcms.filter((t) => activeIds.has(t.id));
  }, [rows, tcms]);

  const tcmOptions = useMemo(() => {
    const activeIds = new Set(rows.filter((r) => !r.booked).map((r) => r.lead.assignedTcmId));
    return tcms.filter((t) => activeIds.has(t.id));
  }, [rows, tcms]);

  console.log('📊 Fix 1 — sample lead:', JSON.stringify(leads[0], null, 2));
  console.log('📊 Fix 2 — all lead names:', leads.map((l) => ({ id: l.id, name: l.name, preferredArea: l.preferredArea, stage: l.stage })));
  console.log('📊 Fix 2 — checking for "Location" in names:', leads.find((l) => l.name === "Location" || l.name?.toLowerCase().includes("location")));
  console.log('📊 Fix 1 — first 10 lead confidence/intent:', leads.slice(0, 10).map((l) => ({ name: l.name, confidence: l.confidence, intent: l.intent })));

  const top24h = useMemo(() => {
    let filtered = rows
      .filter((r) => !r.booked && r.lead.stage !== "dropped")
      .map((r) => {
        const raw = r.lead.confidence;
        const intent = r.lead.intent;
        let p: number;
        if (typeof raw === "number" && raw > 0 && raw < 100) {
          p = raw;
        } else {
          p = intent === "hot" ? 85 : intent === "warm" ? 55 : intent === "cold" ? 20 : 30;
        }
        return { ...r, probability: p };
      });
    if (tcmFilter !== "all") {
      filtered = filtered.filter((r) => r.lead.assignedTcmId === tcmFilter);
    }
    return filtered
      .filter((r) => r.probability > 50)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 8);
  }, [rows, tcmFilter]);

  const livePulse = useMemo(() => {
    return Object.values(visits)
      .flatMap((v) => {
        const alerts: { ts: number; id: string; text: string }[] = [];
        const delayed = !!v.startedAt && !v.reachedAt && now - v.startedAt > 15 * 60_000;
        if (delayed) {
          alerts.push({ ts: v.startedAt!, id: v.tourId, text: "Delayed start" });
        }
        const completedAgo = v.completedAt ? now - v.completedAt : 0;
        if (v.completedAt && !v.reaction && completedAgo > 2 * 3600_000) {
          alerts.push({ ts: v.completedAt, id: v.tourId, text: "Post-visit silence" });
        }
        if (v.completedAt && v.outcome === "thinking" && completedAgo > 24 * 3600_000) {
          alerts.push({ ts: v.completedAt, id: v.tourId, text: "Decision pending" });
        }
        const ghost = !!v.completedAt && completedAgo > 6 * 3600_000 && (!v.outcome || v.outcome === "thinking" || v.outcome === "follow-up");
        if (ghost) {
          alerts.push({ ts: v.completedAt!, id: v.tourId, text: "Ghost follow-up" });
        }
        const realLeadName = leadNameMap.get(v.leadId) || v.leadName;
        const realTcmName = tcmNameMap.get(v.tcmId) || v.tcmName;
        if (realLeadName === "Lead" || realLeadName === "Coordinator" || realTcmName === "Lead" || realTcmName === "Coordinator") return [];
        return alerts.map((a) => ({
          id: a.id,
          kind: a.text,
          ts: a.ts,
          leadName: realLeadName,
          coordinatorName: realTcmName,
        }));
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20);
  }, [visits, now, leadNameMap, tcmNameMap]);

  return (
    <>
    <AdminShell title="Cockpit" sub="Single screen — every signal, every action.">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pipeline open", value: open.length, accent: "text-info" },
            { label: "Hot ≥70%", value: hot.length, accent: "text-accent" },
            { label: "Booked", value: booked.length, accent: "text-success" },
            { label: "₹ Booked", value: revenue > 0 ? `₹${(revenue / 100000).toFixed(1)}L` : "₹0", accent: "text-success" },
            { label: "₹ Walking", value: walking > 0 ? `₹${(walking / 100000).toFixed(1)}L` : "₹0", accent: "text-destructive" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-display font-semibold ${k.accent}`}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <WhyPanel
            whys={filteredWhys}
            whyTab={whyTab}
            onWhyTabChange={setWhyTab}
            whyByTcm={whyByTcm}
            open={open}
            rows={rows}
            tcms={tcms}
            onOpenLeads={(title, leads) => setDrawer({ kind: "why-list", title, leads })}
          />

          <ObjPanel
            hasRealObjections={hasRealObjections}
            objectionDetails={filteredObjectionDetails}
            objTab={objTab}
            onObjTabChange={setObjTab}
            objTcmFilter={objTcmFilter}
            onObjTcmChange={setObjTcmFilter}
            objTcmOptions={objTcmOptions}
            rows={rows}
            onOpenLeads={(title, leads) => setDrawer({ kind: "obj-list", title, leads })}
          />

          <ClosePanel
            top24h={top24h}
            tcmOptions={tcmOptions}
            tcmFilter={tcmFilter}
            onTcmChange={setTcmFilter}
            onSelectLead={(row) => setDrawer({ kind: "lead-detail", row })}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Live pulse — visit alerts</div>
            <ul className="space-y-1 text-xs max-h-72 overflow-auto">
              {livePulse.map((a) => (
                <li key={`${a.id}-${a.kind}-${a.ts}`} className="flex gap-2">
                  <span className="text-muted-foreground font-mono">
                    {new Date(a.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate">
                    {a.leadName} · {a.coordinatorName} · {a.kind}
                  </span>
                </li>
              ))}
              {!livePulse.length && <li className="text-muted-foreground">No alerts.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Audit feed</div>
            <ul className="space-y-1 text-xs max-h-72 overflow-auto">
              {audit.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="text-muted-foreground font-mono">
                    {new Date(e.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate">{e.summary}</span>
                </li>
              ))}
              {!audit.length && <li className="text-muted-foreground">No admin actions yet — take an action in Master Leads to see entries.</li>}
            </ul>
          </div>
        </div>
      </AdminShell>

      <Sheet open={!!drawer} onOpenChange={(o) => { if (!o) setDrawer(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col gap-0">
          {drawer?.kind === "why-list" && (
            <DrawerLeadList title={drawer.title} leads={drawer.leads} onSelectLead={(row) => setDrawer({ kind: "lead-detail", row })} />
          )}
          {drawer?.kind === "obj-list" && (
            <DrawerLeadList title={`Objection: ${drawer.title}`} leads={drawer.leads} onSelectLead={(row) => setDrawer({ kind: "lead-detail", row })} />
          )}
          {drawer?.kind === "tcm-list" && (
            <DrawerLeadList title={drawer.title} leads={drawer.leads} onSelectLead={(row) => setDrawer({ kind: "lead-detail", row })} />
          )}
          {drawer?.kind === "lead-detail" && (
            <LeadDetailPanel row={drawer.row} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ============== WHY NOT CLOSING PANEL ============== */
function WhyPanel({
  whys,
  whyTab,
  onWhyTabChange,
  whyByTcm,
  open,
  rows,
  tcms,
  onOpenLeads,
}: {
  whys: Array<{ reason: string; count: number }>;
  whyTab: WhyTab;
  onWhyTabChange: (t: WhyTab) => void;
  whyByTcm: Array<{ tcm: string; entries: Array<[string, AdminLeadRow[]]>; total: number }>;
  open: AdminLeadRow[];
  rows: AdminLeadRow[];
  tcms: Array<{ id: string; name: string }>;
  onOpenLeads: (title: string, leads: AdminLeadRow[]) => void;
}) {
  const [whyTcmFilter, setWhyTcmFilter] = useState("all");

  const filterCtx = useMemo(() => {
    if (whyTab === "all" || whyTab === "by-tcm") return open;
    const stageMap: Record<string, string> = {
      "tour-done": "tour-done",
      "negotiation": "negotiation",
      "contacted": "contacted",
      "new": "new",
    };
    return rows.filter((r) => r.lead.stage === stageMap[whyTab] && !r.booked);
  }, [rows, whyTab, open]);

  const freshLeadStats = useMemo(() => {
    const newLeads = rows.filter((r) => r.lead.stage === "new" && !r.booked);
    if (!newLeads.length) return null;
    let oldestDays = 0;
    newLeads.forEach((r) => {
      const createdAt = new Date(r.lead.createdAt).getTime();
      const days = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
      if (days > oldestDays) oldestDays = days;
    });
    const unassigned = newLeads.filter((r) => !r.tcm);
    return { oldestDays, unassignedCount: unassigned.length };
  }, [rows]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Why leads aren't closing</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {WHY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onWhyTabChange(t.key)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              whyTab === t.key
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {whyTab === "by-tcm" ? (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setWhyTcmFilter("all")}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                whyTcmFilter === "all"
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              All
            </button>
            {tcms.map((t) => (
              <button
                key={t.id}
                onClick={() => setWhyTcmFilter(t.id)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  whyTcmFilter === t.id
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <ul className="space-y-1 text-xs">
            {(whyTcmFilter === "all" ? whyByTcm : whyByTcm.filter((t) => {
              const matched = tcms.find((tcm) => tcm.id === whyTcmFilter);
              return matched && t.tcm === matched.name;
            })).map((t) => (
              <li key={t.tcm}>
                <button
                  onClick={() => {
                    const leads = open.filter((r) => (r.tcm?.name || "Unassigned") === t.tcm);
                    onOpenLeads(`${t.tcm}'s pipeline`, leads);
                  }}
                  className="w-full flex justify-between items-center p-1.5 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium truncate">{t.tcm}</span>
                  <span className="font-mono text-accent">{t.total}</span>
                </button>
                <div className="pl-3 space-y-0.5 text-muted-foreground">
                  {t.entries.map(([reason, leads]) => (
                    <button
                      key={reason}
                      onClick={() => onOpenLeads(reason, leads)}
                      className="w-full flex justify-between text-[11px] hover:text-foreground transition-colors"
                    >
                      <span className="truncate">{reason}</span>
                      <span className="font-mono">{leads.length}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {!whyByTcm.length && <li className="text-muted-foreground">No data.</li>}
          </ul>
        </>
      ) : (
        <ul className="space-y-1 text-xs">
          {whys.map((w) => (
            <li key={w.reason}>
              <button
                onClick={() => {
                  const matching = filterCtx.filter((r) => r.whyNotClosed === w.reason);
                  onOpenLeads(w.reason, matching);
                }}
                className="w-full flex justify-between items-center p-1.5 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="truncate">{w.reason}</span>
                <span className="font-mono text-accent shrink-0 ml-2">{w.count}</span>
              </button>
              {w.reason.startsWith("Fresh lead") && freshLeadStats && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5 pl-1.5">
                    Oldest: {freshLeadStats.oldestDays}d ago
                  </div>
                  {freshLeadStats.unassignedCount > 0 && (
                    <div className="text-[10px] text-amber-500 font-medium mt-0.5 pl-1.5">
                      ⚠️ {freshLeadStats.unassignedCount} leads have no TCM assigned — assign immediately
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
          {!whys.length && <li className="text-muted-foreground">No open leads.</li>}
        </ul>
      )}
    </div>
  );
}

/* ============== OBJECTIONS PANEL ============== */
function ObjPanel({
  hasRealObjections,
  objectionDetails,
  objTab,
  onObjTabChange,
  objTcmFilter,
  onObjTcmChange,
  objTcmOptions,
  rows,
  onOpenLeads,
}: {
  hasRealObjections: boolean;
  objectionDetails: Array<{ code: string; raised: number; lost: number; lossPct: number }>;
  objTab: ObjTab;
  onObjTabChange: (t: ObjTab) => void;
  objTcmFilter: string;
  onObjTcmChange: (t: string) => void;
  objTcmOptions: Array<{ id: string; name: string }>;
  rows: AdminLeadRow[];
  onOpenLeads: (title: string, leads: AdminLeadRow[]) => void;
}) {
  if (!hasRealObjections) {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Top objection codes</div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed mt-2">
          No objections logged yet.
          <br />
          Objections appear here when TCMs fill the objection field
          after completing visits or marking leads as lost.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Top objection codes</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {OBJ_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onObjTabChange(t.key)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              objTab === t.key
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {objTab === "by-tcm" && (
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={() => onObjTcmChange("all")}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              objTcmFilter === "all"
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            All
          </button>
          {objTcmOptions.map((t) => (
            <button
              key={t.id}
              onClick={() => onObjTcmChange(t.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                objTcmFilter === t.id
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-1 text-xs">
        {objectionDetails.map((o) => (
          <li key={o.code}>
            <button
              onClick={() => {
                const code = o.code;
                const leads = rows.filter((r) =>
                  r.objections.some((obj) => obj.code === code) ||
                  r.lead.primaryObjection === code ||
                  r.visits.some((v) => v.objections?.some((vobj) => (vobj.category || vobj.subType) === code)) ||
                  r.tours.some((t) => t.postTour?.objection === code),
                );
                onOpenLeads(o.code.replace(/-/g, " "), leads);
              }}
              className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="truncate flex-1 text-left">{o.code.replace(/-/g, " ")}</span>
              <span className="font-mono text-muted-foreground shrink-0 text-[10px]">
                {o.raised}r
              </span>
              <span className="font-mono text-destructive shrink-0 text-[10px]">
                {o.lost}l
              </span>
              <span className="font-mono shrink-0 w-8 text-right text-[10px]"
                style={{ color: o.lossPct >= 70 ? "var(--destructive)" : o.lossPct >= 40 ? "var(--warning)" : "var(--muted-foreground)" }}
              >
                {o.lossPct}%
              </span>
            </button>
          </li>
        ))}
        {!objectionDetails.length && (
          <li className="text-muted-foreground text-xs mt-2">No matching objections for this TCM.</li>
        )}
      </ul>
    </div>
  );
}

/* ============== CLOSE IN 24H PANEL ============== */
function ClosePanel({
  top24h,
  tcmOptions,
  tcmFilter,
  onTcmChange,
  onSelectLead,
}: {
  top24h: AdminLeadRow[];
  tcmOptions: Array<{ id: string; name: string }>;
  tcmFilter: string;
  onTcmChange: (t: string) => void;
  onSelectLead: (row: AdminLeadRow) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Most likely to close in 24h</div>
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          onClick={() => onTcmChange("all")}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            tcmFilter === "all"
              ? "bg-accent text-accent-foreground border-accent"
              : "border-border text-muted-foreground hover:border-foreground/30"
          }`}
        >
          All TCMs
        </button>
        {tcmOptions.map((t) => (
          <button
            key={t.id}
            onClick={() => onTcmChange(t.id)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              tcmFilter === t.id
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {t.name}
          </button>
        ))}
        {!tcmOptions.length && null}
      </div>
      <ol className="space-y-1 text-xs">
        {top24h.map((r, i) => (
          <li key={r.lead.id}>
            <button
              onClick={() => onSelectLead(r)}
              className="w-full flex justify-between items-center p-1.5 rounded hover:bg-muted/50 transition-colors"
            >
              <span className="truncate text-left">
                {(() => {
                  const rawName = r.lead.name;
                  const rawArea = r.lead.preferredArea;
                  const isSwapped = rawName === "Location" || rawName === "location" || rawName === "Area" || rawName === "area";
                  const name = isSwapped && rawArea ? rawArea : rawName;
                  const area = isSwapped && rawArea ? rawName : rawArea;
                  return <><span className="font-medium">{i + 1}. {name}</span>{area ? <span className="text-muted-foreground ml-1">· {area}</span> : null}</>;
                })()}
              </span>
              <span className="text-accent font-mono shrink-0 ml-2">{r.probability}%</span>
            </button>
          </li>
        ))}
        {!top24h.length && <li className="text-muted-foreground">No open leads.</li>}
      </ol>
    </div>
  );
}

/* ============== DRAWER: LEAD LIST ============== */
function DrawerLeadList({ title, leads, onSelectLead }: { title: string; leads: AdminLeadRow[]; onSelectLead: (r: AdminLeadRow) => void }) {
  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
        <SheetTitle className="text-sm">{title}</SheetTitle>
        <div className="text-[11px] text-muted-foreground">{leads.length} lead{leads.length !== 1 ? "s" : ""}</div>
      </SheetHeader>
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {leads.map((r) => (
          <button
            key={r.lead.id}
            onClick={() => onSelectLead(r)}
            className="w-full text-left p-2.5 rounded-lg hover:bg-muted/50 border border-border/50 text-xs transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{r.lead.name}</span>
              <span className="font-mono text-accent">{r.probability}%</span>
            </div>
            <div className="flex justify-between text-muted-foreground mt-0.5">
              <span>{r.tcm?.name || "—"} · {r.lead.stage}</span>
              <span>₹{r.expectedValue.toLocaleString("en-IN")}</span>
            </div>
            <div className="text-muted-foreground/70 mt-0.5 truncate">{r.whyNotClosed}</div>
          </button>
        ))}
        {!leads.length && <div className="text-muted-foreground text-xs text-center py-8">No leads match.</div>}
      </div>
    </>
  );
}

/* ============== DRAWER: LEAD DETAIL ============== */
function LeadDetailPanel({ row }: { row: AdminLeadRow }) {
  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
        <SheetTitle className="text-sm">{row.lead.name}</SheetTitle>
        <div className="text-[11px] text-muted-foreground font-mono">{row.lead.phone}</div>
      </SheetHeader>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat k="Stage" v={row.lead.stage} />
          <Stat k="Probability" v={`${row.probability}%`} />
          <Stat k="Status" v={row.status} />
          <Stat k="Expected ₹" v={`₹${row.expectedValue.toLocaleString("en-IN")}`} />
          <Stat k="TCM" v={row.tcm?.name ?? "—"} />
          <Stat k="Area" v={row.lead.preferredArea} />
          <Stat k="Tours / Visits" v={`${row.tours.length} / ${row.visits.length}`} />
          <Stat k="Budget" v={`₹${row.lead.budget.toLocaleString("en-IN")}`} />
        </div>

        <div className="rounded-md border border-border p-2.5 bg-muted/30 text-xs">
          <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Why open</div>
          <div className="font-medium">{row.whyNotClosed}</div>
        </div>

        {row.lastObjection && (
          <div className="rounded-md border border-border p-2.5 bg-muted/30 text-xs">
            <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Last objection</div>
            <div className="font-medium">{row.lastObjection.code.replace(/-/g, " ")}</div>
            <div className="text-muted-foreground mt-0.5">“{row.lastObjection.leadWords}”</div>
            <div className="text-muted-foreground/70 mt-0.5">Resolution: {row.lastObjection.resolution}</div>
          </div>
        )}

        {row.objections.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Objection history</div>
            <ul className="space-y-1 text-xs">
              {row.objections.slice(0, 6).map((o) => (
                <li key={o.id} className="flex justify-between items-center p-1.5 rounded border border-border/50">
                  <span className="truncate">{o.code.replace(/-/g, " ")}</span>
                  <span className={`shrink-0 ml-2 ${
                    o.resolution === "yes" ? "text-success" : o.resolution === "partially" ? "text-warning" : "text-destructive"
                  }`}>
                    {o.resolution}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {row.calls.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Recent calls</div>
            <ul className="space-y-1 text-xs max-h-32 overflow-auto">
              {row.calls.slice(0, 5).map((c) => (
                <li key={c.id} className="flex justify-between text-muted-foreground">
                  <span>{new Date(c.ts).toLocaleDateString("en-IN")} · {c.outcome}</span>
                  <span>{c.durationSec}s</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {row.visits.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Visit history</div>
            <ul className="space-y-1 text-xs">
              {row.visits.slice(0, 3).map((v) => (
                <li key={v.tourId} className="flex justify-between text-muted-foreground">
                  <span>{v.propertyName} · {v.stage}</span>
                  <span>{v.outcome || "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {row.coachNotes.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Coach notes</div>
            <ul className="space-y-1 text-xs">
              {row.coachNotes.slice(0, 3).map((n) => (
                <li key={n.id} className="text-muted-foreground border-l-2 border-border pl-2">
                  “{n.text}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-2 bg-muted/20">
      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
