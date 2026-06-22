import { useEffect, useCallback, useState } from "react";

export function useImpactQueueKeyboard({
  leadIds,
  enabled,
  onOpenLead,
}: {
  leadIds: string[];
  enabled: boolean;
  onOpenLead: (leadId: string) => void;
}) {
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    setFocusIndex((i) => Math.min(i, Math.max(0, leadIds.length - 1)));
  }, [leadIds.length]);

  const focusLeadId = leadIds[focusIndex] ?? null;

  const move = useCallback(
    (delta: number) => {
      if (leadIds.length === 0) return;
      setFocusIndex((i) => {
        const next = i + delta;
        if (next < 0) return leadIds.length - 1;
        if (next >= leadIds.length) return 0;
        return next;
      });
    },
    [leadIds.length],
  );

  useEffect(() => {
    if (!enabled) return;

    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ev.key === "j" || ev.key === "J") {
        ev.preventDefault();
        move(1);
      } else if (ev.key === "k" || ev.key === "K") {
        ev.preventDefault();
        move(-1);
      } else if (ev.key === "Enter" && focusLeadId) {
        ev.preventDefault();
        onOpenLead(focusLeadId);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, move, focusLeadId, onOpenLead]);

  return { focusLeadId, focusIndex };
}
