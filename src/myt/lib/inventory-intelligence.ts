import { zones, teamMembers } from './mock-data';
import { PGS } from '@/supply-hub/data/pgs';
import { DISTANCE } from '@/supply-hub/data/areas';
import { matchLead, type Lead as SupplyLead } from '@/supply-hub/lib/matcher';
import type { Booking, Lead, Room, RoomBlock, Tour } from './types';
import type { Zone } from './types';
import type { PG } from '@/supply-hub/data/types';
import { normalizeRoomForSupply } from '@/lib/quickad-shared';

const norm = (v: string) => (v || '').toLowerCase().trim();

export interface InventoryFit {
  propertyId: string;
  propertyName: string;
  zoneId: string;
  area: string;
  locality?: string;
  mapsLink?: string;
  availableBeds: number;
  availableRooms: number;
  basePrice: number;
  priceFit: 'inside' | 'stretch' | 'low-fit';
  score: number;
  reason: string;
  distanceKm: number | null;
  distanceFromHere: string;
  distanceFromThere: string;
  source: 'supply-hub';
}

export interface AreaOperatingRow {
  zoneId: string;
  area: string;
  leads: number;
  qualifiedLeads: number;
  availableBeds: number;
  toursToday: number;
  bookings: number;
  tcmCapacity: number;
  signal: 'push-demand' | 'push-tours' | 'protect-capacity' | 'balanced';
  nextAction: string;
}

export function detectAreaZone(areaText: string) {
  const text = norm(areaText);
  const safeZones = zones.filter((z): z is Zone => !!z && typeof z.id === 'string');
  const fallbackZone: Zone = {
    id: 'unassigned',
    name: areaText || 'Unassigned',
    city: '',
    area: areaText || 'Unassigned',
    areas: areaText ? [areaText] : [],
    color: '',
  };
  if (safeZones.length === 0) return fallbackZone;

  const exact = safeZones.find((z) => z.areas.some((a) => text.includes(norm(a)) || norm(a).includes(text)));
  if (exact) return exact;
  const pg = PGS.find((p) => text.includes(norm(p.area)) || norm(p.area).includes(text) || norm(p.locality).includes(text));
  return safeZones.find((z) => z.areas.some((a) => norm(a) === norm(pg?.area ?? ''))) ?? safeZones[0] ?? fallbackZone;
}

export const supplyHubProperties = PGS.map((pg) => ({
  id: pg.id,
  name: pg.name,
  zoneId: detectAreaZone(pg.area).id,
  area: pg.area,
  address: pg.locality,
  basePrice: pg.prices.min || pg.prices.double || pg.prices.single || pg.prices.triple || 0,
  mapsLink: pg.mapsLink,
  pg,
}));

export function supplyBedsForPg(pg: PG, blocks: RoomBlock[] = []) {
  const bedTypes = [pg.prices.single, pg.prices.double, pg.prices.triple].filter((v) => v > 0).length;
  const activeBlocks = blocks.filter((b) => b.propertyId === pg.id && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now()).length;
  return { beds: Math.max(0, bedTypes - activeBlocks), rooms: bedTypes };
}

export function availableBedsForProperty(propertyId: string, rooms: Room[], blocks: RoomBlock[]) {
  const supplyPg = PGS.find((p) => p.id === propertyId);
  if (supplyPg) return supplyBedsForPg(supplyPg, blocks);
  const activeBlocks = new Set(
    blocks
      .filter((b) => b.propertyId === propertyId && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now())
      .map((b) => b.roomId),
  );
  const propRooms = rooms.filter((r) => r.propertyId === propertyId);
  const beds = propRooms.reduce((sum, room) => sum + Math.max(0, room.bedsTotal - room.bedsOccupied - (activeBlocks.has(room.id) ? 1 : 0)), 0);
  const openRooms = propRooms.filter((room) => room.bedsOccupied < room.bedsTotal && !activeBlocks.has(room.id)).length;
  return { beds, rooms: openRooms };
}

