import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(here, "../../.env"),
  resolve(here, "../../../../.env"),
]) {
  loadDotenv({ path: envPath, override: false });
}

const Env = z.object({
  MONGO_URL: z.string().min(1),
  MONGO_DB: z.string().default("gharpayy"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be >=32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:3002"),
  DEFAULT_TENANT: z.string().default("gharpayy"),
  LOG_LEVEL: z.string().default("info"),

  // Super Admin bootstrap credentials (override in .env for production)
  SUPER_ADMIN_EMAIL: z.string().default("superadmin@gharpayy.com"),
  SUPER_ADMIN_PASSWORD: z.string().default("superadmin#gharpayy"),
  SUPER_ADMIN_NAME: z.string().default("Gharpayy Super Admin"),
  GEMINI_API_KEY: z.string().optional(),
});

export const env = Env.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
