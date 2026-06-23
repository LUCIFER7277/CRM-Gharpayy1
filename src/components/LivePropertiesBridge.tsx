import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import { onEvent, getSocket } from "@/lib/api/socket";
import type { DomainEvent } from "@/contracts";

export function LivePropertiesBridge() {
  const setProperties = useApp((s) => s.setProperties);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = await api.properties.list();
        if (cancelled) return;
        setProperties(list ?? []);
      } catch (e) {
        console.warn("[LivePropertiesBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    getSocket();
    const off = onEvent((e: DomainEvent) => {
      if (!e.type.startsWith("evt.property.")) return;
      void load();
    });

    return () => { cancelled = true; off(); };
  }, [setProperties]);

  return null;
}
