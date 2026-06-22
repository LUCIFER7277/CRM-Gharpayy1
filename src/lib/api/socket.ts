// Single Socket.IO connection, shared across the app. Auto-reconnect.
// In local mode (no VITE_API_URL), we skip the network connection and pipe
// events from the localStorage adapter directly through the same listener fan-out.
import { io, type Socket } from "socket.io-client";
import { api, tokenStore } from "./client";
import { isLocalMode, onLocalEvent } from "./local-adapter";
import type { DomainEvent } from "@/contracts";

let socket: Socket | null = null;
let localBridgeInstalled = false;
const listeners = new Set<(e: DomainEvent) => void>();

const fanOut = (e: DomainEvent) => {
  listeners.forEach((l) => { try { l(e); } catch (err) { console.error("[ws]", err); } });
};

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (isLocalMode()) {
    if (!localBridgeInstalled) {
      onLocalEvent(fanOut);
      localBridgeInstalled = true;
    }
    return null;
  }
  if (socket) return socket;
  socket = io(api.apiUrl, {
    transports: ["websocket"],
    autoConnect: true,
    auth: () => ({ token: tokenStore.get() }),
  });
  socket.on("evt", (e: DomainEvent) => fanOut(e));
  socket.on("connect_error", (err) => console.warn("[ws] connect_error", err.message));
  return socket;
}

export function onEvent(cb: (e: DomainEvent) => void): () => void {
  getSocket(); // ensure local bridge is installed even if socket is null
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function subscribe(channel: string) {
  const s = getSocket();
  s?.emit("subscribe", channel);
  return () => s?.emit("unsubscribe", channel);
}
