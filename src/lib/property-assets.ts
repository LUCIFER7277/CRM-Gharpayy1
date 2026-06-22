/**
 * Property assets registry - connects each PG to its Drive PDF brochure.
 *
 * The shared Drive folder lives at:
 *   https://drive.google.com/drive/folders/18xJ5LrEiAL8b9BkXGQztKr-w2qdZey2Q
 *
 * Without OAuth/Drive API we cannot fetch a stable per-file URL programmatically,
 * so this module:
 *   1. Holds a hand-curated map of `pgId` → direct Drive file URL (when known).
 *   2. Falls back to a Drive "search inside this folder" URL for the PG name,
 *      which lands the rep on the right brochure in one click.
 *   3. Exposes helpers to build WhatsApp-ready messages that include the PDF
 *      link so a TCM can ship the brochure to a customer in two taps.
 *
 * To add a new direct link, paste the Drive file's "Anyone with the link can
 * view" URL into PROPERTY_PDF_DIRECT below.
 */
import type { PG } from "@/supply-hub/data/types";

export const PROPERTY_DRIVE_FOLDER_ID = "18xJ5LrEiAL8b9BkXGQztKr-w2qdZey2Q";
export const PROPERTY_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${PROPERTY_DRIVE_FOLDER_ID}`;

/**
 * Hand-mapped direct Drive file URLs for properties whose brochures we've
 * grabbed individually. Keys are pgId. Add more entries over time - the rest
 * fall back to the search-in-folder helper.
 */
export const PROPERTY_PDF_DIRECT: Record<string, string> = {
  // Add entries like:
  // FORUM_PRO_BOYS: "https://drive.google.com/file/d/.../view?usp=sharing",
};

/** Build a Drive in-folder search URL for a PG name. */
export function driveSearchUrlFor(pg: Pick<PG, "name" | "actualName">): string {
  // Normalise the search to a name fragment that's likely in the brochure
  // file name (e.g. "GG <NAME> ..." pattern in the shared folder).
  const tokens = [pg.name, pg.actualName]
    .filter(Boolean)
    .join(" ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
  const q = encodeURIComponent(tokens || pg.name);
  return `https://drive.google.com/drive/folders/${PROPERTY_DRIVE_FOLDER_ID}?q=${q}`;
}

export interface PropertyAssets {
  pdfUrl: string;
  pdfIsDirect: boolean;
  folderUrl: string;
}

export function getPropertyAssets(pg: Pick<PG, "id" | "name" | "actualName">): PropertyAssets {
  const direct = PROPERTY_PDF_DIRECT[pg.id];
  return {
    pdfUrl: direct ?? driveSearchUrlFor(pg),
    pdfIsDirect: !!direct,
    folderUrl: PROPERTY_DRIVE_FOLDER_URL,
  };
}

/**
 * Build a WhatsApp message that includes the brochure link so a customer can
 * preview the property before the tour. WhatsApp does not allow attaching a
 * PDF via a `wa.me` deep link - the official limitation - but a publicly
 * shared Drive link is rendered as a tappable preview card inside WhatsApp,
 * which is the standard workaround Flow Ops use today.
 */
export function buildPdfShareMessage(
  pg: Pick<PG, "name" | "area">,
  opts: { leadName?: string; siteName?: string; pdfUrl: string },
): string {
  const greet = opts.leadName ? `Hi ${opts.leadName},` : "Hi,";
  const lines = [
    greet,
    "",
    `Sharing the full brochure for *${pg.name}* (${pg.area}).`,
    "Includes rooms, pricing, photos, amenities and house rules.",
    "",
    `📄 ${opts.pdfUrl}`,
    "",
    "Tell me which room type works and I'll lock a visit slot.",
    `- Team ${opts.siteName ?? "Gharpayy"}`,
  ];
  return lines.join("\n");
}
