import { useMemo, useState } from "react";
import { Search, Phone, MessageCircle, Clock, UserCheck, CalendarDays, Archive, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useIdentityStore } from "@/lib/lead-identity/store";
import type { LifecycleState, UnifiedLead } from "@/lib/lead-identity/types";
import { cn } from "@/lib/utils";

type Bucket = "new" | "old" | "future" | "past";

function bucketFor(l: UnifiedLead): Bucket {
  const now = Date.now();
  const createdAge = now - new Date(l.createdAt).getTime();
  const activityAge = now - new Date(l.lastActivityAt || l.createdAt).getTime();
  const move = l.moveInDate ? new Date(l.moveInDate).getTime() : 0;
  if (["converted", "dropped", "dormant"].includes(l.state)) return "past";
  if (move && move > now + 24 * 60 * 60 * 1000) return "future";
  if (createdAge < 24 * 60 * 60 * 1000 || l.state === "new") return "new";
  if (activityAge > 3 * 24 * 60 * 60 * 1000) return "old";
  return "future";
}

const states: LifecycleState[] = ["new", "contacted", "interested", "visit-scheduled", "visit-done", "converted", "dropped", "dormant"];

export function LeadManagePipPanel() {
  const leads = useIdentityStore((s) => s.leads);
  const activities = useIdentityStore((s) => s.activities);
  const setLifecycleState = useIdentityStore((s) => s.setLifecycleState);
  const logActivity = useIdentityStore((s) => s.logActivity);
  const [bucket, setBucket] = useState<Bucket>("new");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(leads[0]?.id ?? null);
  const [note, setNote] = useState("");

  const filtered = useMemo(() => leads
    .filter((l) => bucketFor(l) === bucket)
    .filter((l) => !q || `${l.name} ${l.phoneRaw} ${l.area} ${l.stage}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)), [leads, bucket, q]);
  const lead = leads.find((l) => l.id === selected) ?? filtered[0];
  const timeline = lead ? activities.filter((a) => a.id === lead.id).slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-background text-foreground p-3 space-y-3 pip-compact">
      <div className="sticky top-0 z-10 -mx-3 -mt-3 px-3 py-2 bg-background/95 backdrop-blur border-b border-border space-y-2">
        <h1 className="font-display text-base font-semibold">PiP Manage Leads</h1>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lead…" className="h-8 pl-7 text-xs" />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(["new", "old", "future", "past"] as Bucket[]).map((b) => (
            <button key={b} onClick={() => setBucket(b)} className={cn("rounded-md border px-1 py-1 text-[10px] capitalize", bucket === b ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>{b}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filtered.slice(0, 8).map((l) => (
          <button key={l.id} onClick={() => setSelected(l.id)} className={cn("text-left rounded-lg border p-2", lead?.id === l.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{l.name}</span>
              <Badge variant="secondary" className="text-[9px] capitalize">{l.state}</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{l.area || "No area"} · {l.budget ? `₹${l.budget.toLocaleString()}` : "No budget"}</div>
          </button>
        ))}
        {filtered.length === 0 && <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground text-center">No {bucket} leads.</div>}
      </div>

      {lead && (
        <section className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div>
            <div className="text-sm font-semibold">{lead.name}</div>
            <div className="text-[11px] text-muted-foreground">{lead.phoneRaw || lead.phoneE164} · {lead.zone || "No zone"}</div>
          </div>
          <div className="flex gap-1 flex-wrap">
            <a href={`tel:${lead.phoneE164 || lead.phoneRaw}`} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs"><Phone className="h-3 w-3" /> Call</a>
            <a href={`https://wa.me/${(lead.phoneE164 || lead.phoneRaw).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs"><MessageCircle className="h-3 w-3" /> WA</a>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {states.map((s) => (
              <button key={s} onClick={() => setLifecycleState(lead.id, s)} className={cn("rounded-md border px-2 py-1 text-[10px]", lead.state === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>{s}</button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add quick note…" className="min-h-16 text-xs" />
          <Button size="sm" className="w-full gap-1" onClick={() => { if (note.trim()) { logActivity(lead.id, "note-added", note.trim()); setNote(""); } }}><PlusCircle className="h-3.5 w-3.5" /> Add note</Button>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Micro timeline</div>
            {timeline.map((a) => <div key={a.id} className="text-[10px] text-muted-foreground flex gap-1"><Clock className="h-3 w-3" /> {a.text}</div>)}
            {timeline.length === 0 && <div className="text-[10px] text-muted-foreground flex gap-1"><Archive className="h-3 w-3" /> No activity yet</div>}
          </div>
        </section>
      )}
      <div className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /><UserCheck className="h-3 w-3" /> Edits sync back to the main dashboard.</div>
    </div>
  );
}
