import { useMemo, useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { scoreProperty } from '@/myt/lib/scoring';
import { PropertyCard } from '@/myt/components/PropertyCard';
import { SignalChip } from '@/myt/components/SignalChip';
import { UrgencyTimer } from '@/myt/components/UrgencyTimer';
import { zones } from '@/myt/lib/mock-data';
import { Search, Building2, Lock, Plus, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Property, Room, RoomType } from '@/myt/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RoomDraft {
  type: RoomType;
  bedsTotal: number;
  bedsOccupied: number;
  currentPrice: number;
}

const emptyRoomDraft = (price = 8000): RoomDraft => ({
  type: 'double',
  bedsTotal: 2,
  bedsOccupied: 0,
  currentPrice: price,
});

export default function PropertyCommandCenter() {
  const {
    tours, leads, blocks, globalZoneFilter,
    managedProperties, setManagedProperties,
    managedRooms, setManagedRooms,
  } = useAppState();

  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<'all' | 'hot' | 'balanced' | 'cold'>('all');
  const [selected, setSelected] = useState<Property | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const scoredProps = useMemo(() => {
    return managedProperties
      .map(p => ({ p, s: scoreProperty(p, managedRooms, tours, leads, blocks) }))
      .filter(({ p }) => !globalZoneFilter || p.zoneId === globalZoneFilter)
      .filter(({ p }) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.area.toLowerCase().includes(search.toLowerCase()))
      .filter(({ s }) => signalFilter === 'all' || s.signal === signalFilter)
      .sort((a, b) => b.s.demandScore - a.s.demandScore);
  }, [managedProperties, managedRooms, tours, leads, blocks, globalZoneFilter, search, signalFilter]);

  const totals = useMemo(() => {
    const all = managedProperties.map(p => scoreProperty(p, managedRooms, tours, leads, blocks));
    return {
      hot: all.filter(s => s.signal === 'hot').length,
      cold: all.filter(s => s.signal === 'cold').length,
      revenue: all.reduce((sum, s) => sum + s.revenueWeek, 0),
      missed: all.reduce((sum, s) => sum + s.missedRevenue, 0),
      blockedBeds: all.reduce((sum, s) => sum + s.bedsBlocked, 0),
    };
  }, [managedProperties, managedRooms, tours, leads, blocks]);

  const handleCreate = (property: Property, rooms: Room[]) => {
    setManagedProperties(prev => [...prev, property]);
    setManagedRooms(prev => [...prev, ...rooms]);
    setAddOpen(false);
    toast.success(`${property.name} added`);
  };

  const isEmpty = managedProperties.length === 0;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Property Command Center
          </h1>
          <p className="text-xs text-muted-foreground">
            Live demand, conversion & velocity - populated from your real properties.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-9">
              <Plus className="h-4 w-4" /> Add property
            </Button>
          </DialogTrigger>
          <AddPropertyDialog onCreate={handleCreate} />
        </Dialog>
      </div>

      {!isEmpty && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SummaryTile label="🔥 Hot" value={totals.hot} />
          <SummaryTile label="❄️ Cold" value={totals.cold} />
          <SummaryTile label="Beds Held" value={totals.blockedBeds} />
          <SummaryTile label="Revenue (7d)" value={`₹${(totals.revenue / 1000).toFixed(0)}k`} />
          <SummaryTile label="Missed (7d)" value={`₹${(totals.missed / 1000).toFixed(0)}k`} accent="danger" />
        </div>
      )}

      {!isEmpty && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search property or area…"
              className="pl-8 h-9 bg-surface-2 border-border text-xs"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'hot', 'balanced', 'cold'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSignalFilter(f)}
                className={cn(
                  'px-2.5 h-9 rounded-md text-[11px] font-medium uppercase tracking-wide transition-colors',
                  signalFilter === f ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEmpty ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {scoredProps.map(({ p, s }) => (
              <PropertyCard key={p.id} property={p} scores={s} onClick={() => setSelected(p)} />
            ))}
          </div>
          {scoredProps.length === 0 && (
            <div className="glass-card p-8 text-center text-sm text-muted-foreground">
              No properties match these filters.
            </div>
          )}
        </>
      )}

      {selected && (
        <PropertyDrawer property={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass-card p-10 md:p-14 text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Building2 className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-heading text-lg md:text-xl font-bold text-foreground">No properties yet</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Command Center stays clean until you add real properties. Once added, demand, conversion,
          velocity and revenue signals stream in live from tours, leads, and active holds.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>Zero seed data · everything you see is yours</span>
      </div>
      <Button onClick={onAdd} size="lg" className="gap-2">
        <Plus className="h-4 w-4" /> Add your first property
      </Button>
    </div>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string | number; accent?: 'danger' }) {
  return (
    <div className="glass-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'text-lg font-bold tabular-nums mt-0.5',
        accent === 'danger' ? 'text-danger' : 'text-foreground'
      )}>{value}</div>
    </div>
  );
}

