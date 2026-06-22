import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children only after hydration to avoid SSR/CSR text mismatches
 * (e.g. timezone-sensitive date formatters).
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
