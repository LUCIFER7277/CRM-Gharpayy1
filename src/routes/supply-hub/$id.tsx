import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { PGS } from "@/supply-hub/data/pgs";
import {
  personaBadge, personaStyle, scarcity, freshness, valueScore,
  perDay, perDayLabel, commuteEstimate, areaMood, findAlternatives, budgetStretch,
  seasonalNudge, type Objection,
} from "@/supply-hub/lib/intel";
import { buildBrochure, buildParentPack, buildThreeOptions, buildWalkthrough, buildReengagement } from "@/supply-hub/lib/messages";
import { buildWaCard, waLink, telLink } from "@/supply-hub/lib/wa";
import { ArrowLeft, Copy, Phone, MessageCircle, Flame, BadgeCheck, MapPin, Coins, Calendar, Sparkles, Users, Utensils, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supply-hub/$id")({
  head: () => ({ meta: [{ title: "PG Detail - Supply Hub" }] }),
  component: SupplyHubDetail,
});

const OBJECTIONS: { key: Objection; label: string }[] = [
  { key: "expensive", label: "Too expensive" },
  { key: "far", label: "Too far" },
  { key: "no_gym", label: "No gym" },
  { key: "no_meals", label: "No meals" },
  { key: "no_ac", label: "No AC" },
  { key: "wrong_food", label: "Wrong food type" },
];

