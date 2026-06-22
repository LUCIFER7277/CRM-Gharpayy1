import { useAppState } from '@/myt/lib/app-context';
import { getMemberPerformance } from '@/myt/lib/mock-data';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowRight } from 'lucide-react';

export default function Funnel() {
  const { tours, bookings } = useAppState();

  const scheduled = tours.length;
  const showUps = tours.filter(t => t.showUp === true).length;
  const drafts = tours.filter(t => t.outcome === 'draft').length;
  const bookingsViaTour = bookings.filter(b => b.viaTour).length;
  const directBookings = bookings.filter(b => !b.viaTour).length;

  const steps = [
    { label: 'Tours Scheduled', value: scheduled, color: 'text-primary' },
    { label: 'Show-Ups', value: showUps, color: 'text-role-tcm', rate: scheduled > 0 ? Math.round((showUps / scheduled) * 100) : 0 },
    { label: 'Drafts', value: drafts, color: 'text-role-hr', rate: showUps > 0 ? Math.round((drafts / showUps) * 100) : 0 },
    { label: 'Bookings (via Tour)', value: bookingsViaTour, color: 'text-role-tcm', rate: drafts > 0 ? Math.round((bookingsViaTour / drafts) * 100) : 0 },
  ];

  const memberPerf = getMemberPerformance(tours);
  const memberBookings = bookings.reduce((acc, b) => {
    acc[b.closedBy] = (acc[b.closedBy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const memberRent = bookings.reduce((acc, b) => {
    acc[b.closedBy] = (acc[b.closedBy] || 0) + b.rentValue;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Funnel</h1>
        <p className="text-xs text-muted-foreground">Full pipeline: Tour → Booking</p>
      </div>

      {/* Funnel visualization */}
      <div className="glass-card p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
              <div className="glass-card p-3 md:p-4 text-center flex-1 md:flex-none md:min-w-[140px]">
                <p className={cn('text-2xl md:text-3xl font-heading font-bold', step.color)}>{step.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{step.label}</p>
                {step.rate !== undefined && (
                  <p className="text-[10px] text-muted-foreground">({step.rate}% conv)</p>
                )}
              </div>
              {i < steps.length - 1 && (
                <>
                  <ArrowDown className="h-5 w-5 text-muted-foreground md:hidden" />
                  <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block mx-2" />
                </>
              )}
            </div>
          ))}
        </div>

        {directBookings > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              + <span className="text-foreground font-medium">{directBookings}</span> Direct Bookings (no tour)
            </p>
          </div>
        )}
      </div>

      {/* Who Is Converting */}
      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Who Is Converting</h3>
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <table className="w-full text-xs md:text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Name</th>
                <th className="text-center py-2 font-medium">Tours</th>
                <th className="text-center py-2 font-medium">Show%</th>
                <th className="text-center py-2 font-medium">Drafts</th>
                <th className="text-center py-2 font-medium">Bookings</th>
                <th className="text-center py-2 font-medium">Rent</th>
              </tr>
            </thead>
            <tbody>
              {memberPerf
                .filter(m => m.toursScheduled > 0 || (memberBookings[m.memberId] || 0) > 0)
                .sort((a, b) => (memberBookings[b.memberId] || 0) - (memberBookings[a.memberId] || 0))
                .slice(0, 15)
                .map(m => (
                  <tr key={m.memberId} className="border-b border-border/50">
                    <td className="py-2 text-foreground font-medium">{m.name}</td>
                    <td className="text-center text-muted-foreground">{m.toursScheduled}</td>
                    <td className={cn('text-center font-medium', m.showUpRate >= 70 ? 'text-role-tcm' : 'text-danger')}>{m.showUpRate}%</td>
                    <td className="text-center text-role-hr font-medium">{m.drafts}</td>
                    <td className="text-center text-foreground font-medium">{memberBookings[m.memberId] || 0}</td>
                    <td className="text-center text-role-tcm font-medium">₹{(memberRent[m.memberId] || 0).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
