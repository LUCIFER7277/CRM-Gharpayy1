import { Zone, TeamMember, Tour, HeatmapData, Lead, Booking, DateRange, ZonePerformance, MemberPerformance } from './types';

// Real zones will be fetched from the API by the app context
export let zones: Zone[] = [];

export function setZones(newZones: Zone[]) {
  zones = newZones.map((zone) => ({ ...zone, area: zone.area || zone.areas[0] || zone.name }));
}

export const teamMembers: TeamMember[] = [];
export const tours: Tour[] = [];
export const initialLeads: Lead[] = [];
export const initialBookings: Booking[] = [];
export const heatmapData: HeatmapData[] = [];

export function filterToursByDateRange(tourList: Tour[], range: DateRange): Tour[] {
  return [];
}

export function getZonePerformance(tourList: Tour[]): ZonePerformance[] {
  void tourList;
  return [];
}

export function getMemberPerformance(tourList: Tour[]): MemberPerformance[] {
  void tourList;
  return [];
}
