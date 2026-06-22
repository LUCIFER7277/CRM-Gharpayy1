import { Server as SocketServer, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { FastifyInstance } from "fastify";
import { redisPub, redisSub, REDIS_CHANNELS } from "../db/redis.js";
import { verifyToken, type JwtClaims } from "../auth/auth.js";
import { corsOrigins } from "../config/env.js";
import type { DomainEvent } from "../../../src/contracts/events.js";
import { eventsAfter } from "./event-bus.js";

export let io: SocketServer | null = null;

const MAX_AD_HOC_ROOMS = 50;       // cap per socket; LRU-evict on overflow
const REPLAY_CAP_PER_AGG = 500;    // beyond this, client must refetch snapshot

function isAllowedSocketOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) return true;
  if (process.env.NODE_ENV === "development" && /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) {
    return true;
  }
  return false;
}

interface SocketState {
  user: JwtClaims;
  adHocRooms: string[];            // lru: oldest first
  // De-dup outbound: a single delivery may arrive twice (Redis adapter retry,
  // multiple matching rooms). Track last 500 event IDs delivered.
  recentEventIds: Set<string>;
  recentOrder: string[];
}

function rememberEvent(state: SocketState, evtId: string): boolean {
  if (state.recentEventIds.has(evtId)) return false;
  state.recentEventIds.add(evtId);
  state.recentOrder.push(evtId);
  if (state.recentOrder.length > 500) {
    const drop = state.recentOrder.shift();
    if (drop) state.recentEventIds.delete(drop);
  }
  return true;
}

function evictOldestIfNeeded(socket: Socket, state: SocketState) {
  while (state.adHocRooms.length > MAX_AD_HOC_ROOMS) {
    const evict = state.adHocRooms.shift();
    if (evict) {
      socket.leave(evict);
      socket.emit("room.evicted", { room: evict, reason: "ad-hoc room cap" });
    }
  }
}

export async function attachSocketIO(app: FastifyInstance) {
  io = new SocketServer(app.server, {
    cors: {
      origin: (origin, cb) => cb(null, isAllowedSocketOrigin(origin)),
      credentials: true,
    },
    transports: ["websocket", "polling"],
    // Idle WS gets pinged every 25s; client without pong in 60s = dead.
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });
  io.adapter(createAdapter(redisPub, redisSub));

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined)
      ?? (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error("UNAUTHENTICATED"));
    try {
      const claims = await verifyToken(token);
      const state: SocketState = {
        user: claims, adHocRooms: [], recentEventIds: new Set(), recentOrder: [],
      };
      (socket.data as { state: SocketState }).state = state;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const state = (socket.data as { state: SocketState }).state;
    const user = state.user;

    // Always-joined rooms. These are NOT counted against the ad-hoc cap.
    socket.join(`user:${user.sub}`);
    socket.join(`tenant:${user.tenantId}:leads`);
    if (user.zoneId) socket.join(`zone:${user.zoneId}`);

    // ----- Reconnect / replay: client sends { lastSeqs: { 'lead:<id>': seq, ... } }
    const lastSeqs = (socket.handshake.auth?.lastSeqs ?? {}) as Record<string, number>;
    if (lastSeqs && typeof lastSeqs === "object") {
      for (const [k, seq] of Object.entries(lastSeqs)) {
        const [aggregateType, aggregateId] = k.split(":");
        if (!aggregateType || !aggregateId) continue;
        try {
          const missed = await eventsAfter(aggregateType, aggregateId, Number(seq) || 0, REPLAY_CAP_PER_AGG + 1);
          if (missed.length > REPLAY_CAP_PER_AGG) {
            // Too far behind — tell client to drop & refetch from /api/queries/*.
            socket.emit("evt.snapshot_required", { aggregateType, aggregateId });
            continue;
          }
          for (const m of missed) {
            if (rememberEvent(state, m._id)) socket.emit("evt", m);
          }
        } catch (err) {
          app.log.error({ err, k }, "[ws] replay failed for aggregate");
        }
      }
    }

    socket.on("subscribe", (channel: string) => {
      const allowed = /^(lead|tour|zone|user):[A-Za-z0-9_-]+(:.+)?$/.test(channel);
      if (!allowed) return;
      // Ad-hoc rooms (lead:<id>, tour:<id>) are bounded; tenant/zone/user rooms
      // are static and joined at connect.
      if (channel.startsWith("lead:") || channel.startsWith("tour:")) {
        // refresh LRU
        const idx = state.adHocRooms.indexOf(channel);
        if (idx >= 0) state.adHocRooms.splice(idx, 1);
        state.adHocRooms.push(channel);
        evictOldestIfNeeded(socket, state);
      }
      socket.join(channel);
    });
    socket.on("unsubscribe", (channel: string) => {
      socket.leave(channel);
      const idx = state.adHocRooms.indexOf(channel);
      if (idx >= 0) state.adHocRooms.splice(idx, 1);
    });

    // Token rotation without dropping the socket.
    socket.on("auth.refresh", async (token: string) => {
      try {
        const claims = await verifyToken(token);
        state.user = claims;
        socket.emit("auth.refreshed", { ok: true });
      } catch {
        socket.emit("auth.refreshed", { ok: false });
        socket.disconnect(true);
      }
    });
  });

  // Bridge Redis pub/sub → Socket.IO rooms. Per-socket dedup happens at delivery.
  await redisSub.subscribe(REDIS_CHANNELS.events);
  redisSub.on("message", (channel, raw) => {
    if (channel !== REDIS_CHANNELS.events) return;
    try {
      const evt = JSON.parse(raw) as DomainEvent & { aggregateType?: string; aggregateId?: string; seq?: number };
      const tenantRoom = `tenant:${evt.tenantId}:leads`;
      io!.to(tenantRoom).emit("evt", evt);
      if (evt.aggregateType && evt.aggregateId) {
        io!.to(`${evt.aggregateType}:${evt.aggregateId}`).emit("evt", evt);
      }
    } catch (err) {
      app.log.error({ err }, "[ws] bad event payload");
    }
  });
}
