import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OBJECTION_TAGS, type ObjectionTag } from "@/lib/crm10x/execution-engine";

export function ObjectionChipRow({
  value,
  onChange,
  className,
}: {
  value: ObjectionTag | null | undefined;
  onChange: (tag: ObjectionTag) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {OBJECTION_TAGS.map((tag) => (
        <Button
          key={tag}
          size="sm"
          variant={value === tag ? "default" : "outline"}
          className="h-7 rounded-full text-[11px] font-medium"
          onClick={() => onChange(tag)}
        >
          {tag.replace(/-/g, " ")}
        </Button>
      ))}
    </div>
  );
}
