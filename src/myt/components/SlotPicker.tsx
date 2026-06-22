import { cn } from '@/lib/utils';
import { Tour } from '@/myt/lib/types';

interface Props {
  date: string;
  selected: string | null;
  onSelect: (time: string) => void;
  takenSlots: Set<string>;
  recommendEarly?: boolean;
}

const HOURS = ['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30'];

export function SlotPicker({ date, selected, onSelect, takenSlots, recommendEarly }: Props) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {HOURS.map((h, idx) => {
          const taken = takenSlots.has(h);
          const recommend = recommendEarly && !taken && idx < 4;
          const isSelected = selected === h;
          return (
            <button
              key={h}
              type="button"
              disabled={taken}
              onClick={() => onSelect(h)}
              className={cn(
                'h-9 rounded-md text-xs font-medium transition-all border',
                taken && 'bg-surface-3 text-muted-foreground/50 line-through cursor-not-allowed border-border/50',
                !taken && !isSelected && 'bg-surface-2 text-foreground border-border hover:border-primary/50',
                isSelected && 'bg-primary text-primary-foreground border-primary shadow-md',
                recommend && !isSelected && 'ring-1 ring-role-tcm/40 border-role-tcm/40',
              )}
            >
              {h}
            </button>
          );
        })}
      </div>
      {recommendEarly && (
        <p className="text-[10px] text-role-tcm mt-2 flex items-center gap-1">
          ⚡ Hard intent - earliest open slots highlighted
        </p>
      )}
    </div>
  );
}

export function getTakenSlotsForDate(tours: Tour[], memberId: string, date: string): Set<string> {
  const set = new Set<string>();
  tours
    .filter(t => t.assignedTo === memberId && t.tourDate === date && t.status !== 'cancelled')
    .forEach(t => set.add(t.tourTime));
  return set;
}
