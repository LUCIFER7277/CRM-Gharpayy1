import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";

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

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setProperties]);

  return null;
}
