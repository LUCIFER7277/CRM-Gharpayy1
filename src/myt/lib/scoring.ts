import { Property, Room, RoomBlock, Tour, Lead, PropertyScores, InventorySignal, Intent } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Demand score: how badly people want this property.
 * Combines page views, shares, and active leads in matching budget+area.
 */
function demandScore(p: Property, leads: Lead[]): number {
  const viewScore = Math.min(50, (p.pageViews / 200) * 50);
  const shareScore = Math.min(20, (p.shares / 30) * 20);
  const matchingLeads = leads.filter(
    l => l.area === p.area && Math.abs(l.budget - p.basePrice) <= 3000 && l.status !== 'dead'
  ).length;
  const leadScore = Math.min(30, matchingLeads * 4);
  return Math.round(viewScore + shareScore + leadScore);
}

/**
 * Conversion score: of tours for this property, how many became bookings.
 */
function conversionScore(p: Property, tours: Tour[]): number {
  const propertyTours = tours.filter(t => t.propertyName === p.name);
  if (propertyTours.length === 0) return 50; // unknown - neutral
  const completed = propertyTours.filter(t => t.status === 'completed').length;
  const bookings = propertyTours.filter(
    t => t.outcome === 'booked' || t.outcome === 'token-paid' || t.tokenPaid
  ).length;
  if (completed === 0) return 40;
  return Math.round((bookings / completed) * 100);
}

/**
 * Velocity score: how fast beds get filled (inverse of avg days-to-fill).
 * Proxy: occupancy % vs page age.
 */
function velocityScore(p: Property, rooms: Room[]): number {
  const propRooms = rooms.filter(r => r.propertyId === p.id);
  const total = propRooms.reduce((s, r) => s + r.bedsTotal, 0);
  const occupied = propRooms.reduce((s, r) => s + r.bedsOccupied, 0);
  if (total === 0) return 0;
  const occupancy = occupied / total;
  // High occupancy + high page views = high velocity
  return Math.round(occupancy * 70 + Math.min(30, p.pageViews / 10));
}

function deriveSignal(demand: number, available: number, total: number): InventorySignal {
  const occupancy = total > 0 ? 1 - available / total : 0;
  if (demand >= 65 && occupancy >= 0.7) return 'hot';
  if (demand <= 35 && occupancy <= 0.5) return 'cold';
  return 'balanced';
}

function suggestActions(p: Property, demand: number, conversion: number, velocity: number, available: number): string[] {
  const out: string[] = [];
  if (demand >= 70 && conversion >= 60 && available > 0) out.push(`Raise price ₹500 - demand strong`);
  if (demand >= 70 && conversion < 50) out.push(`Fix conversion - top objection: ${p.foodRating < 3.5 ? 'food quality' : 'pricing'}`);
  if (demand < 40 && conversion >= 60) out.push(`Hidden gem - push reels & ads`);
  if (demand < 40 && conversion < 40) out.push(`Deprioritize - low demand & weak close`);
  if (available === 0) out.push(`Sold out - capture waitlist`);
  if (p.foodRating < 3.5) out.push(`Improve food rating (${p.foodRating}/5)`);
  if (p.photoCount < 6) out.push(`Add more photos (${p.photoCount} live)`);
  return out.slice(0, 3);
}

export function scoreProperty(
  p: Property,
  rooms: Room[],
  tours: Tour[],
  leads: Lead[],
  blocks: RoomBlock[]
): PropertyScores {
  const propRooms = rooms.filter(r => r.propertyId === p.id);
  const bedsTotal = propRooms.reduce((s, r) => s + r.bedsTotal, 0);
  const bedsOccupied = propRooms.reduce((s, r) => s + r.bedsOccupied, 0);
  const activeBlocks = blocks.filter(
    b => b.propertyId === p.id && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now()
  );
  const bedsBlocked = activeBlocks.length;
  const bedsAvailable = Math.max(0, bedsTotal - bedsOccupied - bedsBlocked);
  const occupancyPct = bedsTotal > 0 ? Math.round((bedsOccupied / bedsTotal) * 100) : 0;

  const demand = demandScore(p, leads);
  const conversion = conversionScore(p, tours);
  const velocity = velocityScore(p, propRooms);
  const signal = deriveSignal(demand, bedsAvailable, bedsTotal);

  const weekStart = Date.now() - WEEK_MS;
  const weekTours = tours.filter(
    t => t.propertyName === p.name && new Date(t.createdAt).getTime() >= weekStart
  );
  const weekBookings = weekTours.filter(t => t.outcome === 'booked' || t.outcome === 'token-paid' || t.tokenPaid).length;
  const revenueWeek = weekBookings * p.basePrice;

  const lostTours = weekTours.filter(t => t.outcome === 'rejected' || t.outcome === 'not-interested' || t.showUp === false).length;
  const missedRevenue = lostTours * p.basePrice;

  return {
    propertyId: p.id,
    demandScore: demand,
    conversionScore: conversion,
    velocityScore: velocity,
    signal,
    bedsTotal,
    bedsOccupied,
    bedsBlocked,
    bedsAvailable,
    occupancyPct,
    revenueWeek,
    missedRevenue,
    suggestedActions: suggestActions(p, demand, conversion, velocity, bedsAvailable),
  };
}

// ============ LEAD MARKETPLACE SCORING ============

export function budgetPowerScore(leadBudget: number, zoneMedian: number): number {
  if (zoneMedian <= 0) return 50;
  const ratio = leadBudget / zoneMedian;
  if (ratio >= 1.3) return 95;
  if (ratio >= 1.1) return 80;
  if (ratio >= 0.95) return 65;
  if (ratio >= 0.8) return 45;
  return 25;
}

export function urgencyExpiry(intent: Intent, createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const hours = intent === 'hard' ? 2 : intent === 'medium' ? 8 : 24;
  return new Date(created + hours * 60 * 60 * 1000).toISOString();
}

export function conversionProbability(
  budgetPower: number,
  intent: Intent,
  willBook: 'yes' | 'maybe' | 'no' | undefined
): number {
  let score = budgetPower * 0.4;
  score += intent === 'hard' ? 40 : intent === 'medium' ? 25 : 10;
  if (willBook === 'yes') score += 15;
  else if (willBook === 'no') score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function zoneMedianBudget(leads: Lead[], area: string): number {
  const inZone = leads.filter(l => l.area === area).map(l => l.budget).sort((a, b) => a - b);
  if (inZone.length === 0) return 12000;
  return inZone[Math.floor(inZone.length / 2)];
}

export function leadIntent(lead: Lead): Intent {
  if (!lead.mytQualified) return 'soft';
  const days = (new Date(lead.moveInDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days <= 5 && lead.dateConfirmed) return 'hard';
  if (days <= 12) return 'medium';
  return 'soft';
}
