// Schedule a visit directly on any property. Drops into PGDetail.
import { useState, useMemo } from "react";
import type { PG } from "@/property-genius/data/types";
import { scheduleVisit, visitsForPG, useVisits } from "@/property-genius/lib/visits";
import { ownerCodeForPG } from "@/property-genius/lib/roles";
import { fmtINR } from "@/property-genius/lib/bookos-shim";
import { CalendarPlus, Phone, User, IndianRupee, MessageCircle, CheckCircle2, Clock } from "lucide-react";
import { waLink } from "@/property-genius/lib/wa";
import { PGContactCard } from "./PGContactCard";

function nextSlots(n = 6): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 2);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setHours(d.getHours() + i * 3);
    out.push(d.toISOString());
  }
  return out;
}

export function ScheduleVisit({ pg }: { pg: PG }) {
  useVisits();
  const visits = visitsForPG(pg.id);
  const upcoming = visits.filter((v) => v.status === "Scheduled" || v.status === "Confirmed").slice(0, 4);

  const ownerCode = useMemo(() => ownerCodeForPG(pg.id), [pg.id]);
  const slots = useMemo(() => nextSlots(), []);
  const [form, setForm] = useState({
    leadName: "", phone: "",
    slot: slots[0],
    occupancy: "Double" as "Single" | "Double" | "Triple",
    budget: pg.prices.double || pg.prices.min || 15000,
    source: "Closer",
  });
  const [done, setDone] = useState<string | null>(null);

  const price = pg.prices[form.occupancy.toLowerCase() as "single" | "double" | "triple"] || pg.prices.min;

  // Sanjay-style priority deal script
  const dealMsg = `Hi ${form.leadName || "{name}"}, I can keep the rent at ₹${(price || 15000).toLocaleString("en-IN")}/mo at ${pg.name} — and I'll ensure you get a ground-floor room + priority move-in slot. Fair?\n\nYour visit is locked for ${new Date(form.slot).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.\nManager: ${pg.manager?.name || ""} ${pg.manager?.phone || ""}\nMaps: ${pg.mapsLink || ""}`;

  const submit = () => {
    if (!form.leadName || !form.phone) return;
    const v = scheduleVisit({
      pgId: pg.id, ownerCode,
      leadName: form.leadName, phone: form.phone,
      slot: form.slot,
      occupancy: form.occupancy,
      budget: form.budget,
      source: form.source,
      notes: `Priority offer locked at ${fmtINR(price || form.budget)}/mo`,
    });
    setDone(v.id);
    setForm({ ...form, leadName: "", phone: "" });
  };

  return (
    <>
    <PGContactCard pg={pg} slotISO={form.slot} leadName={form.leadName} />
    <section className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarPlus className="h-4 w-4 text-primary" /> Schedule a Visit
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">Owner · {ownerCode}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field icon={<User className="h-3.5 w-3.5" />} label="Lead name" v={form.leadName} on={(v) => setForm({ ...form, leadName: v })} />
        <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <Lbl>Slot</Lbl>
          <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-2 text-xs">
            {slots.map((s) => (
              <option key={s} value={s}>{new Date(s).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true })}</option>
            ))}
          </select>
        </div>
        <div>
          <Lbl>Occupancy</Lbl>
          <select value={form.occupancy} onChange={(e) => setForm({ ...form, occupancy: e.target.value as "Single" | "Double" | "Triple" })}
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-2 py-2 text-xs">
            {["Single", "Double", "Triple"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <Field icon={<IndianRupee className="h-3.5 w-3.5" />} label="Budget" v={String(form.budget)} on={(v) => setForm({ ...form, budget: +v || 0 })} type="number" />
      </div>

      {/* Sanjay-style priority offer preview */}
      <div className="mt-3 rounded-md border border-border bg-card p-3">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Priority Offer Script</div>
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">{dealMsg}</pre>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
          <CheckCircle2 className="h-3.5 w-3.5" /> Lock Visit
        </button>
        {form.phone && (
          <a href={waLink(form.phone, dealMsg)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40">
            <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
          </a>
        )}
        {done && <span className="self-center text-[11px] text-success">Visit locked ✓</span>}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Upcoming visits at this PG</div>
          {upcoming.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md bg-surface-2 px-2 py-1.5 text-[11px]">
              <span className="truncate"><b>{v.leadName}</b> · {v.phone}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{new Date(v.slot).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </section>
    </>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</div>;
}
function Field({ label, v, on, icon, type = "text" }: { label: string; v: string; on: (x: string) => void; icon?: React.ReactNode; type?: string }) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <div className="mt-1 flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-2">
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        <input value={v} onChange={(e) => on(e.target.value)} type={type} className="w-full bg-transparent text-xs outline-none" />
      </div>
    </div>
  );
}
