/**
 * Power-user keyboard layer. Centralised registry so multiple components
 * can register hotkeys without colliding. Returns an unsubscribe.
 */
type Handler = (e: KeyboardEvent) => void;
interface Binding { combo: string; description: string; handler: Handler; scope?: string; }

const bindings: Binding[] = [];
let installed = false;

function normalize(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

function install(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      // allow only mod-combos in inputs
      if (!(e.ctrlKey || e.metaKey)) return;
    }
    const key = normalize(e);
    for (const b of bindings) {
      if (b.combo === key) { e.preventDefault(); b.handler(e); break; }
    }
  });
}

export function registerHotkey(combo: string, description: string, handler: Handler, scope?: string): () => void {
  install();
  const b: Binding = { combo: combo.toLowerCase(), description, handler, scope };
  bindings.push(b);
  return () => {
    const i = bindings.indexOf(b);
    if (i >= 0) bindings.splice(i, 1);
  };
}

export function listHotkeys(): { combo: string; description: string; scope?: string }[] {
  return bindings.map(({ combo, description, scope }) => ({ combo, description, scope }));
}
