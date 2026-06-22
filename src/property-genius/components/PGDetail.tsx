// PG detail drawer — 5 tabs: Details, Landmarks, Scripts, Persona, IQ.
// Landmarks tab: 12 nearest with walk-minutes, color-coded.
// Details tab: WhatsApp composer with lead-name personalization → wa.me deep link.

import type { PG, NearbyLandmark } from "@/property-genius/data/types";
import { CopyButton } from "./CopyButton";
import {
  X, Phone, MapPin, Users, Tag, Shield, Utensils, Wifi, Sparkles, Brain,
  ScrollText, IndianRupee, AlertTriangle, Footprints, MessageCircle, ExternalLink, Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { buildWaCard, telLink, waLink } from "@/property-genius/lib/wa";
import { useShortlist } from "@/property-genius/lib/useShortlist";
import { LANDMARKS } from "@/property-genius/data/landmarks";
import { MiniMap } from "./MiniMap";
import { SellTab } from "./SellTab";
import { OwnerPanel } from "./OwnerPanel";
import { PGBookOps } from "./bookos/PGBookOps";
import { ScheduleVisit } from "./ScheduleVisit";
import { Zap, Building, Activity } from "lucide-react";

// Resolve coordinates for a PG's nearbyLandmark by exact-name match in LANDMARKS.
function resolvePins(pg: PG): Array<NearbyLandmark & { lat: number; lng: number }> {
  const byName = new Map<string, { lat: number; lng: number }>();
  for (const l of LANDMARKS) {
    if (l.lat != null && l.lng != null) byName.set(l.n.toLowerCase(), { lat: l.lat, lng: l.lng });
  }
  return [...(pg.nearbyLandmarks ?? [])]
    .map((nl) => {
      const c = byName.get(nl.n.toLowerCase());
      return c ? { ...nl, lat: c.lat, lng: c.lng } : null;
    })
    .filter((x): x is NearbyLandmark & { lat: number; lng: number } => !!x)
    .sort((a, b) => a.d - b.d);
}

interface Props { pg: PG | null; onClose: () => void; }

type Tab = "details" | "ops" | "sell" | "owner" | "landmarks" | "scripts" | "persona" | "iq";

function walkColor(min: number) {
  if (min <= 5) return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
  if (min <= 15) return "text-amber-400 bg-amber-400/10 border-amber-400/30";
  if (min <= 30) return "text-orange-400 bg-orange-400/10 border-orange-400/30";
  return "text-muted-foreground bg-surface-2 border-border";
}

export function PGDetail({ pg, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const pins = useMemo(() => (pg ? resolvePins(pg) : []), [pg]);
  if (!pg) return null;

  const lo = pg.prices.min || pg.prices.triple || pg.prices.double || pg.prices.single || 0;
  const hi = pg.prices.max || pg.prices.single || pg.prices.double || lo;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-up" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-background shadow-card overflow-hidden"
      >
        {/* Fixed header — always visible */}
        <div className="shrink-0">
          <DrawerHeader pg={pg} onClose={onClose} />
        </div>

        {/* Scrollable body — header is fixed above, everything else scrolls including map + tabs */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Inline OSM mini-map — PG pin + 3 closest landmark pins. */}
          {pg.lat && pg.lng && (
            <div className="border-b border-border bg-surface-1 px-4 py-3 sm:px-5">
              <MiniMap pg={pg} pins={pins} />
              {pins[0] && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Nearest: <b className="text-foreground">{pins[0].n}</b>
                  {" "}· {pins[0].d < 1 ? `${Math.round(pins[0].d * 1000)}m` : `${pins[0].d.toFixed(1)}km`}
                  {" "}· {pins[0].w <= 0 ? "<1 min walk" : `${pins[0].w} min walk`}
                </div>
              )}
            </div>
          )}

          {/* Sticky tab strip — stays at the top of the scroll area when scrolling content. */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface-1/95 backdrop-blur overflow-x-auto scrollbar-none">
            {([
              { k: "details", l: "Details", I: Sparkles },
              { k: "ops", l: "Live Ops", I: Activity },
              { k: "sell", l: "Sell Kit", I: Zap },
              { k: "owner", l: "Owner", I: Building },
              { k: "landmarks", l: "Landmarks", I: Footprints },
              { k: "scripts", l: "Scripts", I: ScrollText },
              { k: "persona", l: "Persona", I: Brain },
              { k: "iq", l: "IQ", I: Shield },
            ] as const).map(({ k, l, I }) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-smooth sm:px-4 sm:text-sm",
                  tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {tab === "details" && <DetailsTab pg={pg} lo={lo} hi={hi} />}
            {tab === "ops" && <PGBookOps pg={pg} />}
            {tab === "sell" && <SellTab pg={pg} />}
            {tab === "owner" && <OwnerPanel pg={pg} />}
            {tab === "landmarks" && <LandmarksTab pg={pg} />}
            {tab === "scripts" && <ScriptsTab pg={pg} />}
            {tab === "persona" && <PersonaTab pg={pg} />}
            {tab === "iq" && <IQTab pg={pg} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerHeader({ pg, onClose }: { pg: PG; onClose: () => void }) {
  const { has, toggle } = useShortlist();
  const saved = has(pg.id);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-1 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
          <span className={cn(
            "rounded px-1.5 py-0.5 font-mono",
            pg.iq >= 75 ? "bg-emerald-400/15 text-emerald-400" : pg.iq >= 60 ? "bg-amber-400/15 text-amber-400" : "bg-orange-400/15 text-orange-400"
          )}>IQ {pg.iq}</span>
          <span className="truncate">· {pg.tier} · {pg.gender}</span>
        </div>
        <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold leading-tight">{pg.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{pg.area}{pg.locality && ` · ${pg.locality}`}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => toggle(pg.id)}
          title={saved ? "Remove from shortlist" : "Add to shortlist"}
          className={cn("rounded-md p-2 transition-smooth", saved ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:bg-surface-2")}
        >
          <Star className={cn("h-4 w-4 sm:h-5 sm:w-5", saved && "fill-current")} />
        </button>
        <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, copy }: { icon: typeof Sparkles; title: string; children: React.ReactNode; copy?: string }) {
  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {title}</h3>
        {copy && <CopyButton text={copy} />}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-words text-sm">{value}</div>
      </div>
      {copy && <CopyButton text={value} />}
    </div>
  );
}

function WAComposer({ pg }: { pg: PG }) {
  const [leadName, setLeadName] = useState("");
  const card = useMemo(() => buildWaCard(pg, { leadName: leadName || undefined }), [pg, leadName]);
  const link = waLink(pg.manager.phone, card);
  const tel = telLink(pg.manager.phone);

  return (
    <Section icon={MessageCircle} title="WhatsApp Composer" copy={card}>
      <input
        value={leadName}
        onChange={(e) => setLeadName(e.target.value)}
        placeholder="Lead's name (e.g. Kruthika) — auto-personalises"
        className="mb-3 w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/60"
      />
      <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-xs leading-relaxed">{card}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={link} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
          <MessageCircle className="h-3.5 w-3.5" /> Send via WhatsApp
        </a>
        {tel && (
          <a href={tel} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40">
            <Phone className="h-3.5 w-3.5" /> Call manager
          </a>
        )}
        {pg.mapsLink && (
          <a href={pg.mapsLink} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:border-primary/40">
            <ExternalLink className="h-3.5 w-3.5" /> Maps
          </a>
        )}
      </div>
    </Section>
  );
}

function DetailsTab({ pg, lo, hi }: { pg: PG; lo: number; hi: number }) {
  const offered = [
    { l: "Triple", v: pg.prices.triple },
    { l: "Double", v: pg.prices.double },
    { l: "Single", v: pg.prices.single },
  ].filter((p) => p.v > 0);

  return (
    <>
      <Section icon={IndianRupee} title="Pricing">
        {offered.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {offered.map((p) => (
              <div key={p.l} className="rounded-md bg-surface-2 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.l}</div>
                <div className="mt-1 font-mono text-base tabular-nums">₹{p.v.toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-3 rounded-md bg-amber-400/10 p-3 text-xs text-amber-300">
            Custom pricing — call manager.
          </div>
        )}
        {offered.length > 0 && lo > 0 && (
          <Field label="Range" value={`₹${lo.toLocaleString("en-IN")} – ₹${hi.toLocaleString("en-IN")}`} />
        )}
        <Field label="Rooms Offered" value={pg.rooms} copy={false} />
        <Field label="Deposit" value={pg.deposit} />
        <Field label="Min Stay" value={pg.minStay} />
      </Section>

      <ScheduleVisit pg={pg} />

      <WAComposer pg={pg} />

      <Section icon={Phone} title="Contacts">
        <Field label="Manager" value={pg.manager.name} />
        <Field label="Manager Phone" value={pg.manager.phone} />
        <Field label="Owner" value={pg.owner.name} />
        <Field label="Owner Phone" value={pg.owner.phone} />
        <Field label="Group" value={pg.groupName} />
        <Field label="Maps" value={pg.mapsLink} />
      </Section>

      <Section icon={Sparkles} title="USP" copy={pg.usp}>
        <p className="text-sm leading-relaxed">{pg.usp || "—"}</p>
      </Section>

      <Section icon={Wifi} title="Amenities">
        <div className="flex flex-wrap gap-1.5">
          {pg.amenities.map((a, i) => <span key={i} className="rounded-md bg-surface-2 px-2 py-1 text-xs">{a}</span>)}
        </div>
      </Section>

      <Section icon={Shield} title="Safety">
        <div className="flex flex-wrap gap-1.5">
          {pg.safety.map((a, i) => <span key={i} className="rounded-md bg-rose-400/10 px-2 py-1 text-xs text-rose-400">{a}</span>)}
        </div>
      </Section>

      <Section icon={Utensils} title="Food & Living">
        <Field label="Food Type" value={pg.foodType} />
        <Field label="Meals Included" value={pg.mealsIncluded} />
        <Field label="Utilities" value={pg.utilities} />
        <Field label="Cleaning" value={pg.cleaning} />
        <Field label="Furnishing" value={pg.furnishing} />
        <Field label="Vibe" value={pg.vibe} />
      </Section>

      {pg.lows && (
        <Section icon={AlertTriangle} title="LOWS — Don't Disclose" copy={pg.lows}>
          <p className="rounded bg-rose-400/10 p-3 text-xs text-rose-300 leading-relaxed">{pg.lows}</p>
        </Section>
      )}
    </>
  );
}

function LandmarksTab({ pg }: { pg: PG }) {
  const sorted = [...(pg.nearbyLandmarks ?? [])].sort((a, b) => a.w - b.w);

  if (!sorted.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No nearby landmarks recorded for this property.
      </div>
    );
  }

  // Group by walk band
  const bands = [
    { label: "≤ 5 min walk — same block", items: sorted.filter((l) => l.w <= 5), accent: "emerald" },
    { label: "6–15 min walk — easy access", items: sorted.filter((l) => l.w > 5 && l.w <= 15), accent: "amber" },
    { label: "16–30 min walk — short ride", items: sorted.filter((l) => l.w > 15 && l.w <= 30), accent: "orange" },
    { label: "30+ min — auto/cab", items: sorted.filter((l) => l.w > 30), accent: "muted" },
  ].filter((b) => b.items.length > 0);

  return (
    <>
      <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="font-display font-semibold text-primary">The metres-not-kilometres play</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sorted.length} landmarks computed via GPS. Lead is from <b>{sorted[0].n}</b>?
          That's <b className="text-foreground">{sorted[0].w <= 0 ? "less than a minute" : `a ${sorted[0].w}-minute walk`}</b> — say it loud, win the call.
        </p>
      </div>

      {bands.map((band) => (
        <Section key={band.label} icon={Footprints} title={band.label}>
          <div className="space-y-1.5">
            {band.items.map((l, i) => (
              <div key={`${l.n}-${i}`} className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-2", walkColor(l.w))}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{l.n}</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70">{l.t}</div>
                </div>
                <div className="text-right shrink-0 font-mono text-xs tabular-nums">
                  <div>{l.d < 1 ? `${Math.round(l.d * 1000)}m` : `${l.d.toFixed(1)}km`}</div>
                  <div className="opacity-70">{l.w <= 0 ? "<1 min" : `${l.w} min`}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

function ScriptBlock({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold">{title}</h4>
        <CopyButton text={copy} label="Copy" />
      </div>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}

function ScriptsTab({ pg }: { pg: PG }) {
  const s = pg.scripts;
  const c1Text = `${s.call1.opening}\n\nQUALIFY:\n${s.call1.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nHOOK: ${s.call1.hook}\n\nCLOSE: ${s.call1.close}`;
  const c2Text = s.call2.objections.map((o) => `OBJ: ${o.obj}\nRESP: ${o.resp}`).join("\n\n");
  const pText = `LOCATION: ${s.pitch.location}\n\nLIFESTYLE: ${s.pitch.lifestyle}\n\nPRICE: ${s.pitch.priceClose}\n\nCLOSE: ${s.pitch.closeQuestion}`;
  const mText = `BREAKDOWN:\n${s.money.breakdown.join("\n")}\n\nPAY LATER: ${s.money.payLater}\n\nDEPOSIT OBJ: ${s.money.depositObjection}\n\nCHECKLIST:\n${s.money.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

  return (
    <>
      <ScriptBlock title="① First Call — Qualify & Book Visit" copy={c1Text}>
        <Labeled label="Goal">{s.call1.goal}</Labeled>
        <Labeled label="Opening" copy={s.call1.opening}>{s.call1.opening}</Labeled>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Qualifying Questions</div>
          <ol className="list-decimal space-y-1 pl-5">
            {s.call1.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>
        <Labeled label="Hook" copy={s.call1.hook}>{s.call1.hook}</Labeled>
        <Labeled label="Close" copy={s.call1.close}>{s.call1.close}</Labeled>
      </ScriptBlock>

      <ScriptBlock title="② Second Call — Convert to Token" copy={c2Text}>
        <Labeled label="Goal">{s.call2.goal}</Labeled>
        <div className="space-y-2">
          {s.call2.objections.map((o, i) => (
            <div key={i} className="rounded-md border border-border bg-surface-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-rose-400">"{o.obj}"</div>
                <CopyButton text={o.resp} />
              </div>
              <div className="mt-1.5 text-sm leading-relaxed">{o.resp}</div>
            </div>
          ))}
        </div>
      </ScriptBlock>

      <ScriptBlock title="③ The Pitch" copy={pText}>
        <Labeled label="Location" copy={s.pitch.location}>{s.pitch.location}</Labeled>
        <Labeled label="Lifestyle" copy={s.pitch.lifestyle}>{s.pitch.lifestyle}</Labeled>
        <Labeled label="Price Close" copy={s.pitch.priceClose}>{s.pitch.priceClose}</Labeled>
        <Labeled label="Close Question" copy={s.pitch.closeQuestion}>{s.pitch.closeQuestion}</Labeled>
      </ScriptBlock>

      <ScriptBlock title="④ Collect Money — Don't Reject Anyone" copy={mText}>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Breakdown</div>
          <ul className="space-y-1 font-mono text-sm">
            {s.money.breakdown.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
        <Labeled label={`"I'll pay later" →`} copy={s.money.payLater}>{s.money.payLater}</Labeled>
        <Labeled label="Deposit objection" copy={s.money.depositObjection}>{s.money.depositObjection}</Labeled>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Post-payment checklist</div>
          <ul className="space-y-1">
            {s.money.checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-border" />{c}
              </li>
            ))}
          </ul>
        </div>
      </ScriptBlock>
    </>
  );
}

function Labeled({ label, children, copy }: { label: string; children: React.ReactNode; copy?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        {copy && <CopyButton text={copy} />}
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function PersonaTab({ pg }: { pg: PG }) {
  const p = pg.persona;
  return (
    <>
      <div className="mb-5 rounded-lg border border-primary/40 bg-primary/5 p-5">
        <div className="text-[10px] uppercase tracking-widest text-primary">Primary Customer</div>
        <h3 className="mt-1 font-display text-2xl font-bold">{p.archetype}</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Age</div><div>{p.ageRange}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Salary</div><div>{p.salary}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Decision</div><div>{p.decisionMaker}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Conversion</div><div className="text-emerald-400">{p.conversionProbability}</div></div>
        </div>
      </div>

      <Section icon={Tag} title="Likely Companies (lead source)">
        <p className="text-sm leading-relaxed">{p.likelyCompanies}</p>
      </Section>

      <Section icon={AlertTriangle} title="Pain Points">
        <ul className="space-y-1.5 text-sm">{p.painPoints.map((x, i) => <li key={i} className="flex gap-2"><span className="text-rose-400">•</span>{x}</li>)}</ul>
      </Section>

      <Section icon={Sparkles} title="Pitch Angle">
        <ul className="space-y-1.5 text-sm">{p.pitchAngle.map((x, i) => <li key={i} className="flex gap-2"><span className="text-emerald-400">→</span>{x}</li>)}</ul>
      </Section>

      <Section icon={ScrollText} title="Qualifying Questions">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">{p.qualifyingQuestions.map((x, i) => <li key={i}>{x}</li>)}</ol>
      </Section>

      <Section icon={X} title="Do NOT do">
        <ul className="space-y-1.5 text-sm">{p.doNot.map((x, i) => <li key={i} className="flex gap-2"><span className="text-rose-400">✗</span>{x}</li>)}</ul>
      </Section>
    </>
  );
}

function IQTab({ pg }: { pg: PG }) {
  const entries = Object.entries(pg.iqBreakdown);
  const max = entries.reduce((a, [, v]) => a + v.max, 0);
  return (
    <>
      <div className="mb-5 rounded-lg border border-border bg-card p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Property IQ Score</div>
        <div className="mt-1 flex items-end gap-3">
          <div className="font-mono text-5xl font-bold tabular-nums">{pg.iq}</div>
          <div className="mb-1 text-sm text-muted-foreground">/ 100</div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-iq" style={{ width: `${pg.iq}%` }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Out of {max} possible signal points across {entries.length} criteria.</div>
      </div>

      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold", v.ok ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/10 text-rose-400")}>
                {v.ok ? "✓" : "✗"}
              </span>
              <span className="text-sm">{k}</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{v.earned}/{v.max}</span>
          </div>
        ))}
      </div>
    </>
  );
}
