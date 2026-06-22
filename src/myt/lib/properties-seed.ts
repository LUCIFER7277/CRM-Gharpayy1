import { Property, Room, RoomBlock, RoomType, Zone } from './types';
import { zones } from './mock-data';

const propertyNames = [
  'Prestige Lakeside','Brigade Meadows','Sobha Dream Acres','Godrej Splendour',
  'Mantri Serenity','Puravankara Zenium','Salarpuria Sattva','Embassy Springs',
  'Total Environment','Raheja Residency','Adarsh Palm Retreat','Shriram Greenfield',
  'Provident Sunworth','Nitesh Forest Hills','DivyaSree Republic','Sterling Ascentia',
  'Casagrand Aldea','Vaswani Reserve',
];

const owners = ['Ramesh K','Sunita Gowda','Manoj Pillai','Anita Reddy','Vikas Hegde','Deepak Bose','Lakshmi N','Suresh Babu'];
const amenitiesPool = ['WiFi','AC','Laundry','Gym','Lounge','Cafeteria','Power backup','Parking','CCTV','Daily housekeeping'];

function pick<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Generate properties only when zones are available
export function generateProperties(): Property[] {
  const safeZones = zones.filter((zone): zone is Zone => !!zone && typeof zone.id === 'string');
  if (safeZones.length === 0) return [];

  return propertyNames.map((name, i) => {
    const zone = safeZones[i % safeZones.length];
    const area = zone.areas?.[0] || zone.name;
    return {
      id: `p${i + 1}`,
      name,
      zoneId: zone.id,
      area,
      address: `${10 + i} Main Rd, ${area}`,
      basePrice: 8000 + (i % 7) * 1500,
      foodRating: parseFloat((2.8 + ((i * 7) % 22) / 10).toFixed(1)),
      hygieneRating: parseFloat((3.2 + ((i * 11) % 18) / 10).toFixed(1)),
      amenities: pick(amenitiesPool, 4 + (i % 4)),
      ownerName: owners[i % owners.length],
      photoCount: 4 + (i % 8),
      pageViews: 50 + ((i * 37) % 280),
      shares: 2 + ((i * 5) % 25),
    };
  });
}

const roomTypes: RoomType[] = ['single', 'double', 'triple', 'studio'];

export function generateRooms(): Room[] {
  const properties = generateProperties();
  if (properties.length === 0) return [];

  return properties.flatMap((p, pi) => {
    const roomCount = 4 + (pi % 4);
    return Array.from({ length: roomCount }, (_, ri) => {
      const type = roomTypes[(pi + ri) % 4];
      const bedsTotal = type === 'single' ? 1 : type === 'double' ? 2 : type === 'triple' ? 3 : 1;
      const bedsOccupied = Math.floor(Math.random() * (bedsTotal + 1));
      const priceMult = type === 'single' ? 1.3 : type === 'studio' ? 1.5 : type === 'double' ? 1.0 : 0.8;
      return {
        id: `r${p.id}-${ri + 1}`,
        propertyId: p.id,
        type,
        bedsTotal,
        bedsOccupied,
        currentPrice: Math.round(p.basePrice * priceMult),
      };
    });
  });
}

export function generateInitialBlocks(): RoomBlock[] {
  const rooms = generateRooms();
  const now = Date.now();
  return rooms.slice(0, 6).map((r, i) => ({
    id: `blk-seed-${i}`,
    roomId: r.id,
    propertyId: r.propertyId,
    leadName: `Seed lead ${i + 1}`,
    intent: i % 2 === 0 ? 'hard' : 'medium',
    createdAt: new Date(now - Math.random() * 86400000 * 30).toISOString(),
    expiresAt: new Date(now + Math.random() * 86400000 * 10).toISOString(),
    checkIn: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString().split('T')[0],
    checkOut: new Date(Date.now() + Math.random() * 86400000 * 10).toISOString().split('T')[0],
    status: Math.random() > 0.5 ? 'active' : 'released',
  }));
}

// Export constants that will be empty initially, then updated
export const rooms: Room[] = [];
export const initialBlocks: RoomBlock[] = [];
export const properties: Property[] = [];
