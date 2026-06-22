import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import type { Todo } from "@/contracts";

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

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setTodos]);

  return null;
}
