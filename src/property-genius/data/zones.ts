// 5 real Gharpayy sales zones — areas, phone, landmark shelves, accent token.
// Each PG resolves to exactly one zone via areaToZone().

export type ZoneId = "koramangala" | "orr-south" | "whitefield" | "manyata" | "anywhere";
export type ZoneAccent = "primary" | "info" | "success" | "warning" | "muted";

export interface Zone {
  id: ZoneId;
  label: string;
  short: string;
  phone: string;
  blurb: string;
  accent: ZoneAccent;
  /** Lowercased area substrings — first hit wins. */
  areas: string[];
  /** Quick-search shelf items: { label, query } where query is fed into UniversalSearch. */
  shelves: { label: string; query: string }[];
}

export const ZONES: Zone[] = [
  {
    id: "koramangala",
    label: "Koramangala Belt",
    short: "Koramangala",
    phone: "8307396042",
    accent: "primary",
    blurb: "Koramangala 1–8 · S.G. Palya · Adugodi · Dairy Circle · Forum · MG Road · HSR",
    areas: [
      "koramangala", "sg palya", "s.g. palya", "s g palya", "adugodi", "dairy circle",
      "forum", "mg road", "hsr", "btm", "jayanagar", "jp nagar", "ejipura", "ibc",
      "christ central", "tavrekere", "tavarekere", "madiwala",
    ],
    shelves: [
      { label: "PG near Forum Mall", query: "Forum Mall" },
      { label: "PG near Christ University", query: "Christ University" },
      { label: "PG near Jyoti Nivas College", query: "Jyoti Nivas" },
      { label: "PG near Sony Signal", query: "Sony Signal" },
      { label: "PG near Koramangala 4th Block", query: "Koramangala 4th Block" },
      { label: "PG near Koramangala 7th Block", query: "Koramangala 7th Block" },
    ],
  },
  {
    id: "orr-south",
    label: "ORR South",
    short: "ORR South",
    phone: "6363607724",
    accent: "info",
    blurb: "Marathahalli · Bellandur · Kadubeesanahalli · Sarjapur Road · EcoWorld · Mahadevapura",
    areas: [
      "marathahalli", "marathalli", "bellandur", "kadubeesanahalli", "sarjapur",
      "ecoworld", "etv", "embassy tech", "mahadevapura", "mahadevpura", "bagmane",
      "cv raman", "aces", "sjr",
    ],
    shelves: [
      { label: "PG near RMZ Ecoworld", query: "RMZ Ecoworld" },
      { label: "PG near Embassy TechVillage", query: "Embassy Tech Village" },
      { label: "PG near Cessna Business Park", query: "Cessna Business Park" },
      { label: "PG near Prestige Tech Park", query: "Prestige Tech Park" },
      { label: "PG near Sakra Hospital", query: "Sakra Hospital" },
      { label: "PG near New Horizon College", query: "New Horizon College" },
    ],
  },
  {
    id: "whitefield",
    label: "Whitefield Corridor",
    short: "Whitefield",
    phone: "8307396042",
    accent: "success",
    blurb: "Whitefield · Brookfield · Hoodi · Kundalahalli · ITPL · EPIP · Kadugodi · PMC",
    areas: [
      "whitefield", "brookfield", "brookield", "hoodi", "kundalahalli", "itpl",
      "epip", "kadugodi", "pmc", "hopefarm", "hope farm", "naruhalli",
    ],
    shelves: [
      { label: "PG near ITPL", query: "ITPL" },
      { label: "PG near EPIP Zone", query: "EPIP Zone" },
      { label: "PG near Phoenix Marketcity", query: "Phoenix Marketcity" },
      { label: "PG near Vydehi Hospital", query: "Vydehi Hospital" },
      { label: "PG near Hope Farm", query: "Hope Farm" },
      { label: "PG near SAP Labs", query: "SAP Labs" },
    ],
  },
  {
    id: "manyata",
    label: "Manyata / North",
    short: "Manyata",
    phone: "8431513647",
    accent: "warning",
    blurb: "Manyata Tech Park · Nagawara · Hebbal · Thanisandra · Mathikere",
    areas: [
      "manyata", "manytha", "nagawara", "hebbal", "thanisandra", "mathikere",
      "mtp", "rt nagar", "jakkur", "hennur", "yelahanka",
    ],
    shelves: [
      { label: "PG near Manyata Tech Park", query: "Manyata Tech Park" },
      { label: "PG near IBM Manyata", query: "IBM Manyata" },
      { label: "PG near Elements Mall", query: "Elements Mall" },
      { label: "PG near Nagawara Junction", query: "Nagawara Junction" },
      { label: "PG near Hebbal Flyover", query: "Hebbal Flyover" },
      { label: "PG near Manyata Back Gate", query: "Manyata Back Gate" },
    ],
  },
  {
    id: "anywhere",
    label: "Anywhere in Bangalore",
    short: "Anywhere",
    phone: "7988114576",
    accent: "muted",
    blurb: "Christ · Jain · MCC · St Joseph · Yeshwanthpur · Peenya · UB City · Bagmane · WTC · Electronic City",
    areas: [], // catch-all
    shelves: [
      { label: "PG near Christ University", query: "Christ University" },
      { label: "PG near Jain University", query: "Jain University" },
      { label: "PG near MCC", query: "MCC" },
      { label: "PG near St Joseph", query: "St Joseph" },
      { label: "PG near Yeshwanthpur", query: "Yeshwanthpur" },
      { label: "PG near UB City", query: "UB City" },
      { label: "PG near WTC", query: "WTC" },
      { label: "PG near Electronic City", query: "Electronic City" },
      { label: "PG near Vasanth Nagar", query: "Vasanth Nagar" },
    ],
  },
];

const norm = (s: string) => (s || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

/** Resolve a PG area string → zone id. Order matters: first hit wins, falls back to "anywhere". */
export function areaToZone(area: string | undefined): ZoneId {
  const a = norm(area || "");
  if (!a) return "anywhere";
  for (const z of ZONES) {
    if (z.id === "anywhere") continue;
    if (z.areas.some((kw) => a.includes(kw))) return z.id;
  }
  return "anywhere";
}

export function getZone(id: ZoneId): Zone {
  return ZONES.find((z) => z.id === id) || ZONES[ZONES.length - 1];
}

export function accentClasses(a: ZoneAccent): { text: string; bg: string; border: string; ring: string } {
  switch (a) {
    case "primary": return { text: "text-primary", bg: "bg-primary/10", border: "border-primary/40", ring: "ring-primary/30" };
    case "info":    return { text: "text-info",    bg: "bg-info/10",    border: "border-info/40",    ring: "ring-info/30" };
    case "success": return { text: "text-success", bg: "bg-success/10", border: "border-success/40", ring: "ring-success/30" };
    case "warning": return { text: "text-warning", bg: "bg-warning/10", border: "border-warning/40", ring: "ring-warning/30" };
    default:        return { text: "text-muted-foreground", bg: "bg-surface-2", border: "border-border", ring: "ring-border" };
  }
}
