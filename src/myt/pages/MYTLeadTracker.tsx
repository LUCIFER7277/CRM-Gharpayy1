import { useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { zones, teamMembers } from '@/myt/lib/mock-data';
import { Lead } from '@/myt/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Plus, Phone, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from '@/shims/react-router-dom';
import { RequestAccessSheet } from '@/components/leads/RequestAccessSheet';
import { useIdentityStore } from '@/lib/lead-identity/store';
import { QuickAddLeadPanel } from '@/components/leads/QuickAddLeadPanel';
import { useLiveLeads } from '@/hooks/useLiveLeads';
import { ConfidenceBar, IntentChip, StageBadge } from '@/components/atoms';
import { formatDistanceToNow } from 'date-fns';
import { useMountedNow } from '@/hooks/use-now';
import { useUserMap } from '@/hooks/useUserMap';

export default function MYTLeadTracker() {
  const { setLeads } = useAppState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'quick' | 'manual' | 'requests'>('quick');
  const identityLeadCount = useIdentityStore((s) => s.leads.length);
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', area: '', budget: '10000',
    moveInDate: '', dateConfirmed: false,
  });

  // Live leads from backend (role-filtered server-side).
  const { leads: liveLeads, loading: liveLoading } = useLiveLeads();
  const userMap = useUserMap();
  const [, mounted] = useMountedNow();

  // A "qualified" live lead = budget >= 7000, in a covered zone, has move-in date.
  const qualified = liveLeads.filter((l) => l.budget >= 7000 && l.moveInDate && zones.some((z) => z.area.toLowerCase() === (l.preferredArea ?? '').toLowerCase()));
  const unqualified = liveLeads.filter((l) => !qualified.includes(l));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('The legacy manual MYT form is disabled - please use Quick Add (saves to backend).');
    setShowForm(false);
  };

  const pushToTour = (lead: typeof liveLeads[number]) => {
    navigate('/myt/schedule', { state: { lead } });
  };

  const selectClass = "w-full h-10 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground";

  // Shared lead card row - same layout as /leads
  const LeadRow = ({ l }: { l: typeof liveLeads[number] }) => {
    const assignee = l.assignedTcmId ? userMap.get(l.assignedTcmId) : null;
    return (
      <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors border-b border-border last:border-0">
        <div className="col-span-3">
          <div className="font-medium text-sm">{l.name}</div>
          <div className="text-[11px] text-muted-foreground">{l.phone} · {l.source ?? 'manual'}</div>
        </div>
        <div className="col-span-2"><StageBadge stage={l.stage as any} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <IntentChip intent={l.intent as any} />
          <ConfidenceBar value={l.confidence ?? 50} />
        </div>
        <div className="col-span-2 text-xs">
          <div>{l.preferredArea}</div>
          <div className="text-muted-foreground">₹{((l.budget ?? 0) / 1000).toFixed(0)}k</div>
        </div>
        <div className="col-span-2 text-xs">
          <div>{assignee?.name ?? '-'}</div>
          <div className="text-muted-foreground capitalize">{assignee?.role ?? '-'}</div>
        </div>
        <div className="col-span-1 text-right text-[11px] text-muted-foreground">
          {mounted ? formatDistanceToNow(new Date(l.updatedAt ?? l.createdAt), { addSuffix: true }) : '-'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Compact header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-heading font-bold text-foreground leading-tight">MYT Lead Tracker</h1>
          <p className="text-[11px] text-muted-foreground">
            Paste any format · auto-dedup against {identityLeadCount} unified leads
          </p>
        </div>
      </div>

      {/* Mode tabs + inline KPIs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-2">
        <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-surface-2/50">
          <button onClick={() => setMode('quick')} className={`px-3 py-1 text-[11px] rounded-md inline-flex items-center gap-1 ${mode === 'quick' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Sparkles className="h-3 w-3" />Quick Add
          </button>
          <button onClick={() => setMode('manual')} className={`px-3 py-1 text-[11px] rounded-md ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Manual
          </button>
          <button onClick={() => setMode('requests')} className={`px-3 py-1 text-[11px] rounded-md ${mode === 'requests' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Requests
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-role-tcm/30 bg-role-tcm/10 px-2.5 py-1 text-[11px] text-role-tcm">
            <CheckCircle className="h-3 w-3" />
            <span className="font-semibold">{qualified.length}</span> MYT Qualified
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] text-danger">
            <XCircle className="h-3 w-3" />
            <span className="font-semibold">{unqualified.length}</span> Not Qualified
          </span>
        </div>
      </div>

      {mode === 'quick' && (
        <div className="rounded-lg border border-border bg-surface-2/40 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Unified Quick Add - paste, manual, and dedup all flow through the same questions.
          </p>
          <Button size="sm" onClick={() => setShowQuickAdd(true)} className="h-8 text-xs gap-1.5 shrink-0">
            <Zap className="h-3.5 w-3.5" /> Open Quick Add
          </Button>
        </div>
      )}
      {mode === 'requests' && <RequestAccessSheet />}
      {mode === 'manual' && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> {showForm ? 'Hide form' : 'Manual MYT form'}
          </Button>
        </div>
      )}

      {/* Add Lead Form */}
      {mode === 'manual' && showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required className="bg-surface-2 border-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Area</Label>
              <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} className={selectClass}>
                <option value="">Select Area</option>
                {zones.map(z => <option key={z.id} value={z.area}>{z.area}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Budget (₹)</Label>
              <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="bg-surface-2 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Move-in Date</Label>
              <Input type="date" value={form.moveInDate} onChange={e => setForm(f => ({ ...f, moveInDate: e.target.value }))} required className="bg-surface-2 border-border" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={form.dateConfirmed} onChange={e => setForm(f => ({ ...f, dateConfirmed: e.target.checked }))} className="rounded" />
            Date confirmed by lead
          </label>
          <Button type="submit" className="w-full">Add & Qualify Lead</Button>
        </form>
      )}

      {/* Qualified Leads */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/40">
          <CheckCircle className="h-3.5 w-3.5 text-role-tcm" />
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-role-tcm">MYT Qualified - Push to Tour</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-medium">{qualified.length} leads</span>
        </div>
        {/* Column headers */}
        <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/20">
          <div className="col-span-3">Lead</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-2">Intent · score</div>
          <div className="col-span-2">Area · budget</div>
          <div className="col-span-2">Assigned</div>
          <div className="col-span-1 text-right">Updated</div>
        </div>
        <div>
          {liveLoading && <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>}
          {!liveLoading && qualified.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No qualified leads yet</p>}
          {qualified.map(l => <LeadRow key={l._id} l={l} />)}
        </div>
      </div>

      {/* Unqualified */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/40">
          <XCircle className="h-3.5 w-3.5 text-danger" />
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-danger">Not Qualified</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-medium">{unqualified.length} leads</span>
        </div>
        {/* Column headers */}
        <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/20">
          <div className="col-span-3">Lead</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-2">Intent · score</div>
          <div className="col-span-2">Area · budget</div>
          <div className="col-span-2">Assigned</div>
          <div className="col-span-1 text-right">Updated</div>
        </div>
        <div>
          {!liveLoading && unqualified.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">All leads are qualified!</p>}
          {unqualified.map(l => <LeadRow key={l._id} l={l} />)}
        </div>
      </div>

      <QuickAddLeadPanel open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </div>
  );
}

