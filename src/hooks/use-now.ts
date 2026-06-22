import { useEffect, useState } from "react";

/**
 * Live clock that re-renders consumers every `intervalMs`. Default 30s.
 *
 * Returns 0 on SSR + first client render to avoid hydration mismatches.
 * Use `useNow() || Date.now()` only in non-rendering paths (logic, not JSX).
 * For rendered timestamps use `useMountedNow()` and gate with the boolean.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Returns [now, mounted]. Renders dependent on `now` should check `mounted`. */
export function useMountedNow(intervalMs = 30_000): [number, boolean] {
  const [state, setState] = useState<{ now: number; mounted: boolean }>({ now: 0, mounted: false });
  useEffect(() => {
    setState({ now: Date.now(), mounted: true });
    const id = setInterval(() => setState({ now: Date.now(), mounted: true }), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return [state.now, state.mounted];
}
