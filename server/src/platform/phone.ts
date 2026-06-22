import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalize to E.164. Defaults to India (IN) when no country code is present —
 * 90% of inbound leads. Returns null if unparseable; caller decides policy.
 */
export function toE164(raw: string, defaultCountry: "IN" | "US" | "AE" = "IN"): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // +<country><subscriber>
}
