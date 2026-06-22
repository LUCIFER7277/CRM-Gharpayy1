import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tour, Role, Lead, Booking, Room, RoomBlock, Property } from './types';
import { tours as initialTours, initialLeads, initialBookings, setZones } from './mock-data';
import { generateRooms, generateInitialBlocks } from './properties-seed';
import { api } from '@/lib/api/client';

interface AppState {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  blocks: RoomBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<RoomBlock[]>>;
  // User-managed properties for the Property Command Center (no seed data).
  managedProperties: Property[];
  setManagedProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  managedRooms: Room[];
  setManagedRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentMemberId: string | null;
  setCurrentMemberId: (id: string | null) => void;
  globalZoneFilter: string | null;
  setGlobalZoneFilter: (id: string | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Initialize tours from localStorage or empty array
  const [tours, setToursState] = useState<Tour[]>(() => {
    try {
      const stored = localStorage.getItem('myt:tours');
      return stored ? JSON.parse(stored) : initialTours;
    } catch {
      return initialTours;
    }
  });
  
  // Wrap setTours to also persist to localStorage
  const setTours = React.useCallback((updater: React.SetStateAction<Tour[]>) => {
    setToursState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('myt:tours', JSON.stringify(next));
      } catch (e) {
        console.warn('[AppProvider] Failed to persist tours:', (e as Error).message);
      }
      return next;
    });
  }, []);

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [managedProperties, setManagedProperties] = useState<Property[]>([]);
  const [managedRooms, setManagedRooms] = useState<Room[]>([]);
  const [currentRole, setCurrentRole] = useState<Role>('hr');
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [globalZoneFilter, setGlobalZoneFilter] = useState<string | null>(null);

  // Fetch real zones from the API on mount and generate rooms/blocks
  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/myt")) return;
    void (async () => {
      try {
        const realZones = await api.zones.list();
        setZones(realZones as any[]);
        // Now regenerate rooms and blocks with the real zones
        setRooms(generateRooms());
        setBlocks(generateInitialBlocks());
      } catch (e) {
        console.warn('[AppProvider] Failed to fetch zones from API:', (e as Error).message);
        // Set empty rooms/blocks if zones couldn't be fetched
        setRooms([]);
        setBlocks([]);
      }
    })();
  }, []);

  return (
    <AppContext.Provider value={{
      tours, setTours,
      leads, setLeads,
      bookings, setBookings,
      rooms, setRooms,
      blocks, setBlocks,
      managedProperties, setManagedProperties,
      managedRooms, setManagedRooms,
      currentRole, setCurrentRole,
      currentMemberId, setCurrentMemberId,
      globalZoneFilter, setGlobalZoneFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
