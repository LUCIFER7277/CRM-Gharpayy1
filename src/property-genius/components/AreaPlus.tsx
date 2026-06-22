// Area Mood Board (#10) + Dual-Person Matcher (#11).
// Standalone module surfaced as a new tab in Area Intel.

import { useMemo, useState } from "react";
import type { PG, Gender } from "@/property-genius/data/types";
import { PGS } from "@/property-genius/data/pgs";
import { LANDMARKS } from "@/property-genius/data/landmarks";
import { AREA_CENTROID } from "@/property-genius/data/areas";
import {
  Coffee, Music, Volume2, Train, Briefcase, Users, Search, MapPin, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { areaMood, perDay } from "@/property-genius/lib/intel";
import { CopyButton } from "./CopyButton";

function hav(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180, dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function resolve(name: string) {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  const lm = LANDMARKS.find((l) => l.lat && l.lng && l.n.toLowerCase().includes(n));
  if (lm?.lat && lm?.lng) return { lat: lm.lat, lng: lm.lng, label: lm.n };
  for (const [k, v] of Object.entries(AREA_CENTROID)) {
    if (k.toLowerCase().includes(n) || n.includes(k.toLowerCase())) return { ...v, label: k };
  }
  return null;
}

export function AreaMoodCard({ area }: { area: string }) {
  const mood = useMemo(() => areaMood(area), [area]);
  if (!mood) return null;

  const shareText = [
    `*${mood.area}* — area vibe at a glance`,
    "",
    `👥 Crowd: ${mood.crowd}`,
    `📅 Age: ${mood.ageBand}`,
    `🎵 Nightlife: ${mood.nightlife}`,
    `🔊 Noise: ${mood.noise}`,
    `🚇 Metro: ${mood.metroAccess}`,
    `💰 Price band: ${mood.priceBand}`,
    `💼 Top employers: ${mood.topCompanies.join(", ")}`,
    "",
    `Weekend: ${mood.weekend}`,
    "",
    "— Gharpayy",
  ].join("\n");

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-primary">Mood Board</div>
          <h3 className="mt-1 font-display text-lg font-bold">{mood.area}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{mood.weekend}</p>
        </div>
        <CopyButton text={shareText} label="Forward" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MoodChip icon={Users} label="Crowd" value={mood.crowd} />
        <MoodChip icon={Coffee} label="Age band" value={mood.ageBand} />
        <MoodChip icon={Music} label="Nightlife" value={mood.nightlife} accent={mood.nightlife === "High" ? "text-fuchsia-300" : mood.nightlife === "Medium" ? "text-amber-300" : "text-emerald-300"} />
        <MoodChip icon={Volume2} label="Noise" value={mood.noise} accent={mood.noise === "Buzzing" ? "text-rose-300" : mood.noise === "Active" ? "text-amber-300" : "text-emerald-300"} />
        <MoodChip icon={Train} label="Metro" value={mood.metroAccess.split("·")[0].trim()} />
        <MoodChip icon={Briefcase} label="Price band" value={mood.priceBand} />
      </div>

      {mood.topCompanies.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Lead source — top employers here</div>
          <div className="flex flex-wrap gap-1.5">
            {mood.topCompanies.map((c) => <span key={c} className="rounded-md bg-violet-400/10 px-2 py-1 text-xs text-violet-300">{c}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function MoodChip({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md bg-surface-2 p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("mt-1 text-xs font-semibold leading-tight", accent)}>{value}</div>
    </div>
  );
}

/* ============== Dual-Person Matcher (#11) ============== */

export function DualMatcher({ onOpen }: { onOpen: (pg: PG) => void }) {
  const [office1, setOffice1] = useState("Goldman Sachs");
  const [office2, setOffice2] = useState("Manyata Tech Park");
  const [budget, setBudget] = useState(18000);
  const [gender, setGender] = useState<Gender | "Any">("Any");

  const o1 = useMemo(() => resolve(office1), [office1]);
  const o2 = useMemo(() => resolve(office2), [office2]);

  const picks = useMemo(() => {
    if (!o1 || !o2) return [];
    return PGS
      .filter((p) => gender === "Any" || p.gender === gender || p.gender === "Co-live")
      .filter((p) => p.lat && p.lng)
      .map((p) => {
        const beds = [p.prices.triple, p.prices.double, p.prices.single].filter((x) => x > 0);
        const cheap = beds.length ? Math.min(...beds) : 99999;
        if (cheap > budget * 1.15) return null;
        const k1 = hav(o1.lat, o1.lng, p.lat!, p.lng!);
        const k2 = hav(o2.lat, o2.lng, p.lat!, p.lng!);
        const worst = Math.max(k1, k2);
        if (worst > 15) return null;
        // Score: lower of two = better; balance both
        const score = 100 - worst * 4 - Math.abs(k1 - k2) * 2 + (p.iq / 4);
        return { pg: p, k1, k2, worst, cheap, score };
      })
      .filter((x): x is { pg: PG; k1: number; k2: number; worst: number; cheap: number; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [o1, o2, budget, gender]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <div className="text-[10px] uppercase tracking-widest text-primary">Dual-Person Match · #11</div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Two colleagues moving together. Find a PG that works for both — same building or within 15 km of each office.
          Converts one inquiry into two bookings.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Person 1's office">
          <SearchInput value={office1} onChange={setOffice1} resolved={o1?.label ?? null} />
        </Field>
        <Field label="Person 2's office">
          <SearchInput value={office2} onChange={setOffice2} resolved={o2?.label ?? null} />
        </Field>
        <Field label={`Budget per person: ₹${budget.toLocaleString("en-IN")}`}>
          <input type="range" min={9000} max={30000} step={500} value={budget}
            onChange={(e) => setBudget(+e.target.value)} className="w-full accent-primary" />
        </Field>
        <Field label="Gender">
          <div className="grid grid-cols-4 gap-1">
            {(["Any", "Boys", "Girls", "Co-live"] as const).map((g) => (
              <button key={g} onClick={() => setGender(g)}
                className={cn("rounded-md border px-2 py-1.5 text-[11px] font-medium transition-smooth",
                  gender === g ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-1 hover:border-primary/40")}>
                {g}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No PG works for both offices within 15km. Try widening budget or check spelling of office names.
        </div>
      ) : (
        <div className="grid gap-2">
          {picks.map((p, i) => (
            <button key={p.pg.id} onClick={() => onOpen(p.pg)}
              className="rounded-lg border border-border bg-card p-3 text-left transition-smooth hover:border-primary/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-semibold truncate">{p.pg.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.pg.area} · ₹{(p.cheap / 1000).toFixed(0)}k (₹{perDay(p.cheap)}/day) · IQ {p.pg.iq}
                  </div>
                </div>
                <div className="shrink-0 grid grid-cols-2 gap-1.5 text-right font-mono text-[10px]">
                  <div className={cn("rounded bg-surface-2 px-1.5 py-0.5", p.k1 <= 5 ? "text-emerald-400" : p.k1 <= 10 ? "text-amber-400" : "text-orange-400")}>
                    P1: {p.k1}km
                  </div>
                  <div className={cn("rounded bg-surface-2 px-1.5 py-0.5", p.k2 <= 5 ? "text-emerald-400" : p.k2 <= 10 ? "text-amber-400" : "text-orange-400")}>
                    P2: {p.k2}km
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function SearchInput({ value, onChange, resolved }: { value: string; onChange: (v: string) => void; resolved: string | null }) {
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Office, landmark, area"
          className="w-full rounded-md border border-input bg-surface-1 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60" />
      </div>
      {resolved && <div className="mt-1 text-[10px] text-emerald-400">✓ {resolved}</div>}
    </div>
  );
}
