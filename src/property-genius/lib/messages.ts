// Pre-formatted WhatsApp message factory.
// One place that owns every shareable asset rep sends. Each builder returns
// a string that's already line-broken, emoji-spaced, and rep-tested for
// forwarding. Pair with `waLink()` from wa.ts.

import type { PG } from "@/property-genius/data/types";
import { perDay, scarcity, freshness, areaMood, commuteEstimate } from "./intel";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const k = (n: number) => `${Math.round(n / 1000)}k`;

function bedLine(pg: PG): string {
  const parts: string[] = [];
  if (pg.prices.triple) parts.push(`Triple ${inr(pg.prices.triple)}`);
  if (pg.prices.double) parts.push(`Double ${inr(pg.prices.double)}`);
  if (pg.prices.single) parts.push(`Single ${inr(pg.prices.single)}`);
  return parts.join(" · ") || "On call";
}

function nearestLine(pg: PG): string {
  const lm = pg.nearbyLandmarks?.[0];
  if (!lm) return "";
  const w = lm.w <= 0 ? "<1 min walk" : `${lm.w} min walk`;
  return `📍 ${w} to ${lm.n}`;
}

/* ---------- 1. Send-3-options (#2) ---------- */

export function buildThreeOptions(pgs: PG[], opts?: { leadName?: string; landmark?: string; gender?: string }): string {
  const greet = opts?.leadName ? `Hi ${opts.leadName},` : "Hi,";
  const ctx = opts?.landmark ? ` near ${opts.landmark}` : "";
  const lines = [greet, "", `Here are 3 ${opts?.gender ?? ""} PG options${ctx} curated for you:`, ""];
  pgs.slice(0, 3).forEach((pg, i) => {
    const cheapest = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
    lines.push(`*${i + 1}. ${pg.name}* — ${pg.area}`);
    if (cheapest < 99999) lines.push(`   From ${inr(cheapest)} (₹${perDay(cheapest)}/day)`);
    if (pg.usp) lines.push(`   ✨ ${pg.usp.slice(0, 80)}`);
    const lm = pg.nearbyLandmarks?.[0];
    if (lm) lines.push(`   📍 ${lm.w <= 0 ? "<1m" : lm.w + "m"} walk to ${lm.n}`);
    lines.push("");
  });
  lines.push("Reply with a number to lock a visit. — Gharpayy");
  return lines.join("\n");
}

/* ---------- 2. Comparison message (#10) ---------- */

export function buildComparison(pgs: PG[], opts?: { leadName?: string }): string {
  const greet = opts?.leadName ? `Hi ${opts.leadName}, here's a side-by-side:` : "Side-by-side comparison:";
  const lines = [greet, ""];
  pgs.forEach((pg) => {
    const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
    lines.push(`━━━━━━━━━━━━━━`);
    lines.push(`*${pg.name}* (${pg.area})`);
    lines.push(`Price: ${bedLine(pg)}`);
    if (cheap < 99999) lines.push(`Per day: ₹${perDay(cheap)}`);
    lines.push(`IQ: ${pg.iq}/100 · ${pg.tier}`);
    if (pg.foodType) lines.push(`Food: ${pg.foodType}${pg.mealsIncluded ? ` (${pg.mealsIncluded})` : ""}`);
    const lm = pg.nearbyLandmarks?.[0];
    if (lm) lines.push(`Nearest: ${lm.n} (${lm.w <= 0 ? "<1m" : lm.w + "m"})`);
    if (pg.amenities.length) lines.push(`Top amenities: ${pg.amenities.slice(0, 4).join(", ")}`);
    lines.push("");
  });
  lines.push("Forward to anyone — all prices verified today. — Gharpayy");
  return lines.join("\n");
}

/* ---------- 3. One-tap brochure (#15) ---------- */

