// Reusable Tasks panel for ANY entity - drop into Tour, Owner, Unit, Deal detail views.
// This is just an opinionated wrapper around <TodoPanel> with sensible defaults +
// a contextual heading so users instantly understand the scope.
import { TodoPanel } from "@/components/todos/TodoPanel";
import type { TodoEntityType } from "@/contracts";

interface Props {
  entityType: TodoEntityType;
  entityId: string;
  entityLabel?: string;
  currentUserId?: string;
  assignees?: { id: string; label: string }[];
}

export function EntityTasks({ entityType, entityId, entityLabel, currentUserId, assignees = [] }: Props) {
  return (
    <div className="space-y-2">
      {entityLabel && (
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Tasks scoped to {entityType}: <span className="text-foreground normal-case">{entityLabel}</span>
        </p>
      )}
      <TodoPanel
        entityType={entityType}
        entityId={entityId}
        currentUserId={currentUserId}
        assignees={assignees}
      />
    </div>
  );
}
