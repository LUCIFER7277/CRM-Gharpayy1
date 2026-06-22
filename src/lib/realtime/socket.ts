import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Use singleton socket instance
let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io((import.meta.env.VITE_WS_URL as string) || "", {
      autoConnect: false,
      reconnection: true,
    });
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
      // In a real app we might check actorId against currentUser
    });

    s.on("TOUR_SCHEDULED", () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
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
      s.off("QUOTE_SENT");
      s.off("SLA_BREACHED");
      s.disconnect();
    };
  }, [queryClient]);
}