function AddPropertyDialog({ onCreate }: { onCreate: (p: Property, rooms: Room[]) => void }) {
  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [basePrice, setBasePrice] = useState(8000);
  const [foodRating, setFoodRating] = useState(4);
  const [hygieneRating, setHygieneRating] = useState(4);
  const [amenitiesText, setAmenitiesText] = useState('WiFi, AC, Laundry, Power backup');
  const [photoCount, setPhotoCount] = useState(0);
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoomDraft()]);

  const zone = zones.find(z => z.id === zoneId);

  const submit = () => {
    if (!name.trim()) return toast.error('Property name is required');
    if (!zone) return toast.error('Select a zone');
    if (!ownerName.trim()) return toast.error('Owner name is required');
    if (rooms.length === 0) return toast.error('Add at least one room');

    const id = `prop-${Date.now()}`;
    const property: Property = {
      id,
      name: name.trim(),
      zoneId: zone.id,
      area: zone.area,
      address: address.trim() || zone.area,
      basePrice,
      foodRating,
      hygieneRating,
      amenities: amenitiesText.split(',').map(a => a.trim()).filter(Boolean),
      ownerName: ownerName.trim(),
      photoCount,
      pageViews: 0,
      shares: 0,
    };
    const builtRooms: Room[] = rooms.map((r, i) => ({
      id: `${id}-r${i + 1}`,
      propertyId: id,
      type: r.type,
      bedsTotal: r.bedsTotal,
      bedsOccupied: Math.min(r.bedsOccupied, r.bedsTotal),
      currentPrice: r.currentPrice,
    }));
    onCreate(property, builtRooms);
  };

  return (
    <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add property</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Property name *">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lakeview Residency" className="h-9 text-sm" />
          </Field>
          <Field label="Zone *">
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Address">
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, locality" className="h-9 text-sm" />
          </Field>
          <Field label="Owner name *">
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner / contact" className="h-9 text-sm" />
          </Field>
          <Field label="Base price (₹/bed/mo)">
            <Input type="number" value={basePrice} onChange={e => setBasePrice(+e.target.value || 0)} className="h-9 text-sm" />
          </Field>
          <Field label="Photos uploaded">
            <Input type="number" value={photoCount} onChange={e => setPhotoCount(+e.target.value || 0)} className="h-9 text-sm" />
          </Field>
          <Field label="Food rating (0–5)">
            <Input type="number" step="0.1" min={0} max={5} value={foodRating} onChange={e => setFoodRating(+e.target.value || 0)} className="h-9 text-sm" />
          </Field>
          <Field label="Hygiene rating (0–5)">
            <Input type="number" step="0.1" min={0} max={5} value={hygieneRating} onChange={e => setHygieneRating(+e.target.value || 0)} className="h-9 text-sm" />
          </Field>
        </div>

        <Field label="Amenities (comma separated)">
          <Textarea value={amenitiesText} onChange={e => setAmenitiesText(e.target.value)} className="min-h-16 text-sm" />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Rooms</Label>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setRooms(r => [...r, emptyRoomDraft(basePrice)])}>
              <Plus className="h-3 w-3" /> Add room
            </Button>
          </div>
          <div className="space-y-2">
            {rooms.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-md border border-border bg-surface-2 p-2">
                <div className="col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Type</Label>
                  <Select value={r.type} onValueChange={(v: RoomType) => setRooms(rs => rs.map((x, j) => j === i ? { ...x, type: v } : x))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="triple">Triple</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Beds</Label>
                  <Input type="number" min={1} value={r.bedsTotal} onChange={e => setRooms(rs => rs.map((x, j) => j === i ? { ...x, bedsTotal: +e.target.value || 1 } : x))} className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Occ.</Label>
                  <Input type="number" min={0} value={r.bedsOccupied} onChange={e => setRooms(rs => rs.map((x, j) => j === i ? { ...x, bedsOccupied: +e.target.value || 0 } : x))} className="h-8 text-xs" />
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Price ₹</Label>
                  <Input type="number" value={r.currentPrice} onChange={e => setRooms(rs => rs.map((x, j) => j === i ? { ...x, currentPrice: +e.target.value || 0 } : x))} className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Button size="sm" variant="ghost" className="h-8 w-full text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setRooms(rs => rs.filter((_, j) => j !== i))}
                    disabled={rooms.length === 1}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} className="w-full sm:w-auto">Save property</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PropertyDrawer({ property, onClose }: { property: Property; onClose: () => void }) {
  const { tours, leads, blocks, managedRooms } = useAppState();
  const scores = scoreProperty(property, managedRooms, tours, leads, blocks);
  const propRooms = managedRooms.filter(r => r.propertyId === property.id);
  const activeBlocks = blocks.filter(b => b.propertyId === property.id && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now());
  const recentTours = tours.filter(t => t.propertyName === property.name).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full md:max-w-2xl md:max-h-[85vh] max-h-[90vh] bg-card border border-border md:rounded-xl rounded-t-2xl mt-auto md:mt-0 overflow-y-auto"
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-foreground">{property.name}</h3>
              <SignalChip signal={scores.signal} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{property.address} · Owner: {property.ownerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Recommended Actions</h4>
            {scores.suggestedActions.map((a, i) => (
              <div key={i} className="text-xs text-foreground bg-primary/5 border border-primary/20 rounded px-3 py-2 flex items-start gap-2">
                <span>💡</span><span>{a}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Rooms ({propRooms.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {propRooms.map(r => {
                const blocksOnRoom = activeBlocks.filter(b => b.roomId === r.id).length;
                const free = r.bedsTotal - r.bedsOccupied - blocksOnRoom;
                return (
                  <div key={r.id} className="rounded-lg border border-border bg-surface-2 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground capitalize">{r.type}</span>
                      <span className="text-[10px] text-muted-foreground">₹{(r.currentPrice / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {free} free · {r.bedsOccupied} taken{blocksOnRoom > 0 && ` · ${blocksOnRoom} held`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {activeBlocks.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />Active Holds
              </h4>
              <div className="space-y-1.5">
                {activeBlocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs bg-surface-2 rounded px-3 py-2">
                    <span className="text-foreground">{b.leadName} <span className="text-muted-foreground">· {b.intent}</span></span>
                    <UrgencyTimer expiresAt={b.expiresAt} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentTours.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recent Tours</h4>
              <div className="space-y-1">
                {recentTours.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-surface-2 rounded px-3 py-1.5">
                    <span className="text-foreground truncate">{t.leadName}</span>
                    <span className="text-muted-foreground capitalize">{t.status} {t.outcome ? `· ${t.outcome}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unused props reference for ts-noUnusedLocals */}
          <span className="hidden">{leads.length}</span>
        </div>
      </div>
    </div>
  );
}
