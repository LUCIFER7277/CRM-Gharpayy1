import { useEffect, useState } from "react";
import { recentFeed, subscribe, type ConnectorEvent } from "@/lib/connectors";

/**
 * Subscribe to the cross-role connector feed. Re-renders only when a new
 * event arrives. Returns the most recent `limit` events.
 */
export function useConnectorFeed(limit = 30): ConnectorEvent[] {
  const [feed, setFeed] = useState<ConnectorEvent[]>([]);
  useEffect(() => {
    setFeed(recentFeed(limit));
    const unsub = subscribe(() => setFeed(recentFeed(limit)));
    return unsub;
  }, [limit]);
  return feed;
}
