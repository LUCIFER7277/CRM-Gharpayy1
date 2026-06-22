// Owner / creator-side operations panel — lives as a tab inside PGDetail.
// Six sub-modules in one place, all persisted in localStorage via supply.ts:
//   1. Red flag (manual block + reason)
//   2. Live inventory editor (S/D/T total + occupied)
//   3. Visit scheduler
//   4. Owner price-pitch tracker
//   5. Onboarding checklist
//   6. Free-form notes
// Designed for the rep AND the supply manager working the same property.

import { useMemo, useState } from "react";
import type { PG } from "@/property-genius/data/types";
import {
  Flag, Package, CalendarPlus, IndianRupee, ListChecks, NotebookPen,
  Trash2, Plus, AlertOctagon, Save, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSupply, setRedFlag, setInventory, addVisit, updateVisit, removeVisit,
  addPitch, removePitch, toggleChecklist, addNote, removeNote,
  effectiveScarcity, checklistCompletion, CHECKLIST_ITEMS,
  type VisitStatus, type InventoryOverride,
} from "@/property-genius/lib/supply";

type SubTab = "flag" | "inventory" | "visits" | "pitch" | "checklist" | "notes";

export function OwnerPanel({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const [sub, setSub] = useState<SubTab>("inventory");
  const eff = useMemo(() => effectiveScarcity(pg), [pg, rec]);
  const completion = useMemo(() => checklistCompletion(pg.id), [pg.id, rec]);

  return (
    <div className="space-y-4">
      {/* Top status strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Inventory" value={eff.level} accent={eff.hot ? "danger" : eff.level === "FULL" ? "muted" : "success"} sub={eff.source === "live" ? "Live count" : "Derived"} />
        <StatTile label="Visits booked" value={String(rec.visits.filter((v) => v.status === "pending").length)} accent="info" sub={`${rec.visits.length} total`} />
        <StatTile label="Owner pitches" value={String(rec.pitches.length)} accent="warning" sub={rec.pitches[0]?.reaction ?? "none yet"} />
        <StatTile label="Supply ready" value={`${completion}%`} accent={completion >= 80 ? "success" : completion >= 50 ? "warning" : "danger"} sub={`${CHECKLIST_ITEMS.length} items`} />
      </div>

      {rec.redFlag && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertOctagon className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest">Red-flagged property</div>
            <div className="text-xs mt-0.5">{rec.redReason || "No reason recorded yet — open the Red Flag tab to add one."}</div>
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto rounded-lg border border-border bg-surface-1 p-1 scrollbar-none">
        {([
          { k: "inventory", l: "Inventory",  I: Package },
          { k: "visits",    l: "Visits",     I: CalendarPlus },
          { k: "pitch",     l: "Owner Pitch", I: IndianRupee },
          { k: "checklist", l: "Checklist",  I: ListChecks },
          { k: "notes",     l: "Notes",      I: NotebookPen },
          { k: "flag",      l: "Red Flag",   I: Flag },
        ] as const).map(({ k, l, I }) => (
          <button key={k} onClick={() => setSub(k)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-smooth",
              sub === k ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            )}>
            <I className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      <div key={sub} className="animate-fade-up">
        {sub === "inventory" && <InventoryEditor pg={pg} />}
        {sub === "visits"    && <VisitScheduler pg={pg} />}
        {sub === "pitch"     && <OwnerPitchTracker pg={pg} />}
        {sub === "checklist" && <ChecklistEditor pg={pg} />}
        {sub === "notes"     && <NotesEditor pg={pg} />}
        {sub === "flag"      && <RedFlagEditor pg={pg} />}
      </div>
    </div>
  );
}

/* ---------- Shared atoms ---------- */

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: "success" | "warning" | "info" | "danger" | "muted" }) {
  const map: Record<typeof accent, string> = {
    success: "border-success/40 bg-success/5 text-success",
    warning: "border-warning/40 bg-warning/10 text-[hsl(38_76%_36%)]",
    info:    "border-info/40 bg-info/5 text-info",
    danger:  "border-danger/40 bg-danger/10 text-danger",
    muted:   "border-border bg-surface-2 text-muted-foreground",
  };
  return (
    <div className={cn("rounded-lg border p-2.5", map[accent])}>
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold leading-tight">{value}</div>
      {sub && <div className="text-[10px] opacity-70 truncate">{sub}</div>}
    </div>
  );
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: typeof Package; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      {label && <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>}
      <input {...rest} className={cn("w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-smooth", className)} />
    </label>
  );
}

function Select({ label, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>}
      <select {...rest} className={cn("w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 cursor-pointer transition-smooth", rest.className)}>
        {children}
      </select>
    </label>
  );
}

