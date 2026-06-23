import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { Todo, DomainEvent } from "@/contracts";

export function LiveTodosBridge() {
  const setTodos = useApp((s) => s.setTodos);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.todos.list({ scope: "all", limit: "200" });
        if (cancelled) return;
        setTodos((r.items ?? []) as Todo[]);
      } catch (e) {
        console.warn("[LiveTodosBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      if (!e.type.startsWith("evt.todo.")) return;
      void load();
    });

    return () => { cancelled = true; off(); };
  }, [setTodos]);

  return null;
}
