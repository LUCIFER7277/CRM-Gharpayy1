import { useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { teamMembers, zones } from '@/myt/lib/mock-data';
import { Booking, AgreementStatus } from '@/myt/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, IndianRupee, FileCheck, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const properties = [
  'Prestige Lakeside','Brigade Meadows','Sobha Dream Acres','Godrej Splendour',
  'Mantri Serenity','Puravankara Zenium','Salarpuria Sattva','Embassy Springs',
  'Total Environment','Raheja Residency','Adarsh Palm Retreat','Shriram Greenfield',
];

export default function Bookings() {
  const { bookings, setBookings } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leadName: '', phone: '', propertyName: '', area: '',
    rentValue: '12000', viaTour: true, closedBy: '',
  });

  const totalRent = bookings.reduce((s, b) => s + b.rentValue, 0);
  const signed = bookings.filter(b => b.agreementStatus === 'signed' || b.agreementStatus === 'moved-in').length;
  const movedIn = bookings.filter(b => b.agreementStatus === 'moved-in').length;
  const viaTour = bookings.filter(b => b.viaTour).length;

  const updateStatus = (id: string, status: AgreementStatus) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, agreementStatus: status } : b));
    toast.success(`Status updated to ${status}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const closer = teamMembers.find(m => m.id === form.closedBy);
    const newBooking: Booking = {
      id: `b${Date.now()}`,
      leadName: form.leadName,
      phone: form.phone,
      propertyName: form.propertyName,
      area: form.area,
      rentValue: parseInt(form.rentValue),
      viaTour: form.viaTour,
      tourId: null,
      agreementStatus: 'pending',
      closedBy: closer?.id || 'm1',
      closedByName: closer?.name || 'Unknown',
      createdAt: new Date().toISOString(),
    };
    setBookings(prev => [newBooking, ...prev]);
    toast.success('Booking logged');
    setShowForm(false);
  };

  const selectClass = "w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground";
  const statusColors: Record<AgreementStatus, string> = {
    pending: 'bg-warning/15 text-warning',
    signed: 'bg-primary/15 text-primary',
    'moved-in': 'bg-success/15 text-role-tcm',
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Bookings</h1>
          <p className="text-xs text-muted-foreground">Track commitments & revenue</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Log Booking
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="h-4 w-4 text-role-tcm" />
            <span className="text-[10px] text-muted-foreground">Total Rent</span>
          </div>
          <p className="text-lg font-heading font-bold text-foreground">₹{totalRent.toLocaleString()}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">Signed</span>
          </div>
          <p className="text-lg font-heading font-bold text-foreground">{signed}</p>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Home className="h-4 w-4 text-role-hr" />
            <span className="text-[10px] text-muted-foreground">Moved In</span>
          </div>
          <p className="text-lg font-heading font-bold text-foreground">{movedIn}</p>
        </div>
        <div className="glass-card p-3">
          <span className="text-[10px] text-muted-foreground">Via Tour</span>
          <p className="text-lg font-heading font-bold text-foreground">{viaTour}<span className="text-xs text-muted-foreground">/{bookings.length}</span></p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Lead Name</Label>
              <Input value={form.leadName} onChange={e => setForm(f => ({ ...f, leadName: e.target.value }))} required className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required className="bg-surface-2 border-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Property</Label>
              <select value={form.propertyName} onChange={e => setForm(f => ({ ...f, propertyName: e.target.value }))} className={selectClass}>
                <option value="">Select</option>
                {properties.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Area</Label>
              <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} className={selectClass}>
                <option value="">Select</option>
                {zones.map(z => <option key={z.id} value={z.area}>{z.area}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Rent (₹/mo)</Label>
              <Input type="number" value={form.rentValue} onChange={e => setForm(f => ({ ...f, rentValue: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Closed By</Label>
              <select value={form.closedBy} onChange={e => setForm(f => ({ ...f, closedBy: e.target.value }))} className={selectClass}>
                <option value="">Select Member</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground self-end pb-2">
              <input type="checkbox" checked={form.viaTour} onChange={e => setForm(f => ({ ...f, viaTour: e.target.checked }))} className="rounded" />
              Via Tour (not direct)
            </label>
          </div>
          <Button type="submit" className="w-full">Log Booking</Button>
        </form>
      )}

      {/* Booking list */}
      <div className="space-y-2">
        {bookings.map(b => (
          <div key={b.id} className="glass-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground text-sm">{b.leadName}</span>
                <span className="text-muted-foreground text-xs ml-2">{b.propertyName}</span>
              </div>
              <span className="text-sm font-heading font-bold text-role-tcm">₹{b.rentValue.toLocaleString()}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', statusColors[b.agreementStatus])}>
                {b.agreementStatus}
              </span>
              <span className="text-muted-foreground">{b.viaTour ? '🏠 Via Tour' : '📞 Direct'}</span>
              <span className="text-muted-foreground">Closed by: {b.closedByName}</span>
            </div>
            {b.agreementStatus !== 'moved-in' && (
              <div className="flex gap-2">
                {b.agreementStatus === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, 'signed')} className="h-7 text-[10px]">Mark Signed</Button>
                )}
                {b.agreementStatus === 'signed' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, 'moved-in')} className="h-7 text-[10px]">Mark Moved In</Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