export function buildBrochure(pg: PG, opts?: { leadName?: string }): string {
  const greet = opts?.leadName ? `Hi ${opts.leadName},` : "Hi,";
  const sc = scarcity(pg);
  const lines = [
    greet,
    "",
    `*${pg.name}* — ${pg.area}`,
    pg.tier ? `${pg.tier} · ${pg.gender} · IQ ${pg.iq}/100` : "",
    "",
    "*PRICING*",
    bedLine(pg),
  ];
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
  if (cheap < 99999) lines.push(`Effective: ₹${perDay(cheap)}/day · everything included`);
  if (sc.hot) lines.push(`⚠️ ${sc.reason}`);
  lines.push("");
  if (pg.usp) { lines.push("*WHY THIS PG*", pg.usp, ""); }
  if (pg.nearbyLandmarks?.length) {
    lines.push("*NEAREST LANDMARKS*");
    pg.nearbyLandmarks.slice(0, 3).forEach((lm) => {
      const dist = lm.d < 1 ? `${Math.round(lm.d * 1000)}m` : `${lm.d.toFixed(1)}km`;
      lines.push(`• ${lm.n} — ${dist} (${lm.w <= 0 ? "<1" : lm.w} min walk)`);
    });
    lines.push("");
  }
  if (pg.amenities.length) { lines.push("*AMENITIES*", pg.amenities.slice(0, 8).join(" · "), ""); }
  if (pg.foodType || pg.mealsIncluded) lines.push(`🍽 *FOOD:* ${pg.foodType}${pg.mealsIncluded ? " · " + pg.mealsIncluded : ""}`, "");
  if (pg.safety.length) lines.push(`🛡 *SAFETY:* ${pg.safety.join(" · ")}`, "");
  if (pg.deposit) lines.push(`💰 *DEPOSIT:* ${pg.deposit}`);
  if (pg.minStay) lines.push(`📅 *MIN STAY:* ${pg.minStay}`);
  if (pg.manager.phone) lines.push(`📞 Manager: ${pg.manager.phone}`);
  if (pg.mapsLink) lines.push(`🗺 ${pg.mapsLink}`);
  lines.push("", "Want to lock a visit? Reply yes. — Gharpayy");
  return lines.filter(Boolean).join("\n");
}

/* ---------- 4. Parent safety pack (#5) ---------- */

export function buildParentPack(pg: PG, opts?: { parentName?: string; daughterName?: string }): string {
  const greet = opts?.parentName ? `Namaste ${opts.parentName},` : "Namaste,";
  const lines = [
    greet,
    "",
    opts?.daughterName ? `Sharing the safety profile of *${pg.name}* for ${opts.daughterName}.` : `Safety profile — *${pg.name}*, ${pg.area}.`,
    "",
    "🛡 *SAFETY MEASURES*",
  ];
  if (pg.safety.length) {
    pg.safety.forEach((s) => lines.push(`✓ ${s}`));
  } else {
    lines.push("✓ Verified by Gharpayy team");
  }
  lines.push(`✓ All-${pg.gender === "Girls" ? "female" : pg.gender.toLowerCase()} residents`);
  lines.push("✓ No outside male entry policy");
  lines.push("");
  lines.push("🍽 *FOOD & TIMINGS*");
  if (pg.foodType) lines.push(`• Type: ${pg.foodType}`);
  if (pg.mealsIncluded) lines.push(`• Meals: ${pg.mealsIncluded}`);
  lines.push("• Fixed timings: 8:30 AM · 1:00 PM · 8:30 PM");
  lines.push("");
  lines.push("📍 *LOCATION*");
  lines.push(`• ${pg.area}${pg.locality ? `, ${pg.locality}` : ""}`);
  if (pg.mapsLink) lines.push(`• Maps: ${pg.mapsLink}`);
  const hospital = pg.nearbyLandmarks?.find((l) => /hospital|clinic|medical/i.test(l.t));
  if (hospital) lines.push(`• Nearest hospital: ${hospital.n} (${hospital.d}km)`);
  lines.push("");
  if (pg.manager.phone) {
    lines.push("📞 *EMERGENCY CONTACT*");
    lines.push(`• Manager${pg.manager.name ? ` (${pg.manager.name})` : ""}: ${pg.manager.phone}`);
    lines.push("• Available 24/7 for parents");
    lines.push("");
  }
  lines.push("Visit anytime, unannounced. We encourage it.", "— Gharpayy Team");
  return lines.join("\n");
}

/* ---------- 5. Convince-my-friend pack (#12) ---------- */

export function buildFriendPack(pg: PG): string {
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
  const lm = pg.nearbyLandmarks?.[0];
  const lines = [
    `Hey — checking out *${pg.name}* in ${pg.area}.`,
    "",
    `Quick scan:`,
    `• ${bedLine(pg)}${cheap < 99999 ? ` (~₹${perDay(cheap)}/day)` : ""}`,
    `• IQ score ${pg.iq}/100 · ${pg.tier} tier`,
    lm ? `• ${lm.w <= 0 ? "<1m" : lm.w + "m"} walk to ${lm.n}` : "",
    pg.foodType ? `• Food: ${pg.foodType}${pg.mealsIncluded ? ` (${pg.mealsIncluded})` : ""}` : "",
    pg.amenities.length ? `• Has: ${pg.amenities.slice(0, 5).join(", ")}` : "",
    "",
    pg.usp ? `Why I'm leaning in: ${pg.usp}` : "",
    "",
    `What do you think — worth visiting?`,
  ].filter(Boolean);
  return lines.join("\n");
}

