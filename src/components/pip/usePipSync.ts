// Cross-window sync between the main tab and the PiP window.
// Uses BroadcastChannel - works inside a documentPictureInPicture child window
// because the channel is a window-agnostic global (each window opens its own
// channel of the same name and they receive each other's messages).
//
// Currently keeps the active route path in lockstep so navigating in one
// surface mirrors to the other. Easy to extend with payload kinds.
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

export type SyncMessage =
  | { type: "ROUTE"; path: string; from: string }
  | { type: "FILTER_UPDATE"; payload: Record<string, unknown>; from: string }
  | { type: "LEAD_TOUCHED"; ulid: string; from: string };

const CHANNEL_NAME = "lead-sync";
const SELF_ID = `${typeof window !== "undefined" ? (window.name || "main") : "main"}-${Math.random().toString(36).slice(2, 8)}`;

export function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

/**
 * Mount inside both AppShell roots (main tab + PiP child). It mirrors route
 * changes in either direction without infinite loops via origin tagging.
 */
export function usePipRouteSync(enabled: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const ch = getSyncChannel();
    if (!ch) return;
    channelRef.current = ch;

    const onMessage = (e: MessageEvent<SyncMessage>) => {
      const msg = e.data;
      if (!msg || msg.from === SELF_ID) return;
      if (msg.type === "ROUTE" && msg.path !== location.pathname) {
        lastBroadcastRef.current = msg.path; // suppress re-broadcast
        navigate({ to: msg.path });
      }
    };
    ch.addEventListener("message", onMessage);
    return () => {
      ch.removeEventListener("message", onMessage);
      ch.close();
      channelRef.current = null;
    };
  }, [enabled, location.pathname, navigate]);

  // Broadcast our route changes outward
  useEffect(() => {
    if (!enabled || !channelRef.current) return;
    if (lastBroadcastRef.current === location.pathname) return;
    lastBroadcastRef.current = location.pathname;
    const msg: SyncMessage = { type: "ROUTE", path: location.pathname, from: SELF_ID };
    channelRef.current.postMessage(msg);
  }, [enabled, location.pathname]);
}

export const SYNC_SELF_ID = SELF_ID;
