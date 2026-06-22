// Connection status pill - drop into the header. Shows API + WebSocket state.
// In local mode (no VITE_API_URL), shows a "Local" badge instead.
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/api/socket";
import { api, tokenStore } from "@/lib/api/client";
import { isLocalMode } from "@/lib/api/local-adapter";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2, HardDrive } from "lucide-react";

type Status = "connecting" | "online" | "offline" | "no-auth" | "local";

export function VpsConnectionStatus() {
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let cancelled = false;
    if (isLocalMode()) { setStatus("local"); return; }
    if (!tokenStore.get()) { setStatus("no-auth"); return; }

    const ping = async () => {
      try { await api.health(); if (!cancelled) setStatus("online"); }
      catch { if (!cancelled) setStatus("offline"); }
    };
    void ping();
    const id = setInterval(ping, 15_000);

    const sock = getSocket();
    const onConnect = () => !cancelled && setStatus("online");
    const onDisconnect = () => !cancelled && setStatus("offline");
    if (sock) {
      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);
      sock.on("connect_error", onDisconnect);
    }

    return () => {
      cancelled = true;
      clearInterval(id);
      if (sock) {
        sock.off("connect", onConnect);
        sock.off("disconnect", onDisconnect);
        sock.off("connect_error", onDisconnect);
      }
    };
  }, []);

  const cfg = {
    online:     { icon: Wifi,      label: "VPS · live",     variant: "secondary" as const, color: "text-green-600" },
    offline:    { icon: WifiOff,   label: "VPS · offline",  variant: "outline" as const,   color: "text-destructive" },
    connecting: { icon: Loader2,   label: "VPS · …",        variant: "outline" as const,   color: "text-muted-foreground" },
    "no-auth":  { icon: WifiOff,   label: "Sign in",        variant: "outline" as const,   color: "text-muted-foreground" },
    local:      { icon: HardDrive, label: "Local mode",     variant: "outline" as const,   color: "text-muted-foreground" },
  }[status];

  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px] hidden md:inline-flex" title={`API: ${api.apiUrl} · ${status}`}>
      <cfg.icon className={`h-3 w-3 ${cfg.color} ${status === "connecting" ? "animate-spin" : ""}`} />
      {cfg.label}
    </Badge>
  );
}
