import type { Quotation } from "@/lib/crm10x/quotations";

const STALE_MS = 24 * 60 * 60 * 1000;

/** Quote sent 24h+ ago with no payment — needs follow-up. */
export function isQuoteStale(lastQuote?: Quotation): boolean {
  if (!lastQuote || lastQuote.status !== "sent") return false;
  const sent = +new Date(lastQuote.sentAt);
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent >= STALE_MS;
}
