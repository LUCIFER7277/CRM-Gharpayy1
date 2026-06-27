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
import { Search } from "lucide-react";
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Pipeline open", value: open.length, accent: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50/50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-900/50" },
            { label: "Hot ≥70%", value: hot.length, accent: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/50 dark:bg-amber-900/20", border: "border-amber-100 dark:border-amber-900/50" },
            { label: "Booked", value: booked.length, accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-900/50" },
            { label: "₹ Booked", value: revenue > 0 ? `₹${(revenue / 100000).toFixed(1)}L` : "₹0", accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-900/50" },
            { label: "₹ Walking", value: walking > 0 ? `₹${(walking / 100000).toFixed(1)}L` : "₹0", accent: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50/50 dark:bg-rose-900/20", border: "border-rose-100 dark:border-rose-900/50" },
          ].map((k) => (
            <div key={k.label} className={`group relative overflow-hidden rounded-2xl border ${k.border} bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl shadow-sm`}>
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${k.bg}`} />
              <div className="relative z-10 flex flex-col gap-1.5">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">{k.label}</div>
                <div className={`text-3xl font-display font-extrabold tracking-tight ${k.accent}`}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-4">
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

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-10 rounded-full group-hover:bg-blue-500/10 transition-colors duration-500"></div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></span>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Live pulse — visit alerts</div>
            </div>
            <ul className="space-y-1.5 text-[12px] max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {livePulse.map((a) => (
                <li key={`${a.id}-${a.kind}-${a.ts}`} className="flex gap-2.5 items-start py-1 border-b border-border/30 last:border-0 hover:bg-muted/30 rounded px-1 transition-colors">
                  <span className="text-blue-500/80 font-mono text-[10px] shrink-0 mt-0.5">
                    {new Date(a.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-foreground/90 leading-tight">
                    <span className="font-medium text-foreground">{a.leadName}</span> · <span className="text-muted-foreground">{a.coordinatorName}</span>
                    <br />
                    <span className="text-blue-600 dark:text-blue-400 font-medium text-[11px] uppercase tracking-wide">{a.kind}</span>
                  </span>
                </li>
              ))}
              {!livePulse.length && <li className="text-muted-foreground/60 italic py-4 text-center">No active alerts.</li>}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -z-10 rounded-full group-hover:bg-purple-500/10 transition-colors duration-500"></div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-purple-500/50"></span>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Audit feed</div>
            </div>
            <ul className="space-y-1.5 text-[12px] max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {audit.map((e) => (
                <li key={e.id} className="flex gap-2.5 items-start py-1 border-b border-border/30 last:border-0 hover:bg-muted/30 rounded px-1 transition-colors">
                  <span className="text-purple-500/70 font-mono text-[10px] shrink-0 mt-0.5">
                    {new Date(e.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-foreground/80 leading-tight">{e.summary}</span>
                </li>
              ))}
              {!audit.length && <li className="text-muted-foreground/60 italic py-4 text-center">No admin actions yet.</li>}
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
  const [whySearch, setWhySearch] = useState("");

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
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 blur-2xl -z-10 rounded-full"></div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-amber-500/60"></span>
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Why leads aren't closing</div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {WHY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onWhyTabChange(t.key)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all duration-200 ${
              whyTab === t.key
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:bg-muted/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {whyTab === "by-tcm" ? (
        <>
          <div className="relative mb-3 group">
            <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search by TCM name..."
              value={whySearch}
              onChange={(e) => setWhySearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 text-xs bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <ul className="space-y-1 text-xs">
            {whyByTcm.filter((t) => !whySearch || t.tcm.toLowerCase().includes(whySearch.toLowerCase())).map((t) => (
              <li key={t.tcm} className="group/item">
                <button
                  onClick={() => {
                    const leads = open.filter((r) => (r.tcm?.name || "Unassigned") === t.tcm);
                    onOpenLeads(`${t.tcm}'s pipeline`, leads);
                  }}
                  className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group-hover/item:pl-3"
                >
                  <span className="font-medium truncate text-foreground/90">{t.tcm}</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{t.total}</span>
                </button>
                <div className="pl-3 space-y-0.5 text-muted-foreground/80 mt-1">
                  {t.entries.map(([reason, leads]) => (
                    <button
                      key={reason}
                      onClick={() => onOpenLeads(reason, leads)}
                      className="w-full flex justify-between items-center text-[11px] py-0.5 hover:text-foreground transition-colors group/sub"
                    >
                      <span className="truncate group-hover/sub:translate-x-1 transition-transform duration-200">{reason}</span>
                      <span className="font-mono text-muted-foreground/60">{leads.length}</span>
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
            <li key={w.reason} className="group/item">
              <button
                onClick={() => {
                  const matching = filterCtx.filter((r) => r.whyNotClosed === w.reason);
                  onOpenLeads(w.reason, matching);
                }}
                className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group-hover/item:pl-3"
              >
                <span className="truncate text-foreground/90">{w.reason}</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 shrink-0 ml-2">{w.count}</span>
              </button>
              {w.reason.startsWith("Fresh lead") && freshLeadStats && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5 pl-3">
                    Oldest: {freshLeadStats.oldestDays}d ago
                  </div>
                  {freshLeadStats.unassignedCount > 0 && (
                    <div className="text-[10px] text-rose-500 font-medium mt-0.5 pl-3 animate-pulse">
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
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm flex flex-col h-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 blur-2xl -z-10 rounded-full"></div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-rose-500/60"></span>
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Top objection codes</div>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed mt-2 italic">
          No objections logged yet.
          <br />
          Objections appear here when TCMs fill the objection field
          after completing visits or marking leads as lost.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 blur-2xl -z-10 rounded-full"></div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-rose-500/60"></span>
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Top objection codes</div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {OBJ_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onObjTabChange(t.key)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all duration-200 ${
              objTab === t.key
                ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20"
                : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:bg-muted/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {objTab === "by-tcm" && (
        <div className="relative mb-3 group">
          <select
            value={objTcmFilter}
            onChange={(e) => onObjTcmChange(e.target.value)}
            className="w-full h-8 pl-3 pr-8 text-xs bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all appearance-none cursor-pointer text-foreground/80 group-focus-within:border-rose-500/50"
          >
            <option value="all">All TCMs</option>
            {objTcmOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-muted-foreground/60 transition-colors group-focus-within:text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
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
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group/item"
            >
              <span className="truncate flex-1 text-left font-medium text-foreground/90 group-hover/item:translate-x-1 transition-transform duration-200">{o.code.replace(/-/g, " ")}</span>
              <span className="font-mono text-muted-foreground/60 shrink-0 text-[10px]">
                {o.raised}r
              </span>
              <span className="font-mono text-rose-500/80 shrink-0 text-[10px]">
                {o.lost}l
              </span>
              <span className="font-mono font-semibold shrink-0 w-8 text-right text-[11px]"
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
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 blur-2xl -z-10 rounded-full"></div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500/60"></span>
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/80">Most likely to close in 24h</div>
      </div>
      <div className="relative mb-3 group">
        <select
          value={tcmFilter}
          onChange={(e) => onTcmChange(e.target.value)}
          className="w-full h-8 pl-3 pr-8 text-xs bg-muted/20 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer text-foreground/80 group-focus-within:border-emerald-500/50"
        >
          <option value="all">All TCMs</option>
          {tcmOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          <svg className="w-3.5 h-3.5 text-muted-foreground/60 transition-colors group-focus-within:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      <ol className="space-y-1 text-xs">
        {top24h.map((r, i) => (
          <li key={r.lead.id}>
            <button
              onClick={() => onSelectLead(r)}
              className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group/item"
            >
              <span className="truncate text-left font-medium text-foreground/90 group-hover/item:translate-x-1 transition-transform duration-200">
                {(() => {
                  const rawName = r.lead.name;
                  const rawArea = r.lead.preferredArea;
                  const isSwapped = rawName === "Location" || rawName === "location" || rawName === "Area" || rawName === "area";
                  const name = isSwapped && rawArea ? rawArea : rawName;
                  const area = isSwapped && rawArea ? rawName : rawArea;
                  return <><span className="font-semibold text-emerald-600/80 dark:text-emerald-400/80 mr-1.5">{i + 1}.</span><span className="text-foreground">{name}</span>{area ? <span className="text-muted-foreground/60 ml-1.5 text-[11px] font-normal tracking-wide">· {area}</span> : null}</>;
                })()}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold shrink-0 ml-2">{r.probability}%</span>
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
