// Persistent shortlist: PGs the user is comparing or about to send.
// Stored in localStorage so it survives reloads — small but high-leverage CRO move.

import { useEffect, useState, useCallback } from "react";

const KEY = "gh_shortlist_v1";
const EVENT = "gh:shortlist:change";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* noop */ }
}

export function useShortlist() {
  const [ids, setIds] = useState<string[]>(() => read());

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-6);
    write(next);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, remove, clear, has, count: ids.length };
}