export function bestInventoryFits(input: {
  areaText: string;
  budget?: number;
  room?: string;
  rooms: Room[];
  blocks: RoomBlock[];
  limit?: number;
}): InventoryFit[] {
  const zone = detectAreaZone(input.areaText);
  const budget = input.budget || 0;
  const supplyLead: SupplyLead = {
    area: input.areaText,
    gender: 'Any',
    budgetMin: budget ? Math.max(7000, Math.round(budget * 0.85)) : 7000,
    budgetMax: budget || 50000,
    audience: 'Both',
    occupancy: normalizeRoomForSupply(input.room),
  };
  return matchLead(supplyLead)
    .filter((m) => !m.disqualified && m.total > 0)
    .map((m) => {
      const p = m.pg;
      const inv = supplyBedsForPg(p, input.blocks);
      const basePrice = m.bedPrice ?? (p.prices.min || p.prices.double || p.prices.single || p.prices.triple || 0);
      const priceDelta = budget ? Math.abs(basePrice - budget) / Math.max(1, budget) : 0.2;
      const priceFit: InventoryFit['priceFit'] = !budget || priceDelta <= 0.15 ? 'inside' : basePrice > budget ? 'stretch' : 'low-fit';
      const score = Math.max(0, Math.round(m.total + Math.min(10, inv.beds * 2)));
      return {
        propertyId: p.id,
        propertyName: p.name,
        zoneId: detectAreaZone(p.area).id,
        area: p.area,
        locality: p.locality,
        mapsLink: p.mapsLink,
        availableBeds: inv.beds,
        availableRooms: inv.rooms,
        basePrice,
        priceFit,
        score,
        reason: `${inv.beds} Supply Hub beds · ${m.bedLabel} · ${m.commuteKm !== null ? `${m.commuteKm} km` : p.area} · ${priceFit === 'inside' ? 'budget fit' : priceFit === 'stretch' ? 'slight stretch' : 'under budget'}`,
        distanceKm: m.commuteKm,
        distanceFromHere: m.commuteKm !== null ? `${p.name} → lead: ${m.commuteKm} km` : `${p.name} → lead: area estimate pending`,
        distanceFromThere: distanceBetweenAreas(p.area, zone.areas[0] || ''),
        source: 'supply-hub' as const,
      };
    })
    .filter((fit) => fit.availableBeds > 0)
    .sort((a, b) => b.score - a.score || b.availableBeds - a.availableBeds)
    .slice(0, input.limit ?? 3);
}

function distanceBetweenAreas(fromArea: string, toArea: string) {
  const fromKey = Object.keys(DISTANCE).find((k) => norm(k) === norm(fromArea) || norm(fromArea).includes(norm(k)));
  const row = fromKey ? DISTANCE[fromKey] : undefined;
  const toKey = row ? Object.keys(row).find((k) => norm(k) === norm(toArea) || norm(toArea).includes(norm(k))) : undefined;
  return toKey && row ? `${fromArea} → ${toArea}: ${row[toKey]} km` : `${fromArea} → ${toArea}: area estimate pending`;
}

export function recommendedTcm(tours: Tour[], zoneId: string) {
  const tcms = teamMembers.filter((m) => m.role === 'tcm' && m.zoneId === zoneId);
  return [...tcms].sort((a, b) => todaysLoad(tours, a.id) - todaysLoad(tours, b.id))[0] ?? null;
}

export function recommendedFlowOps(zoneId: string) {
  return teamMembers.find((m) => m.role === 'flow-ops' && m.zoneId === zoneId) ?? teamMembers.find((m) => m.role === 'flow-ops') ?? null;
}

export function todaysLoad(tours: Tour[], memberId: string) {
  const today = new Date().toISOString().split('T')[0];
  return tours.filter((t) => t.tourDate === today && (t.assignedTo === memberId || t.scheduledBy === memberId) && t.status !== 'cancelled').length;
}

export function buildAreaOperatingRows(input: { leads: Lead[]; tours: Tour[]; rooms: Room[]; blocks: RoomBlock[]; bookings: Booking[] }): AreaOperatingRow[] {
  const today = new Date().toISOString().split('T')[0];
  return zones.map((z) => {
    const zoneProps = PGS.filter((p) => detectAreaZone(p.area).id === z.id);
    const availableBeds = zoneProps.reduce((sum, p) => sum + supplyBedsForPg(p, input.blocks).beds, 0);
    const leads = input.leads.filter((l) => detectAreaZone(l.area).id === z.id);
    const toursToday = input.tours.filter((t) => t.zoneId === z.id && t.tourDate === today && t.status !== 'cancelled').length;
    const bookings = input.bookings.filter((b) => z.areas.some(a => norm(b.area) === norm(a))).length;
    const tcmCapacity = Math.max(0, teamMembers.filter((m) => m.role === 'tcm' && m.zoneId === z.id).length * 8 - toursToday);
    const signal: AreaOperatingRow['signal'] = availableBeds >= 8 && leads.length < 3 ? 'push-demand' : leads.length >= 3 && toursToday < Math.min(leads.length, 4) ? 'push-tours' : tcmCapacity < 2 ? 'protect-capacity' : 'balanced';
    const nextAction = signal === 'push-demand'
      ? `Create demand for ${availableBeds} live beds`
      : signal === 'push-tours'
        ? `Schedule ${Math.min(leads.length, availableBeds, 4)} Tours from matched leads`
        : signal === 'protect-capacity'
          ? 'Move soft Tours to another slot or TCM'
          : 'Keep matching leads to available rooms';
    return { zoneId: z.id, area: z.areas[0] || '', leads: leads.length, qualifiedLeads: leads.filter((l) => l.mytQualified).length, availableBeds, toursToday, bookings, tcmCapacity, signal, nextAction };
  });
}
