// WhatsApp helpers: build a personalized card and a wa.me deep link.
// This is the conversion engine — manager sees a clean message with name, price, location, USP.

import type { PG } from "@/property-genius/data/types";

export function buildWaCard(pg: PG, opts?: { leadName?: string; bedLabel?: string; commuteKm?: number | null; landmarkName?: string }): string {
  const greet = opts?.leadName ? `Hi ${opts.leadName},` : "Hi,";
  const lines: string[] = [greet, "", `Sharing *${pg.name}* — ${pg.area}.`];

  // Pricing — only what's actually offered
  const priced: string[] = [];
  if (pg.prices.triple) priced.push(`Triple: ₹${pg.prices.triple.toLocaleString("en-IN")}/mo`);
  if (pg.prices.double) priced.push(`Double: ₹${pg.prices.double.toLocaleString("en-IN")}/mo`);
  if (pg.prices.single) priced.push(`Single: ₹${pg.prices.single.toLocaleString("en-IN")}/mo`);
  if (priced.length) lines.push("", ...priced);

  if (opts?.bedLabel) lines.push("", `Best fit for you: ${opts.bedLabel}`);

  if (opts?.commuteKm !== null && opts?.commuteKm !== undefined && opts?.landmarkName) {
    lines.push("", `📍 ${opts.commuteKm} km from ${opts.landmarkName}`);
  }

  if (pg.usp) lines.push("", `✨ ${pg.usp}`);

  if (pg.amenities.length) lines.push("", `Includes: ${pg.amenities.slice(0, 6).join(", ")}`);

  if (pg.foodType || pg.mealsIncluded) lines.push("", `🍽 ${[pg.foodType, pg.mealsIncluded].filter(Boolean).join(" · ")}`);

  if (pg.deposit) lines.push("", `Deposit: ${pg.deposit}`);

  if (pg.mapsLink) lines.push("", `🗺 ${pg.mapsLink}`);

  lines.push("", "Want me to lock a visit slot?", "— Gharpayy");
  return lines.join("\n");
}

export function waLink(phone: string | undefined, text: string): string {
  const t = encodeURIComponent(text);
  if (!phone) return `https://wa.me/?text=${t}`;
  const clean = phone.replace(/\D/g, "");
  // Default to India country code if 10 digits
  const num = clean.length === 10 ? `91${clean}` : clean;
  return `https://wa.me/${num}?text=${t}`;
}

export function telLink(phone: string | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 10) return null;
  return `tel:+${clean.length === 10 ? "91" + clean : clean}`;
}
