import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { heatmapData } from '@/myt/lib/mock-data';

export function HourlyHeatmap() {
  const maxTours = Math.max(...heatmapData.map(d => d.tours));

  return (
    <div className="glass-card p-3 md:p-5">
      <h3 className="font-heading font-semibold text-xs md:text-sm mb-3 text-foreground">Hourly Heatmap</h3>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={heatmapData} barCategoryGap="15%">
            <XAxis dataKey="hour" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fill: 'hsl(215 12% 50%)', fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
            <Tooltip
              contentStyle={{
                background: 'hsl(220 18% 12%)',
                border: '1px solid hsl(220 14% 16%)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'hsl(210 20% 92%)',
              }}
            />
            <Bar dataKey="tours" radius={[3, 3, 0, 0]} name="Tours">
              {heatmapData.map((entry, i) => (
                <Cell key={i} fill={`hsl(217 91% ${40 + (entry.tours / maxTours) * 30}%)`} opacity={0.4 + (entry.tours / maxTours) * 0.6} />
              ))}
            </Bar>
            <Bar dataKey="showUps" radius={[3, 3, 0, 0]} fill="hsl(152 69% 45%)" opacity={0.7} name="Show-ups" />
            <Bar dataKey="drafts" radius={[3, 3, 0, 0]} fill="hsl(38 92% 50%)" opacity={0.7} name="Drafts" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