function SupplyHubDetail() {
  const { role } = useApp();
  const navigate = useNavigate();
  useEffect(() => { if (role === "owner") navigate({ to: "/property-owner/inventory" }); }, [role, navigate]);
  const { id } = useParams({ from: "/supply-hub/$id" });
  const pg = useMemo(() => PGS.find((p) => p.id === id), [id]);

  const [obj, setObj] = useState<Objection>("expensive");
  const [tab, setTab] = useState<"intel" | "wa" | "scripts" | "alternatives">("intel");

  if (role === "owner") return null;

  if (!pg) {
    return (
      <AppShell>
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="font-semibold text-lg">PG not found</h2>
          <Link to="/supply-hub" className="mt-3 inline-flex items-center gap-1 text-accent text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Supply Hub
          </Link>
        </div>
      </AppShell>
    );
  }

  const sc = scarcity(pg);
  const persona = personaBadge(pg);
  const ps = personaStyle(persona);
  const fr = freshness(pg);
  const value = valueScore(pg);
  const mood = areaMood(pg.area);
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
  const nearestKm = pg.nearbyLandmarks?.[0]?.d ?? null;
  const commute = nearestKm !== null ? commuteEstimate(nearestKm) : null;
  const alts = findAlternatives(pg, obj, PGS);
  const stretch = budgetStretch(cheap < 99999 ? cheap : 18000, PGS, pg.gender);

  const waCard = buildWaCard(pg);
  const brochure = buildBrochure(pg);
  const parentPack = buildParentPack(pg);
  const reengage = buildReengagement(pg, "got_price");

  return (
    <AppShell>
      <div className="space-y-5">
        <Link to="/supply-hub" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
          <ArrowLeft className="h-4 w-4" /> Supply Hub
        </Link>

        {/* Header card */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pg.area} · {pg.tier} · {pg.gender}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold">{pg.name}</h1>
              <div className="text-sm text-muted-foreground">{pg.locality}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", ps.color)}>
                  <BadgeCheck className="h-3 w-3" /> {persona}
                </span>
                {sc.hot && <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-400/10 text-rose-300 px-2 py-0.5 text-xs font-semibold"><Flame className="h-3 w-3" />{sc.level}</span>}
                {!sc.hot && sc.level !== "AVAILABLE" && <span className="rounded-md border border-amber-400/40 bg-amber-400/10 text-amber-300 px-2 py-0.5 text-xs">{sc.level}</span>}
                {fr.isFresh && fr.changeKind && <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 px-2 py-0.5 text-xs">{fr.changeKind} · {fr.daysAgo}d ago</span>}
                <span className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs">IQ {pg.iq}/100</span>
                <span className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs">Value {value}</span>
              </div>
              <div className="mt-3 text-xs italic text-muted-foreground">{ps.pitch}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting</div>
              <div className="font-display text-3xl font-semibold">{cheap < 99999 ? `₹${(cheap / 1000).toFixed(1)}k` : "-"}</div>
              {cheap < 99999 && <div className="text-xs text-muted-foreground">{perDayLabel(cheap)} · all inclusive</div>}
              <div className="mt-3 flex justify-end gap-2">
                {pg.manager.phone && telLink(pg.manager.phone) && (
                  <a href={telLink(pg.manager.phone)!} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted">
                    <Phone className="h-3 w-3" /> Call
                  </a>
                )}
                <a href={waLink(pg.manager.phone, waCard)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1.5 text-xs text-accent-foreground hover:opacity-90">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Scarcity reason:</span> {sc.reason}
            {fr.isFresh && fr.message && (<><br /><span className="font-semibold text-foreground">Re-engage:</span> {fr.message}</>)}
            <br /><span className="font-semibold text-foreground">Season:</span> {seasonalNudge()}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["intel", "wa", "scripts", "alternatives"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "intel" && "Property Intel"}
              {t === "wa" && "WhatsApp Cards"}
              {t === "scripts" && "Pitch & Scripts"}
              {t === "alternatives" && "Alternatives & Stretch"}
            </button>
          ))}
        </div>

        {tab === "intel" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pricing */}
            <Card title="Pricing" icon={Coins}>
              <div className="space-y-1.5 text-sm">
                {pg.prices.single > 0 && <Row label="Single" value={`₹${pg.prices.single.toLocaleString("en-IN")}/mo`} sub={`₹${perDay(pg.prices.single)}/day`} />}
                {pg.prices.double > 0 && <Row label="Double" value={`₹${pg.prices.double.toLocaleString("en-IN")}/mo`} sub={`₹${perDay(pg.prices.double)}/day`} />}
                {pg.prices.triple > 0 && <Row label="Triple" value={`₹${pg.prices.triple.toLocaleString("en-IN")}/mo`} sub={`₹${perDay(pg.prices.triple)}/day`} />}
                <Row label="Deposit" value={pg.deposit || "-"} />
                <Row label="Min stay" value={pg.minStay || "-"} />
              </div>
            </Card>

            {/* Scarcity per bed */}
            <Card title="Scarcity per bed" icon={Flame} accent={sc.hot}>
              <div className="space-y-2 text-sm">
                <BedRow label="Single" left={sc.perBed.single} />
                <BedRow label="Double" left={sc.perBed.double} />
                <BedRow label="Triple" left={sc.perBed.triple} />
                <div className="text-xs text-muted-foreground italic pt-1">{sc.reason}</div>
              </div>
            </Card>

            {/* Commute */}
            <Card title="Commute reality" icon={MapPin}>
              {commute ? (
                <div className="space-y-1 text-sm">
                  <Row label="Distance" value={`${commute.km} km`} />
                  <Row label="Walk" value={`${commute.walkMins} min`} />
                  <Row label="Auto (normal)" value={`${commute.autoMins} min`} />
                  <Row label="Auto (peak)" value={`${commute.peakMins} min`} />
                  <div className="text-xs text-accent pt-1">{commute.oneLiner}</div>
                </div>
              ) : <div className="text-sm text-muted-foreground">No coordinates available.</div>}
            </Card>

            {/* Amenities & Safety */}
            <Card title="Amenities & Safety" icon={ShieldCheck}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 mb-1">Amenities</div>
              <div className="flex flex-wrap gap-1">
                {pg.amenities.map((a) => <span key={a} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[11px]">{a}</span>)}
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1">Safety</div>
              <div className="flex flex-wrap gap-1">
                {pg.safety.length ? pg.safety.map((s) => <span key={s} className="rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-1.5 py-0.5 text-[11px]">{s}</span>) : <span className="text-xs text-muted-foreground">Not disclosed</span>}
              </div>
            </Card>

            {/* Food */}
            <Card title="Food & Vibe" icon={Utensils}>
              <div className="space-y-1 text-sm">
                <Row label="Food type" value={pg.foodType || "-"} />
                <Row label="Meals" value={pg.mealsIncluded || "-"} />
                <Row label="Cleaning" value={pg.cleaning || "-"} />
                <Row label="Noise" value={pg.noise || "-"} />
                <Row label="Vibe" value={pg.vibe || "-"} />
              </div>
            </Card>

            {/* Area mood */}
            <Card title={`Area mood - ${pg.area}`} icon={Users}>
              {mood ? (
                <div className="space-y-1 text-sm">
                  <Row label="Crowd" value={mood.crowd} />
                  <Row label="Age" value={mood.ageBand} />
                  <Row label="Nightlife" value={mood.nightlife} />
                  <Row label="Noise" value={mood.noise} />
                  <Row label="Weekend" value={mood.weekend} />
                  <Row label="Top companies" value={mood.topCompanies.slice(0, 4).join(", ")} />
                </div>
              ) : <div className="text-sm text-muted-foreground">No area intel.</div>}
            </Card>

            {/* Nearby landmarks */}
            <Card title="Nearby landmarks" icon={MapPin}>
              <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {pg.nearbyLandmarks.slice(0, 12).map((lm, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium">{lm.n}</div>
                      <div className="text-muted-foreground">{lm.t}</div>
                    </div>
                    <div className="text-right">
                      <div>{lm.d < 1 ? `${Math.round(lm.d * 1000)}m` : `${lm.d}km`}</div>
                      <div className="text-muted-foreground">{lm.w <= 0 ? "<1 min walk" : `${lm.w} min walk`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* IQ breakdown */}
            <Card title={`Quality IQ · ${pg.iq}/100`} icon={BadgeCheck}>
              <div className="max-h-64 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                {Object.entries(pg.iqBreakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span>{k}</span>
                    <span className={cn("font-mono", v.ok ? "text-emerald-400" : "text-muted-foreground/60")}>
                      {v.earned}/{v.max}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Persona-buyer */}
            <Card title="Buyer persona" icon={Sparkles}>
              <div className="space-y-1 text-sm">
                <Row label="Archetype" value={pg.persona.archetype} />
                <Row label="Age" value={pg.persona.ageRange} />
                <Row label="Salary" value={pg.persona.salary} />
                <Row label="Companies" value={pg.persona.likelyCompanies} />
                <Row label="Decision maker" value={pg.persona.decisionMaker} />
                <Row label="Conversion" value={pg.persona.conversionProbability} />
              </div>
              {pg.persona.painPoints?.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1">Pain points</div>
                  <ul className="text-xs list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {pg.persona.painPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </>
              )}
            </Card>
          </div>
        )}

        {tab === "wa" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MessageCard title="WhatsApp card" body={waCard} pgPhone={pg.manager.phone} />
            <MessageCard title="Full brochure" body={brochure} pgPhone={pg.manager.phone} />
            {pg.gender === "Girls" && <MessageCard title="Parent safety pack" body={parentPack} pgPhone={pg.manager.phone} />}
            <MessageCard title="Re-engagement (got price)" body={reengage} pgPhone={pg.manager.phone} />
          </div>
        )}

        {tab === "scripts" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Call 1 - discovery" icon={Phone}>
              <div className="space-y-2 text-sm">
                <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Goal</span><div>{pg.scripts.call1.goal}</div></div>
                <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Opening</span><div className="italic">"{pg.scripts.call1.opening}"</div></div>
                <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Hook</span><div className="italic">"{pg.scripts.call1.hook}"</div></div>
                <div><span className="text-xs uppercase tracking-wider text-muted-foreground">Close</span><div className="italic">"{pg.scripts.call1.close}"</div></div>
              </div>
            </Card>
            <Card title="Call 2 - objections" icon={MessageCircle}>
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground">{pg.scripts.call2.goal}</div>
                {pg.scripts.call2.objections.slice(0, 6).map((o, i) => (
                  <div key={i} className="rounded border border-border bg-muted/20 p-2">
                    <div className="text-xs font-semibold text-rose-300">"{o.obj}"</div>
                    <div className="text-xs mt-1">{o.resp}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Pitch script" icon={Sparkles}>
              <div className="space-y-2 text-sm">
                <Row label="Location" value={pg.scripts.pitch.location} />
                <Row label="Lifestyle" value={pg.scripts.pitch.lifestyle} />
                <Row label="Price close" value={pg.scripts.pitch.priceClose} />
                <Row label="Close question" value={pg.scripts.pitch.closeQuestion} />
              </div>
            </Card>
            <Card title="Money script" icon={Coins}>
              <div className="space-y-1 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Breakdown</div>
                <ul className="list-disc pl-4 text-xs space-y-0.5">{pg.scripts.money.breakdown.map((b, i) => <li key={i}>{b}</li>)}</ul>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Pay later</div>
                <div className="text-xs">{pg.scripts.money.payLater}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Deposit objection</div>
                <div className="text-xs">{pg.scripts.money.depositObjection}</div>
              </div>
            </Card>
            <Card title="90-second walkthrough" icon={Calendar}>
              <pre className="text-xs whitespace-pre-wrap font-sans">{buildWalkthrough(pg)}</pre>
            </Card>
          </div>
        )}

        {tab === "alternatives" && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="text-sm font-semibold">If lead objects:</div>
                {OBJECTIONS.map((o) => (
                  <button key={o.key} onClick={() => setObj(o.key)} className={cn("rounded-md border px-2 py-1 text-xs", obj === o.key ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {alts.length === 0 && <div className="text-sm text-muted-foreground">No alternatives in this area.</div>}
                {alts.map((alt) => <AltTile key={alt.id} pg={alt} />)}
              </div>
              {alts.length > 0 && (
                <div className="mt-3">
                  <CopyBtn label="Copy 3-options WhatsApp message" text={buildThreeOptions(alts, { gender: pg.gender })} />
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">Budget stretch - what +₹2k / +₹5k unlocks</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stretch.map((s) => (
                  <div key={s.budget} className="rounded-lg border bg-card p-4">
                    <div className="font-display text-lg font-semibold">₹{(s.budget / 1000).toFixed(0)}k <span className="text-xs text-muted-foreground">+ ₹{s.perDayDelta}/day</span></div>
                    <div className="text-xs text-muted-foreground mt-1 mb-2">Unlocks:</div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {s.unlocks.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                    <div className="mt-2 text-[10px] text-muted-foreground">{s.pgs.length} options at this tier</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Card({ title, icon: Icon, children, accent }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", accent && "border-accent/40")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}{sub && <span className="text-[10px] text-muted-foreground ml-1">({sub})</span>}</span>
    </div>
  );
}

function BedRow({ label, left }: { label: string; left: number | null }) {
  if (left === null) return <Row label={label} value={<span className="text-muted-foreground/60">Not offered</span>} />;
  const tone = left === 0 ? "text-rose-400" : left <= 2 ? "text-amber-300" : "text-emerald-400";
  return <Row label={label} value={<span className={tone}>{left === 0 ? "Full" : `${left} left`}</span>} />;
}

function AltTile({ pg }: { pg: typeof PGS[number] }) {
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
  return (
    <Link to="/supply-hub/$id" params={{ id: pg.id }} className="block rounded-lg border bg-card p-3 hover:border-accent/50">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pg.area} · {pg.tier}</div>
      <div className="font-semibold text-sm mt-0.5 truncate">{pg.name}</div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">IQ {pg.iq}</span>
        <span className="font-semibold">{cheap < 99999 ? `₹${(cheap / 1000).toFixed(0)}k` : "-"}</span>
      </div>
    </Link>
  );
}

function MessageCard({ title, body, pgPhone }: { title: string; body: string; pgPhone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
        <div className="flex gap-1.5">
          <CopyBtn label="Copy" text={body} />
          <a href={waLink(pgPhone, body)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground hover:opacity-90">
            <MessageCircle className="h-3 w-3" /> Send
          </a>
        </div>
      </div>
      <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/20 rounded p-3 max-h-96 overflow-y-auto scrollbar-thin">{body}</pre>
    </div>
  );
}

function CopyBtn({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
    >
      <Copy className="h-3 w-3" /> {copied ? "Copied" : label}
    </button>
  );
}
