import { Tour, Intent, TeamMember } from './types';
import { teamMembers } from './mock-data';

interface TcmScore {
  member: TeamMember;
  showUpRate: number;
  draftRate: number;
  load: number;
  composite: number;
}

function getTcmStats(tours: Tour[]): TcmScore[] {
  const tcms = teamMembers.filter(m => m.role === 'tcm');
  return tcms.map(member => {
    const memberTours = tours.filter(t => t.assignedTo === member.id);
    const completed = memberTours.filter(t => t.status === 'completed').length;
    const showed = memberTours.filter(t => t.showUp === true).length;
    const drafts = memberTours.filter(t => t.outcome === 'draft' || t.outcome === 'booked').length;
    const showUpRate = memberTours.length > 0 ? showed / memberTours.length : 0.5;
    const draftRate = completed > 0 ? drafts / completed : 0.3;
    const todayLoad = memberTours.filter(
      t => t.tourDate === new Date().toISOString().split('T')[0] && t.status !== 'completed'
    ).length;
    return {
      member,
      showUpRate,
      draftRate,
      load: todayLoad,
      composite: showUpRate * 0.6 + draftRate * 0.4,
    };
  });
}

/**
 * Auto-assign rules:
 * - Hard intent → top-scoring TCM in that zone with capacity
 * - Medium → round-robin within zone
 * - Soft → TCM with fewest soft tours today
 */
export function autoAssignTcm(
  tours: Tour[],
  zoneId: string,
  intent: Intent
): TeamMember | null {
  const stats = getTcmStats(tours).filter(s => s.member.zoneId === zoneId);
  if (stats.length === 0) return null;

  if (intent === 'hard') {
    const eligible = stats.filter(s => s.load < 10);
    const pool = eligible.length > 0 ? eligible : stats;
    return [...pool].sort((a, b) => b.composite - a.composite)[0].member;
  }

  if (intent === 'medium') {
    return [...stats].sort((a, b) => a.load - b.load)[0].member;
  }

  // soft
  const softLoad = stats.map(s => ({
    ...s,
    softCount: tours.filter(
      t => t.assignedTo === s.member.id && t.intent === 'soft'
    ).length,
  }));
  return softLoad.sort((a, b) => a.softCount - b.softCount)[0].member;
}

export function getTakenSlots(
  tours: Tour[],
  memberId: string | null,
  date: string
): Set<string> {
  const set = new Set<string>();
  tours
    .filter(t => t.tourDate === date && (memberId ? t.assignedTo === memberId : true))
    .filter(t => t.status !== 'cancelled')
    .forEach(t => set.add(t.tourTime));
  return set;
}
