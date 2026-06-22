import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Two clients: one for general use, one for pub/sub (ioredis requires separate connections).
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisPub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisSub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const REDIS_CHANNELS = {
  events: "evt",
} as const;
