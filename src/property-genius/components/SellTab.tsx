// PG Detail enhancement panels — surfaced as a new "Sell" tab inside PGDetail.
// Lives next to Details / Landmarks / Scripts / Persona / IQ.
//
// Bundles 7 of the 15 features into one tab:
//   - Brochure assembler (#15)
//   - Parent Safety pack (#5)
//   - Convince-my-friend pack (#12)
//   - Walkthrough script (Script list 2 #13)
//   - Commute reality check vs. any office/landmark (#7)
//   - Inventory urgency status (#9)
//   - Freshness re-engagement reason (#14)

import type { PG } from "@/property-genius/data/types";
import { useMemo, useState } from "react";
import {
  FileText, Shield, Users, Mic, Navigation, Flame, Clock,
  MessageCircle, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";
import { LANDMARKS } from "@/property-genius/data/landmarks";
import { AREA_CENTROID } from "@/property-genius/data/areas";
import {
  scarcity, freshness, commuteEstimate, perDay,
} from "@/property-genius/lib/intel";
import {
  buildBrochure, buildParentPack, buildFriendPack, buildWalkthrough,
} from "@/property-genius/lib/messages";
import { waLink } from "@/property-genius/lib/wa";

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

type Asset = "brochure" | "parent" | "friend" | "walkthrough" | "commute";

export function SellTab({ pg }: { pg: PG }) {
  const [asset, setAsset] = useState<Asset>("brochure");
  const sc = useMemo(() => scarcity(pg), [pg]);
  const fr = useMemo(() => freshness(pg), [pg]);

  return (
    <div className="space-y-4">
      {/* Inventory urgency banner */}
      <div className={cn(
        "flex items-center gap-2.5 rounded-lg border p-3 text-sm",
        sc.hot ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
          : sc.level === "FEW LEFT" ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
          : sc.level === "FULL" ? "border-border bg-surface-2 text-muted-foreground"
          : "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
      )}>
        <Flame className={cn("h-4 w-4 shrink-0", sc.hot && "animate-pulse-dot")} />
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Inventory · {sc.level}</div>
          <div className="text-xs">{sc.reason}</div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5 font-mono text-[10px]">
          {sc.perBed.triple !== null && <span>T: {sc.perBed.triple}</span>}
          {sc.perBed.double !== null && <span>D: {sc.perBed.double}</span>}
          {sc.perBed.single !== null && <span>S: {sc.perBed.single}</span>}
        </div>
      </div>

      {fr.isFresh && (
        <div className="flex items-center gap-2.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span><b>✦ {fr.changeKind}</b> {fr.daysAgo} days ago — {fr.message}</span>
        </div>
      )}

      {/* Asset picker */}
      <div className="flex overflow-x-auto rounded-md border border-border bg-surface-1 p-1 scrollbar-none">
        {([
          { k: "brochure",     l: "Brochure",     I: FileText },
          { k: "parent",       l: "Parent Pack",  I: Shield },
          { k: "friend",       l: "Friend Forward", I: Users },
          { k: "walkthrough",  l: "Walkthrough Script", I: Mic },
          { k: "commute",      l: "Commute Check", I: Navigation },
        ] as const).map(({ k, l, I }) => (
          <button key={k} onClick={() => setAsset(k)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium transition-smooth",
              asset === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            <I className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      <div key={asset} className="animate-fade-up">
        {asset === "brochure"    && <BrochurePanel pg={pg} />}
        {asset === "parent"      && <ParentPanel pg={pg} />}
        {asset === "friend"      && <FriendPanel pg={pg} />}
        {asset === "walkthrough" && <WalkthroughPanel pg={pg} />}
        {asset === "commute"     && <CommutePanel pg={pg} />}
      </div>
    </div>
  );
}

function MessagePanel({ title, message, phone }: { title: string; message: string; phone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> {title}
        </h4>
        <CopyButton text={message} label="Copy" />
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-[11px] leading-relaxed">{message}</pre>
      <a href={waLink(phone, message)} target="_blank" rel="noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25">
        <MessageCircle className="h-3.5 w-3.5" /> Send via WhatsApp
      </a>
    </div>
  );
}

function BrochurePanel({ pg }: { pg: PG }) {
  const [name, setName] = useState("");
  const msg = useMemo(() => buildBrochure(pg, { leadName: name || undefined }), [pg, name]);
  return (
    <div className="space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead's name (auto-personalises)"
        className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/60" />
      <MessagePanel title="One-tap brochure" message={msg} phone={pg.manager.phone} />
    </div>
  );
}

function ParentPanel({ pg }: { pg: PG }) {
  const [parentName, setParentName] = useState("");
  const [daughterName, setDaughterName] = useState("");
  const msg = useMemo(() => buildParentPack(pg, { parentName: parentName || undefined, daughterName: daughterName || undefined }), [pg, parentName, daughterName]);
  if (pg.gender !== "Girls" && pg.gender !== "Co-live") {
    return (
      <div className="rounded-md border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-300">
        Parent Pack is built for Girls / Co-live properties — this PG is <b>{pg.gender}</b>.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent's name"
          className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/60" />
        <input value={daughterName} onChange={(e) => setDaughterName(e.target.value)} placeholder="Daughter's name"
          className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary/60" />
      </div>
      <MessagePanel title="Parent-facing safety pack" message={msg} phone={pg.manager.phone} />
    </div>
  );
}

function FriendPanel({ pg }: { pg: PG }) {
  const msg = useMemo(() => buildFriendPack(pg), [pg]);
  return <MessagePanel title="Forward to a friend" message={msg} />;
}

function WalkthroughPanel({ pg }: { pg: PG }) {
  const msg = useMemo(() => buildWalkthrough(pg), [pg]);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-primary" /> 90-second walkthrough script
        </h4>
        <CopyButton text={msg} label="Copy" />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">For video-call demos & in-person visits. Standardises every rep's pitch.</p>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-[11px] leading-relaxed">{msg}</pre>
    </div>
  );
}

function CommutePanel({ pg }: { pg: PG }) {
  const [office, setOffice] = useState("Goldman Sachs");
  const resolved = useMemo(() => resolve(office), [office]);
  const km = useMemo(() => {
    if (!resolved || !pg.lat || !pg.lng) return null;
    return hav(resolved.lat, resolved.lng, pg.lat, pg.lng);
  }, [resolved, pg]);
  const nearestMetro = pg.nearbyLandmarks?.find((l) => /metro/i.test(l.t))?.n;
  const est = km !== null ? commuteEstimate(km, nearestMetro) : null;

  const msg = est && resolved ? [
    `Commute reality — *${pg.name}* → *${resolved.label}*`,
    "",
    `📏 Distance: ${km}km`,
    `🚶 Walk: ${est.walkMins} min`,
    `🛺 Auto (normal): ${est.autoMins} min`,
    `🚦 Auto (peak hour): ${est.peakMins} min`,
    nearestMetro ? `🚇 Metro option: ${nearestMetro}` : "",
    "",
    `Recommended: ${est.mode === "walk" ? "Walk it" : est.mode === "auto" ? "Auto / bike" : `Metro to ${nearestMetro} + auto`}`,
  ].filter(Boolean).join("\n") : "";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Office or landmark</div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={office} onChange={(e) => setOffice(e.target.value)} placeholder="Goldman Sachs, Manyata, Christ University…"
            className="w-full rounded-md border border-input bg-surface-1 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60" />
        </div>
        {resolved && <div className="mt-1 text-[10px] text-emerald-400">✓ {resolved.label}</div>}
      </div>

      {est && resolved ? (
        <>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-primary">Commute reality · {km}km</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <CommuteStat label="Walk" value={`${est.walkMins} min`} ok={est.walkMins <= 20} />
              <CommuteStat label="Auto" value={`${est.autoMins} min`} ok={est.autoMins <= 20} />
              <CommuteStat label="Peak" value={`${est.peakMins} min`} ok={est.peakMins <= 30} />
            </div>
            <div className="mt-3 rounded bg-surface-2 p-2 text-xs">
              <span className="font-bold text-primary">Recommended:</span>{" "}
              {est.mode === "walk" ? "Walk it — saves the auto fare." : est.mode === "auto" ? "Auto or bike — under 30 min normally." : `Metro to ${nearestMetro}, then short auto.`}
            </div>
          </div>
          <MessagePanel title="Send commute breakdown" message={msg} phone={pg.manager.phone} />
        </>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Type an office or landmark to see walk / auto / peak estimates.
        </div>
      )}
    </div>
  );
}

function CommuteStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-md bg-surface-2 p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-base font-bold tabular-nums", ok ? "text-emerald-400" : "text-amber-400")}>{value}</div>
    </div>
  );
}
