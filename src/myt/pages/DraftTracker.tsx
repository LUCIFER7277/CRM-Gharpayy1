import { useAppState } from '@/myt/lib/app-context';
import { Phone, FileText } from 'lucide-react';

export default function DraftTracker() {
  const { tours } = useAppState();
  const draftTours = tours.filter(t => t.outcome === 'draft');

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Draft Tracker</h1>
        <p className="text-xs md:text-sm text-muted-foreground">{draftTours.length} drafts need rent agreement follow-up</p>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {draftTours.map(t => (
          <div key={t.id} className="glass-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground text-sm">{t.leadName}</span>
              <span className="text-xs text-muted-foreground">₹{t.budget.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.propertyName} · {t.assignedToName}</p>
            <p className="text-xs text-muted-foreground">{t.phone}</p>
            {t.remarks && <p className="text-[10px] text-muted-foreground italic">"{t.remarks}"</p>}
            <div className="flex gap-2 pt-1">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary/10 text-primary text-xs font-medium">
                <Phone className="h-3.5 w-3.5" /> Call
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-hr/10 text-role-hr text-xs font-medium">
                <FileText className="h-3.5 w-3.5" /> Agreement
              </button>
            </div>
          </div>
        ))}
        {draftTours.length === 0 && <p className="text-center text-muted-foreground py-8">No drafts to track</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground bg-surface-2/50">
                <th className="text-left py-3 px-4 font-medium">Lead</th>
                <th className="text-left py-3 px-2 font-medium">Phone</th>
                <th className="text-left py-3 px-2 font-medium">Property</th>
                <th className="text-left py-3 px-2 font-medium">TCM</th>
                <th className="text-left py-3 px-2 font-medium">Date</th>
                <th className="text-left py-3 px-2 font-medium">Budget</th>
                <th className="text-left py-3 px-2 font-medium">Remarks</th>
                <th className="text-left py-3 px-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {draftTours.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-2.5 px-4 font-medium text-foreground">{t.leadName}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">{t.phone}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">{t.propertyName}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">{t.assignedToName}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">{t.tourDate}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">₹{t.budget.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-muted-foreground text-xs">{t.remarks || '-'}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20"><Phone className="h-3.5 w-3.5" /></button>
                      <button className="p-1.5 rounded-md bg-hr/10 text-role-hr hover:bg-hr/20"><FileText className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
