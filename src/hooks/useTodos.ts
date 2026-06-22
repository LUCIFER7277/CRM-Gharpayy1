// Realtime Todos hook - works for any (entityType, entityId) combo, OR
// for "my tasks" (where assignedTo === current user OR createdBy === current user
// with no assignee). Subscribes to Socket.IO evt.todo.* events.
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import { dispatch } from "@/lib/api/command-bus";
import type { Todo, DomainEvent, TodoEntityType } from "@/contracts";

export interface UseTodosOpts {
  entityType?: TodoEntityType;
  entityId?: string | null;
  scope?: "mine" | "entity";
}

export function useTodos(opts: UseTodosOpts = {}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (opts.entityType && opts.entityType !== "none") p.entityType = opts.entityType;
    if (opts.entityId) p.entityId = opts.entityId;
    if (opts.scope === "mine") p.scope = "mine";
    return p;
  }, [opts.entityType, opts.entityId, opts.scope]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.todos.list(params);
      setTodos(r.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [params]);

  useEffect(() => {
    getSocket();
    void refresh();
    const off = onEvent((e: DomainEvent) => {
      if (!e.type.startsWith("evt.todo.")) return;
      // Just refresh - todos volume is low and filter logic is non-trivial.
      void refresh();
    });
    return off;
  }, [refresh]);

  const create = useCallback(async (input: {
    title: string;
    notes?: string;
    priority?: "low" | "med" | "high" | "urgent";
    dueAt?: string | null;
    assignTo?: string | null;
  }) => {
    const result = await dispatch({
      type: "cmd.todo.create",
      payload: {
        title: input.title,
        notes: input.notes,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        entityType: opts.entityType ?? "none",
        entityId: opts.entityId ?? null,
        assignTo: input.assignTo ?? null,
      },
    });
    if (result.ok) {
      void refresh();
    }
    return result;
  }, [opts.entityType, opts.entityId, refresh]);

  const accept = useCallback(async (todoId: string) => {
    const result = await dispatch({ type: "cmd.todo.accept", payload: { todoId } });
    if (result.ok) void refresh();
    return result;
  }, [refresh]);

  const decline = useCallback(async (todoId: string, reason?: string) => {
    const result = await dispatch({ type: "cmd.todo.decline", payload: { todoId, reason } });
    if (result.ok) void refresh();
    return result;
  }, [refresh]);

  const complete = useCallback(async (todoId: string) => {
    const result = await dispatch({ type: "cmd.todo.complete", payload: { todoId } });
    if (result.ok) void refresh();
    return result;
  }, [refresh]);

  const cancel = useCallback(async (todoId: string) => {
    const result = await dispatch({ type: "cmd.todo.cancel", payload: { todoId } });
    if (result.ok) void refresh();
    return result;
  }, [refresh]);

  const assign = useCallback(async (todoId: string, assignTo: string) => {
    const result = await dispatch({ type: "cmd.todo.assign", payload: { todoId, assignTo } });
    if (result.ok) void refresh();
    return result;
  }, [refresh]);

  return { todos, loading, error, refresh, create, accept, decline, complete, cancel, assign };
}
