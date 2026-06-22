import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import type { HandoffMessage } from "@/lib/types";

function toHandoff(raw: Record<string, unknown>): HandoffMessage {
  return {
    id: (raw._id ?? raw.id) as string,
    leadId: raw.leadId as string,
    ts: raw.ts as string,
    from: raw.from as HandoffMessage["from"],
    fromId: raw.fromId as string,
    to: raw.to as HandoffMessage["to"],
    text: (raw.text ?? "") as string,
    priority: (raw.priority ?? "normal") as HandoffMessage["priority"],
    read: (raw.read ?? false) as boolean,
  };
}

export function LiveHandoffsBridge() {
  const setHandoffs = useApp((s) => s.setHandoffs);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.handoffs.list({ limit: 200 });
        if (cancelled) return;
        setHandoffs((r.items ?? []).map(toHandoff));
      } catch (e) {
        console.warn("[LiveHandoffsBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setHandoffs]);

  return null;
}
