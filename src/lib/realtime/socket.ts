import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Use singleton socket instance
let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(
      (import.meta.env.VITE_WS_URL as string) || 
      (import.meta.env.VITE_API_URL as string) || 
      "", 
      {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      }
    );
  }
  return socket;
}

export function useSocketSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    s.connect();

    s.on("connect", () => {
      // Invalidate on reconnect to heal any missed state
      queryClient.invalidateQueries();
    });

    s.on("LEAD_UPDATED", (payload: { leadId: string; patch: any; actorId?: string }) => {
      // Only invalidate if from another actor, otherwise optimistic updates handled it
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    });

    s.on("TOUR_SCHEDULED", () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    });

    // Dedicated War Room channels for high-density minimalist UI updates
    s.on("WAR_ROOM_UPDATE", (payload: { tourId: string; patch: any }) => {
      // Instant synchronization for tour state changes
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    });

    s.on("WAR_ROOM_SYNC", () => {
      // Full sync event triggered periodically or on reconnect
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    });

    s.on("QUOTE_SENT", () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    });

    s.on("SLA_BREACHED", (payload: { leadId: string; reason: string }) => {
      toast.warning(`SLA Breached: ${payload.reason}`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    });

    return () => {
      s.off("connect");
      s.off("LEAD_UPDATED");
      s.off("TOUR_SCHEDULED");
      s.off("WAR_ROOM_UPDATE");
      s.off("WAR_ROOM_SYNC");
      s.off("QUOTE_SENT");
      s.off("SLA_BREACHED");
      s.disconnect();
    };
  }, [queryClient]);
}
