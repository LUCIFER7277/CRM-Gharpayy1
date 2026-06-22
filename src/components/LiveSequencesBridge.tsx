import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api/client";
import type { ActiveSequence } from "@/lib/types";

function toSequence(raw: Record<string, unknown>): ActiveSequence {
  return {
    id: (raw._id ?? raw.id) as string,
    leadId: raw.leadId as string,
    kind: raw.kind as ActiveSequence["kind"],
    startedAt: (raw.startedAt ?? raw.createdAt ?? "") as string,
    currentStep: (raw.currentStep ?? 0) as number,
    paused: (raw.paused ?? false) as boolean,
    stoppedReason: (raw.stoppedReason ?? undefined) as string | undefined,
  };
}

export function LiveSequencesBridge() {
  const setSequences = useApp((s) => s.setSequences);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await api.sequences.list({ active: true, limit: 200 });
        if (cancelled) return;
        setSequences((r.items ?? []).map(toSequence));
      } catch (e) {
        console.warn("[LiveSequencesBridge] load failed:", (e as Error).message);
      }
    };

    void load();

    const interval = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setSequences]);

  return null;
}