/* ---------- 1. Red Flag ---------- */

function RedFlagEditor({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const [reason, setReason] = useState(rec.redReason ?? "");

  return (
    <Card title="Red flag this property" icon={Flag}>
      <p className="mb-3 text-xs text-muted-foreground">
        Flagged properties show with a red border across Property Hub, Closer ranking, Lead Match, and the Supply Ops dashboard.
        Use this to block out PGs that are temporarily problematic — bad management, ongoing disputes, low photos, anything that should not go to a lead.
      </p>
      <Input label="Reason (visible to all reps)" placeholder="e.g. Owner ghosting, photos out of date, AC not working…"
        value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        {!rec.redFlag ? (
          <button onClick={() => setRedFlag(pg.id, true, reason)}
            className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-2 text-xs font-medium text-danger-foreground hover:opacity-90 transition-smooth">
            <Flag className="h-3.5 w-3.5" /> Mark red
          </button>
        ) : (
          <>
            <button onClick={() => setRedFlag(pg.id, true, reason)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40 transition-smooth">
              <Save className="h-3.5 w-3.5" /> Update reason
            </button>
            <button onClick={() => setRedFlag(pg.id, false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs font-medium text-success hover:bg-success/20 transition-smooth">
              <X className="h-3.5 w-3.5" /> Clear flag
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------- 2. Live inventory ---------- */

function InventoryEditor({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const offered = {
    single: pg.prices.single > 0,
    double: pg.prices.double > 0,
    triple: pg.prices.triple > 0,
  };

  type Slot = { total: number; occupied: number };
  const init = (k: "single" | "double" | "triple"): Slot =>
    rec.inventory?.[k] ?? { total: k === "triple" ? 6 : k === "double" ? 4 : 2, occupied: 0 };
  const [draft, setDraft] = useState({
    single: init("single"),
    double: init("double"),
    triple: init("triple"),
  });

  function save() {
    const inv: InventoryOverride = {
      single: offered.single ? draft.single : null,
      double: offered.double ? draft.double : null,
      triple: offered.triple ? draft.triple : null,
      updatedAt: Date.now(),
    };
    setInventory(pg.id, inv);
  }
  function clear() { setInventory(pg.id, null); }

  return (
    <Card title="Live room inventory" icon={Package}
      action={rec.inventory ? <span className="rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-success">Live · overrides derived</span>
        : <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[hsl(38_76%_36%)]">Auto-derived</span>}>
      <p className="mb-3 text-xs text-muted-foreground">
        Set live counts the manager confirmed today. These override the derived scarcity number across the whole app.
        "Available = Total − Occupied" per sharing type.
      </p>

      <div className="space-y-3">
        {(["triple", "double", "single"] as const).map((k) => offered[k] ? (
          <BedRow key={k} label={k[0].toUpperCase() + k.slice(1) + " sharing"} value={draft[k]}
            onChange={(s) => setDraft({ ...draft, [k]: s })} />
        ) : null)}
        {!offered.single && !offered.double && !offered.triple && (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No sharing types are priced on this property. Update prices in the property record first.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-smooth">
          <Save className="h-3.5 w-3.5" /> Save live count
        </button>
        {rec.inventory && (
          <button onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-danger/40 hover:text-danger transition-smooth">
            <X className="h-3.5 w-3.5" /> Revert to derived
          </button>
        )}
      </div>

      {rec.inventory && (
        <div className="mt-3 text-[10px] text-muted-foreground font-mono">
          Last updated: {new Date(rec.inventory.updatedAt).toLocaleString()}
        </div>
      )}
    </Card>
  );
}

function BedRow({ label, value, onChange }: { label: string; value: { total: number; occupied: number }; onChange: (v: { total: number; occupied: number }) => void }) {
  const remaining = Math.max(0, value.total - value.occupied);
  const pct = value.total ? Math.round((value.occupied / value.total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn("rounded px-1.5 py-0.5", remaining === 0 ? "bg-danger/15 text-danger" : remaining <= 2 ? "bg-warning/15 text-[hsl(38_76%_36%)]" : "bg-success/15 text-success")}>
            {remaining} left
          </span>
          <span className="text-muted-foreground">{pct}% full</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Total beds" type="number" min={0} value={value.total}
          onChange={(e) => onChange({ ...value, total: Math.max(0, +e.target.value || 0) })} />
        <Input label="Occupied" type="number" min={0} max={value.total} value={value.occupied}
          onChange={(e) => onChange({ ...value, occupied: Math.max(0, Math.min(value.total, +e.target.value || 0)) })} />
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full transition-smooth", pct >= 100 ? "bg-danger" : pct >= 75 ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- 3. Visits ---------- */

function VisitScheduler({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [whenISO, setWhenISO] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");

  function add() {
    if (!leadName.trim() || !whenISO) return;
    addVisit(pg.id, { leadName: leadName.trim(), leadPhone: leadPhone.trim() || undefined, whenISO, status: "pending", notes: notes.trim() || undefined });
    setLeadName(""); setLeadPhone(""); setNotes("");
  }

  return (
    <div className="space-y-3">
      <Card title="Schedule a visit" icon={CalendarPlus}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label="Lead name *" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Kruthika" />
          <Input label="Lead phone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="98XXXXXXXX" />
          <Input label="When *" type="datetime-local" value={whenISO} onChange={(e) => setWhenISO(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wants double, parents joining" />
        </div>
        <button onClick={add} disabled={!leadName.trim() || !whenISO}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-smooth">
          <Plus className="h-3.5 w-3.5" /> Add visit
        </button>
      </Card>

      {rec.visits.length > 0 && (
        <Card title={`Scheduled visits · ${rec.visits.length}`} icon={CalendarPlus}>
          <div className="space-y-2">
            {rec.visits.map((v) => (
              <div key={v.id} className="rounded-lg border border-border bg-surface-1 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-semibold">{v.leadName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(v.whenISO).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      {v.leadPhone && ` · ${v.leadPhone}`}
                    </div>
                    {v.notes && <div className="mt-1 text-xs">{v.notes}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <select value={v.status} onChange={(e) => updateVisit(pg.id, v.id, { status: e.target.value as VisitStatus })}
                      className={cn("rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-smooth",
                        v.status === "pending" ? "border-info/40 bg-info/10 text-info"
                        : v.status === "done" ? "border-success/40 bg-success/10 text-success"
                        : v.status === "no-show" ? "border-warning/40 bg-warning/10 text-[hsl(38_76%_36%)]"
                        : "border-border bg-muted text-muted-foreground")}>
                      <option value="pending">Pending</option>
                      <option value="done">Done</option>
                      <option value="no-show">No-show</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button onClick={() => removeVisit(pg.id, v.id)} className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-smooth">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- 4. Owner pitch ---------- */

function OwnerPitchTracker({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const [proposed, setProposed] = useState<number>(pg.prices.double || pg.prices.triple || pg.prices.single || 12000);
  const [forSharing, setForSharing] = useState<"single" | "double" | "triple">("double");
  const [reaction, setReaction] = useState<"accepted" | "negotiating" | "declined" | "ghosted">("negotiating");
  const [nextStep, setNextStep] = useState("");
  const [followUpISO, setFollowUpISO] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");

  function add() {
    addPitch(pg.id, { proposedRent: proposed, forSharing, reaction, nextStep: nextStep.trim() || undefined, followUpISO, notes: notes.trim() || undefined });
    setNextStep(""); setNotes("");
  }

  const cur = pg.prices[forSharing];

  return (
    <div className="space-y-3">
      <Card title="Pitch a price to the owner" icon={IndianRupee}>
        <p className="mb-3 text-xs text-muted-foreground">
          Negotiating with the owner? Log every offer + their reaction so the next rep knows the state of play.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select label="Sharing type" value={forSharing} onChange={(e) => setForSharing(e.target.value as "single" | "double" | "triple")}>
            <option value="triple">Triple</option>
            <option value="double">Double</option>
            <option value="single">Single</option>
          </Select>
          <Input label={`Proposed rent (current ₹${cur ? cur.toLocaleString("en-IN") : "—"})`}
            type="number" value={proposed} onChange={(e) => setProposed(+e.target.value || 0)} />
          <Select label="Owner reaction" value={reaction} onChange={(e) => setReaction(e.target.value as "accepted" | "negotiating" | "declined" | "ghosted")}>
            <option value="accepted">Accepted</option>
            <option value="negotiating">Negotiating</option>
            <option value="declined">Declined</option>
            <option value="ghosted">Ghosted</option>
          </Select>
          <Input label="Follow-up date" type="date" value={followUpISO} onChange={(e) => setFollowUpISO(e.target.value)} />
          <Input label="Next step" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Send revised offer Monday" />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Owner wants 6-month lock-in" />
        </div>
        <button onClick={add}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-smooth">
          <Plus className="h-3.5 w-3.5" /> Log pitch
        </button>
      </Card>

      {rec.pitches.length > 0 && (
        <Card title={`Pitch history · ${rec.pitches.length}`} icon={IndianRupee}>
          <div className="space-y-2">
            {rec.pitches.map((p) => {
              const cur = pg.prices[p.forSharing];
              const delta = cur ? p.proposedRent - cur : 0;
              const reactionStyle =
                p.reaction === "accepted" ? "border-success/40 bg-success/10 text-success"
                : p.reaction === "declined" ? "border-danger/40 bg-danger/10 text-danger"
                : p.reaction === "ghosted" ? "border-border bg-muted text-muted-foreground"
                : "border-warning/40 bg-warning/10 text-[hsl(38_76%_36%)]";
              return (
                <div key={p.id} className="rounded-lg border border-border bg-surface-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-semibold">₹{p.proposedRent.toLocaleString("en-IN")}</span>
                        <span className="text-xs text-muted-foreground">/{p.forSharing}</span>
                        {delta !== 0 && (
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-mono", delta > 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
                            {delta > 0 ? "+" : ""}{delta.toLocaleString("en-IN")} vs current
                          </span>
                        )}
                        <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest", reactionStyle)}>
                          {p.reaction}
                        </span>
                      </div>
                      {p.nextStep && <div className="mt-1 text-xs"><b>Next:</b> {p.nextStep}</div>}
                      {p.notes && <div className="mt-0.5 text-xs text-muted-foreground">{p.notes}</div>}
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                        <span>Logged: {new Date(p.createdAt).toLocaleDateString()}</span>
                        {p.followUpISO && <span>Follow-up: {new Date(p.followUpISO).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <button onClick={() => removePitch(pg.id, p.id)} className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-smooth">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- 5. Checklist ---------- */

function ChecklistEditor({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const completion = checklistCompletion(pg.id);

  return (
    <Card title="Supply onboarding checklist" icon={ListChecks}
      action={<div className="flex items-center gap-2">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
          <div className={cn("h-full transition-smooth", completion >= 80 ? "bg-success" : completion >= 50 ? "bg-warning" : "bg-danger")} style={{ width: `${completion}%` }} />
        </div>
        <span className="font-mono text-xs tabular-nums">{completion}%</span>
      </div>}>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CHECKLIST_ITEMS.map(({ k, l }) => {
          const done = rec.checklist[k];
          return (
            <button key={k} onClick={() => toggleChecklist(pg.id, k)}
              className={cn("flex items-center gap-2 rounded-md border p-2.5 text-left text-sm transition-smooth",
                done ? "border-success/40 bg-success/5 text-foreground" : "border-border bg-surface-1 hover:border-primary/40 hover:bg-surface-2")}>
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-smooth",
                done ? "border-success bg-success text-success-foreground" : "border-border bg-card")}>
                {done && <span className="text-[10px] font-bold leading-none">✓</span>}
              </span>
              <span className={cn("flex-1", done && "line-through opacity-70")}>{l}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- 6. Notes ---------- */

function NotesEditor({ pg }: { pg: PG }) {
  const rec = useSupply(pg.id)!;
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gh_rep_name") ?? "";
  });

  function save() {
    if (!text.trim()) return;
    addNote(pg.id, text, author || undefined);
    if (author && typeof window !== "undefined") window.localStorage.setItem("gh_rep_name", author);
    setText("");
  }

  return (
    <div className="space-y-3">
      <Card title="Add a note" icon={NotebookPen}>
        <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
          <Input label="Your name (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Rep" />
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Note</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
              placeholder="Owner switched WiFi to Airtel. Photos pending."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-smooth resize-none" />
          </label>
        </div>
        <button onClick={save} disabled={!text.trim()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-smooth">
          <Plus className="h-3.5 w-3.5" /> Save note
        </button>
      </Card>

      {rec.notes.length > 0 && (
        <Card title={`Notes · ${rec.notes.length}`} icon={NotebookPen}>
          <div className="space-y-2">
            {rec.notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-surface-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm leading-relaxed">{n.text}</p>
                  <button onClick={() => removeNote(pg.id, n.id)} className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-smooth">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                  {n.author ? `${n.author} · ` : ""}{new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
