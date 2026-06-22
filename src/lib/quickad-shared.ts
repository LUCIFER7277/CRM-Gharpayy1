export const QUICKAD_QUESTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'areas', label: 'Areas' },
  { key: 'fullAddress', label: 'Full address / map link' },
  { key: 'budget', label: 'Budget' },
  { key: 'moveIn', label: 'Move-in' },
  { key: 'type', label: 'Type' },
  { key: 'room', label: 'Room' },
  { key: 'need', label: 'Need' },
  { key: 'specialReqs', label: 'Special requests' },
  { key: 'inBLR', label: 'Currently in Bangalore' },
] as const;

export const QUICKAD_TYPE_OPTIONS = ['Student', 'Working', 'Intern', 'Family', 'Other'] as const;
export const QUICKAD_ROOM_OPTIONS = ['Private', 'Shared', 'Both', 'Studio'] as const;
export const QUICKAD_NEED_OPTIONS = ['Boys', 'Girls', 'Coed'] as const;

export const parseBudgetAmount = (value: unknown) => {
  const raw = String(value ?? '').toLowerCase().replace(/,/g, ' ');
  const matches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*(k|000)?/g)]
    .map((m) => Math.round(Number(m[1]) * (m[2] === 'k' ? 1000 : m[2] === '000' ? 1000 : Number(m[1]) <= 80 ? 1000 : 1)))
    .filter((n) => Number.isFinite(n) && n > 0);
  return matches.length ? Math.max(...matches) : 0;
};

export function normalizeRoomForTour(room: unknown) {
  const raw = String(room ?? '').toLowerCase();
  if (raw.includes('triple') || raw.includes('3')) return 'Triple Sharing';
  if (raw.includes('double') || raw.includes('shared') || raw.includes('2')) return 'Double Sharing';
  if (raw.includes('studio')) return 'Studio';
  return 'Single';
}

export function normalizeRoomForSupply(room: unknown): 'Single' | 'Double' | 'Triple' | 'Any' {
  const raw = String(room ?? '').toLowerCase();
  if (raw.includes('triple') || raw.includes('3')) return 'Triple';
  if (raw.includes('double') || raw.includes('shared') || raw.includes('2')) return 'Double';
  if (raw.includes('single') || raw.includes('private')) return 'Single';
  return 'Any';
}