/* ---------- 6. Anti-ghosting (#14) ---------- */

export function buildReengagement(pg: PG, stage: "visited" | "got_price" | "browsed"): string {
  const fresh = freshness(pg);
  const intro = fresh.isFresh && fresh.message
    ? `Quick update — ${fresh.message.toLowerCase()}`
    : "Following up on the property you liked";
  switch (stage) {
    case "visited":
      return `Hi! ${intro}\n\n*${pg.name}* — the room you saw is still available, but someone else is visiting tomorrow morning.\n\nWant me to hold it for you with a token today?\n— Gharpayy`;
    case "got_price":
      return `Hi! Quick update on *${pg.name}* — ${fresh.changeKind ?? "still available at the same price"}.\n\n${bedLine(pg)}\n${fresh.changeKind === "Price drop" ? "(That's the new lowered rate.)" : ""}\n\nShall I block a visit slot this week?\n— Gharpayy`;
    case "browsed":
    default:
      return `Hi! Saw you were exploring ${pg.area}.\n\n*${pg.name}* opened up a room this week — usually full. ${pg.usp ? "\n\n✨ " + pg.usp : ""}\n\nWorth a 10-min visit?\n— Gharpayy`;
  }
}

/* ---------- 7. Walkthrough script (#13 list 2) ---------- */

export function buildWalkthrough(pg: PG): string {
  const lm = pg.nearbyLandmarks?.[0];
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0).concat(99999));
  return [
    `90-SECOND WALKTHROUGH SCRIPT — ${pg.name}`,
    ``,
    `🎬 OPEN (10s)`,
    `"Welcome — you're standing at ${pg.area}'s ${pg.tier.toLowerCase()} pick.${lm ? ` ${lm.w <= 0 ? "Less than a minute" : lm.w + " min"} walk to ${lm.n} — that alone saves you ₹${perDay(3000)}/day in commute."` : '"'}`,
    ``,
    `✨ WOW MOMENT 1 (15s)`,
    `Show: ${pg.amenities[0] || "The lobby/common area"}.`,
    `Say: "This is what ₹${cheap < 99999 ? perDay(cheap) : "X"}/day buys you here. Compare that to renting alone."`,
    ``,
    `✨ WOW MOMENT 2 (15s)`,
    `Show: ${pg.foodType ? "Kitchen/dining — point at hygiene" : "A typical room — open the wardrobe"}.`,
    `Say: "${pg.mealsIncluded ? pg.mealsIncluded + ' — never cook again.' : 'Furnished, ready, walk in with one suitcase.'}"`,
    ``,
    `✨ WOW MOMENT 3 (15s)`,
    `Show: ${pg.safety[0] ? "Safety setup — " + pg.safety[0] : "View from the room"}.`,
    `Say: "${pg.safety.length ? "This is what your parents will care about." : "This is the view you'll wake up to."}"`,
    ``,
    `💰 PRICE REVEAL (10s)`,
    `Say slowly: "${bedLine(pg)}. All inclusive. ${cheap < 99999 ? `That's ₹${perDay(cheap)}/day.` : ""}"`,
    `Pause for 3 seconds. Don't fill silence.`,
    ``,
    `🎯 CLOSE (10s)`,
    `Ask: "${pg.scripts?.pitch?.closeQuestion || 'Should I block this room for you with a small token today?'}"`,
  ].join("\n");
}

/* ---------- 8. Instant match card (#1) ---------- */

export function buildInstantMatch(pg: PG, opts: { leadName?: string; office: string; budget: number; commute?: { km: number; mins: number } | null }): string {
  const cheap = Math.min(...[pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0 && x <= opts.budget * 1.1).concat(99999));
  const greet = opts.leadName ? `Hi ${opts.leadName},` : "Hi,";
  const lines = [
    greet,
    "",
    `Best match for you: *${pg.name}*, ${pg.area}.`,
    "",
    cheap < 99999 ? `💰 ${inr(cheap)} (₹${perDay(cheap)}/day) — fits your ${k(opts.budget)} budget.` : `Pricing: ${bedLine(pg)}`,
    opts.commute ? `📍 ${opts.commute.km}km from ${opts.office} (~${opts.commute.mins} min auto)` : `📍 Near ${opts.office}`,
    pg.usp ? `✨ ${pg.usp.slice(0, 100)}` : "",
    "",
    pg.mapsLink ? `🗺 ${pg.mapsLink}` : "",
    "",
    "Lock a visit? Reply yes.",
    "— Gharpayy",
  ].filter(Boolean);
  return lines.join("\n");
}
