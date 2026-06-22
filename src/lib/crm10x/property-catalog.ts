import { PGS } from "@/property-genius/data/pgs";
import type { PG } from "@/property-genius/data/types";
import type { Property } from "@/lib/types";

/** Unified property reference — Property Hub (PGS) or ops inventory. */
export type CatalogProperty = {
  id: string;
  name: string;
  area: string;
  source: "hub" | "ops" | "other";
  pricePerBed: number;
  vacantBeds?: number;
  totalBeds?: number;
  pg?: PG;
  ops?: Property;
};

function cheapestBed(pg: PG): number {
  const beds = [pg.prices.triple, pg.prices.double, pg.prices.single].filter((x) => x > 0);
  return beds.length ? Math.min(...beds) : pg.prices.min || 0;
}

function pgToCatalog(pg: PG): CatalogProperty {
  return {
    id: pg.id,
    name: pg.name,
    area: pg.area,
    source: "hub",
    pricePerBed: cheapestBed(pg),
    pg,
  };
}

function opsToCatalog(p: Property): CatalogProperty {
  return {
    id: p.id,
    name: p.name,
    area: p.area,
    source: "ops",
    pricePerBed: p.pricePerBed,
    vacantBeds: p.vacantBeds,
    totalBeds: p.totalBeds,
    ops: p,
  };
}

/** Resolve a property id from either Property Hub or ops inventory. */
export function resolvePropertyById(
  id: string | undefined | null,
  opsProperties: Property[],
): CatalogProperty | undefined {
  if (!id?.trim()) return undefined;
  if (id.startsWith("other:")) {
    return {
      id,
      name: id.replace("other:", ""),
      area: "Other",
      source: "other",
      pricePerBed: 0,
    };
  }
  const pg = PGS.find((p) => p.id === id);
  if (pg) return pgToCatalog(pg);
  const ops = opsProperties.find((p) => p.id === id);
  if (ops) return opsToCatalog(ops);
  return undefined;
}

/** Resolve by name when id lookup fails (legacy tours). */
export function resolvePropertyByName(
  name: string | undefined | null,
  opsProperties: Property[],
): CatalogProperty | undefined {
  if (!name?.trim()) return undefined;
  const lower = name.toLowerCase();
  const pg = PGS.find((p) => p.name.toLowerCase() === lower);
  if (pg) return pgToCatalog(pg);
  const ops = opsProperties.find((p) => p.name.toLowerCase() === lower);
  if (ops) return opsToCatalog(ops);
  if (name.startsWith("other:")) {
    return {
      id: name,
      name: name.replace("other:", ""),
      area: "Other",
      source: "other",
      pricePerBed: 0,
    };
  }
  return undefined;
}

export function searchPropertyCatalog(
  query: string,
  opsProperties: Property[],
  opts?: { preferredArea?: string; limit?: number },
): CatalogProperty[] {
  const limit = opts?.limit ?? 12;
  const q = query.trim().toLowerCase();

  let hub = PGS;
  let ops = opsProperties;

  if (q) {
    hub = PGS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        (p.locality?.toLowerCase().includes(q) ?? false),
    );
    ops = opsProperties.filter(
      (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q),
    );
  } else if (opts?.preferredArea?.trim()) {
    const area = opts.preferredArea.toLowerCase();
    const byArea = PGS.filter(
      (p) => p.area.toLowerCase().includes(area) || area.includes(p.area.toLowerCase()),
    );
    if (byArea.length) hub = byArea;
  }

  const merged: CatalogProperty[] = [
    ...hub.map(pgToCatalog),
    ...ops.filter((p) => !hub.some((h) => h.id === p.id)).map(opsToCatalog),
  ];

  return merged.slice(0, limit);
}

/** All catalog entries for dropdowns (hub first by IQ, then ops). */
export function allCatalogProperties(opsProperties: Property[]): CatalogProperty[] {
  const hub = [...PGS].sort((a, b) => b.iq - a.iq).map(pgToCatalog);
  const ops = opsProperties
    .filter((p) => !PGS.some((h) => h.id === p.id))
    .map(opsToCatalog);
  return [...hub, ...ops];
}
