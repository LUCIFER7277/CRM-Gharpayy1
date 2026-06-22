import { useAppState } from '@/myt/lib/app-context';
import { getZonePerformance, zones, teamMembers } from '@/myt/lib/mock-data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function ZonePerformance() {
  const { tours } = useAppState();
  const zonePerf = getZonePerformance(tours);

  const chartData = zonePerf.map(z => ({
    name: z.zoneName.split(' - ')[1],
    tours: z.toursScheduled,
    completed: z.toursCompleted,
    drafts: z.drafts,
  }));

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up">
      <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">Zone Performance</h1>

      <div className="glass-card p-3 md:p-5">
        <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Tours by Zone</h3>
        <div className="h-48 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(215 12% 50%)', fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ background: 'hsl(220 18% 12%)', border: '1px solid hsl(220 14% 16%)', borderRadius: '8px', fontSize: '11px', color: 'hsl(210 20% 92%)' }} />
              <Bar dataKey="tours" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} opacity={0.8} name="Scheduled" />
              <Bar dataKey="completed" fill="hsl(152 69% 45%)" radius={[3, 3, 0, 0]} opacity={0.8} name="Completed" />
              <Bar dataKey="drafts" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} opacity={0.8} name="Drafts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {zonePerf.map(z => {
          const zoneMembers = teamMembers.filter(m => m.zoneId === z.zoneId);
          const flowCount = zoneMembers.filter(m => m.role === 'flow-ops').length;
          const tcmCount = zoneMembers.filter(m => m.role === 'tcm').length;

          return (
            <div key={z.zoneId} className="glass-card p-4">
              <h3 className="font-heading font-semibold text-foreground text-sm mb-0.5">{z.zoneName.split(' - ')[1]}</h3>
              <p className="text-[10px] text-muted-foreground mb-3">{flowCount} Flow Ops · {tcmCount} TCM</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Tours</span><span className="text-foreground font-medium">{z.toursScheduled}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="text-foreground font-medium">{z.toursCompleted}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Show-Up</span>
                  <span className={cn('font-medium', z.showUpRate >= 70 ? 'text-role-tcm' : z.showUpRate >= 50 ? 'text-role-hr' : 'text-danger')}>{z.showUpRate}%</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Drafts</span><span className="text-role-hr font-medium">{z.drafts}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
