// Drop-in widget - embed inside any entity detail view to show + manage that entity's todos.
// Usage: <TodoPanel entityType="lead" entityId={lead._id} />
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Clock, ListTodo, UserPlus, X } from "lucide-react";
import { useTodos } from "@/hooks/useTodos";
import type { Todo, TodoEntityType } from "@/contracts";

interface Props {
  entityType: TodoEntityType;
  entityId: string;
  /** Optional: list of (id, label) users for assignment dropdown */
  assignees?: { id: string; label: string }[];
  currentUserId?: string;
}

export function TodoPanel({ entityType, entityId, assignees = [], currentUserId }: Props) {
  const { todos, loading, error, create, accept, decline, complete, cancel, assign } = useTodos({ entityType, entityId, scope: "entity" });
  const [title, setTitle] = useState("");
  const [assignTo, setAssignTo] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "med" | "high" | "urgent">("med");
  const [creating, setCreating] = useState(false);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><ListTodo className="h-4 w-4" /> Todos <Badge variant="secondary">{todos.length}</Badge></h3>
        {loading && <span className="text-xs text-muted-foreground">syncing…</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
        <Input placeholder="Add a todo (e.g. Call back at 5pm)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="med">Med</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        {assignees.length > 0 && (
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Assign to (self)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Myself</SelectItem>
              {assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button
          disabled={!title.trim() || creating}
          onClick={async () => {
            setCreating(true);
            const r = await create({ title: title.trim(), priority, assignTo: assignTo || null });
            setCreating(false);
            if (r.ok) { setTitle(""); setAssignTo(""); }
          }}
        >Add</Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="divide-y">
        {todos.map((t) => (
          <TodoRow key={t._id} todo={t} currentUserId={currentUserId} assignees={assignees}
            onAccept={() => accept(t._id)} onDecline={() => decline(t._id)}
            onComplete={() => complete(t._id)} onCancel={() => cancel(t._id)}
            onAssign={(uid) => assign(t._id, uid)} />
        ))}
        {!loading && todos.length === 0 && <p className="py-3 text-xs text-muted-foreground">No todos yet.</p>}
      </div>
    </Card>
  );
}

interface RowProps {
  todo: Todo;
  currentUserId?: string;
  assignees: { id: string; label: string }[];
  onAccept: () => void; onDecline: () => void; onComplete: () => void; onCancel: () => void;
  onAssign: (uid: string) => void;
}
function TodoRow({ todo, currentUserId, assignees, onAccept, onDecline, onComplete, onCancel, onAssign }: RowProps) {
  const mine = currentUserId && (todo.assignedTo === currentUserId || (todo.createdBy === currentUserId && !todo.assignedTo));
  const pendingForMe = todo.status === "pending-accept" && todo.assignedTo === currentUserId;
  const lookupName = (id: string | null) => id ? (assignees.find((a) => a.id === id)?.label ?? id.slice(-6)) : "-";
  return (
    <div className="py-2 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm flex items-center gap-2">
          <Badge variant={priorityVariant(todo.priority)}>{todo.priority}</Badge>
          <span className={todo.status === "done" ? "line-through text-muted-foreground" : ""}>{todo.title}</span>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="flex items-center gap-1"><UserPlus className="h-3 w-3" /> {lookupName(todo.assignedTo)}</span>
          {todo.dueAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(todo.dueAt).toLocaleString()}</span>}
          <Badge variant="outline" className="text-[10px]">{todo.status}</Badge>
        </div>
      </div>
      <div className="flex gap-1">
        {pendingForMe && <>
          <Button size="sm" variant="default" onClick={onAccept}><Check className="h-3 w-3 mr-1" />Accept</Button>
          <Button size="sm" variant="ghost" onClick={onDecline}><X className="h-3 w-3 mr-1" />Decline</Button>
        </>}
        {mine && (todo.status === "accepted" || todo.status === "open" || todo.status === "in-progress") && (
          <Button size="sm" variant="outline" onClick={onComplete}>Done</Button>
        )}
        {mine && todo.status !== "done" && todo.status !== "cancelled" && assignees.length > 0 && (
          <Select value="" onValueChange={onAssign}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Reassign" /></SelectTrigger>
            <SelectContent>{assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {mine && todo.status !== "done" && todo.status !== "cancelled" && (
          <Button size="sm" variant="ghost" onClick={onCancel}>×</Button>
        )}
      </div>
    </div>
  );
}

function priorityVariant(p: Todo["priority"]): "default" | "destructive" | "secondary" | "outline" {
  if (p === "urgent") return "destructive";
  if (p === "high") return "default";
  if (p === "med") return "secondary";
  return "outline";
}
