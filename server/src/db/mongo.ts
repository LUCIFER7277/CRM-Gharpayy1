import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { env } from "../config/env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.MONGO_URL, {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 30000,
  });
  await connectWithRetry(client);
  db = client.db(env.MONGO_DB);
  await ensureIndexes(db);
  return db;
}

async function connectWithRetry(client: MongoClient): Promise<void> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.connect();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      const waitMs = attempt * 2000;
      console.warn(`[mongo] connection failed, retrying in ${waitMs / 1000}s (${attempt}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected. Call connectMongo() first.");
  return db;
}

export function col<T extends Document = Document>(name: string): Collection<T & { _id?: string }> {
  return getDb().collection<T & { _id?: string }>(name);
}

async function ensureIndexes(db: Db) {
  // NOTE: do NOT manually create an index on `_id` — MongoDB creates a
  // unique `_id` index automatically and rejects any attempt to redefine it.
  const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [
    {
      name: "leads",
      run: () =>
        db.collection("leads").createIndexes([
          { key: { tenantId: 1, createdAt: -1 } },
          { key: { tenantId: 1, phone: 1 }, unique: false },
          { key: { tenantId: 1, assignedTcmId: 1 } },
          { key: { tenantId: 1, stage: 1 } },
          { key: { tenantId: 1, zoneId: 1, stage: 1 } },
        ]),
    },
    {
      name: "lead_phone_index",
      // Hard dedup boundary. The ONLY way to prevent duplicate-storms when the
      // same lead arrives from 5 sources in 200ms. Insert into THIS collection
      // first; on E11000 → return existing leadId.
      run: () =>
        db.collection("lead_phone_index").createIndex(
          { tenantId: 1, phoneE164: 1 },
          { unique: true, name: "uniq_tenant_phone" },
        ),
    },
    {
      name: "entity_event",
      run: () =>
        db.collection("entity_event").createIndexes([
          { key: { tenantId: 1, occurredAt: -1 } },
          { key: { correlationId: 1 } },
          { key: { type: 1 } },
          // Per-aggregate monotonic ordering — physical guarantee against gaps & double-append.
          { key: { aggregateType: 1, aggregateId: 1, seq: 1 }, unique: true, sparse: true, name: "uniq_aggregate_seq" },
          // Outbox scanner — partial index keeps it tiny even at 10M+ events.
          { key: { publishedAt: 1, _id: 1 }, partialFilterExpression: { publishedAt: null }, name: "outbox_pending" },
        ]),
    },
    {
      name: "command_ledger.ttl",
      // 7-day TTL on idempotency ledger — long enough to absorb any retry storm,
      // short enough to keep the collection bounded.
      run: () => db.collection("command_ledger").createIndex(
        { appliedAtTtl: 1 },
        { expireAfterSeconds: 7 * 24 * 60 * 60, name: "ttl_appliedAt" },
      ),
    },
    {
      name: "aggregate_seq",
      run: () => db.collection("aggregate_seq").createIndex({ _id: 1 }, { name: "by_id" }),
    },
    {
      name: "dlq",
      run: () => db.collection("dlq").createIndexes([
        { key: { queue: 1, failedAt: -1 } },
        { key: { eventId: 1 } },
      ]),
    },
    {
      name: "sessions.refresh",
      run: () => db.collection("sessions").createIndex({ userId: 1 }, { name: "by_user" }),
    },
    { name: "users.email", run: () => db.collection("users").createIndex({ email: 1 }, { unique: true }) },
    { name: "user_roles.userId", run: () => db.collection("user_roles").createIndex({ userId: 1 }) },
    { name: "sessions.token", run: () => db.collection("sessions").createIndex({ token: 1 }, { unique: true }) },
    {
      name: "sessions.expiresAt",
      run: () => db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    },
    {
      name: "tours",
      run: () =>
        db.collection("tours").createIndexes([
          { key: { tenantId: 1, leadId: 1 } },
          { key: { tenantId: 1, assignedTo: 1, scheduledAt: -1 } },
          { key: { tenantId: 1, status: 1, scheduledAt: -1 } },
          { key: { tenantId: 1, scheduledBy: 1 } },
        ]),
    },
    {
      name: "properties",
      run: () =>
        db.collection("properties").createIndexes([
          { key: { tenantId: 1, name: 1 } },
          { key: { tenantId: 1, zoneId: 1 } },
          { key: { tenantId: 1, area: 1 } },
        ]),
    },
    {
      name: "zones",
      run: () =>
        db.collection("zones").createIndexes([
          { key: { tenantId: 1, name: 1 } },
          { key: { tenantId: 1, city: 1 } },
        ]),
    },
    {
      name: "activities",
      run: () =>
        db.collection("activities").createIndexes([
          { key: { tenantId: 1, leadId: 1, createdAt: -1 } },
          { key: { tenantId: 1, kind: 1, createdAt: -1 } },
          { key: { tenantId: 1, tcmId: 1, createdAt: -1 } },
        ]),
    },
    {
      name: "todos",
      run: () =>
        db.collection("todos").createIndexes([
          { key: { tenantId: 1, assignedTo: 1, status: 1 } },
          { key: { tenantId: 1, leadId: 1, createdAt: -1 } },
          { key: { tenantId: 1, createdBy: 1, status: 1 } },
        ]),
    },
    {
      name: "quotations",
      run: () =>
        db.collection("quotations").createIndexes([
          { key: { tenantId: 1, leadId: 1 } },
          { key: { tenantId: 1, propertyId: 1, createdAt: -1 } },
          { key: { tenantId: 1, status: 1 } },
          { key: { tenantId: 1, tcmId: 1, createdAt: -1 } },
        ]),
    },
    {
      name: "webhooks_in",
      run: () =>
        db.collection("webhooks_in").createIndexes([
          { key: { tenantId: 1, receivedAt: -1 } },
          { key: { vendor: 1, receivedAt: -1 } },
        ]),
    },
    {
      name: "user_activity",
      run: () =>
        db.collection("user_activity").createIndexes([
          { key: { tenantId: 1, userId: 1, ts: -1 } },
          { key: { tenantId: 1, action: 1, ts: -1 } },
        ]),
    },
    {
      name: "assignment_notifications",
      run: () =>
        db.collection("assignment_notifications").createIndexes([
          { key: { tenantId: 1, assignedToId: 1, status: 1 } },
          { key: { tenantId: 1, entityId: 1 } },
          { key: { tenantId: 1, assignedById: 1, status: 1 } },
        ]),
    },
    {
      name: "follow_ups",
      run: () =>
        db.collection("follow_ups").createIndexes([
          { key: { tenantId: 1, leadId: 1, dueAt: 1 } },
          { key: { tenantId: 1, tcmId: 1, done: 1 } },
        ]),
    },
    {
      name: "handoffs",
      run: () =>
        db.collection("handoffs").createIndexes([
          { key: { tenantId: 1, leadId: 1, ts: -1 } },
          { key: { tenantId: 1, read: 1 } },
        ]),
    },
    {
      name: "sequences",
      run: () =>
        db.collection("sequences").createIndexes([
          { key: { tenantId: 1, leadId: 1 } },
          { key: { tenantId: 1, kind: 1, startedAt: -1 } },
        ]),
    },
    {
      name: "bookings",
      run: () =>
        db.collection("bookings").createIndexes([
          { key: { tenantId: 1, createdAt: -1 } },
          { key: { tenantId: 1, leadId: 1 } },
          { key: { tenantId: 1, propertyId: 1, status: 1 } },
          { key: { tenantId: 1, status: 1 } },
          // Owner portal queries
          { key: { ownerId: 1, tenantId: 1, ownerLifecycle: 1 } },
          { key: { ownerId: 1, tenantId: 1, createdAt: -1 } },
        ]),
    },
    {
      name: "properties.ownerId",
      run: () =>
        db.collection("properties").createIndex({ ownerId: 1, tenantId: 1 }, { name: "owner_properties" }),
    },
    {
      name: "rooms",
      run: () =>
        db.collection("rooms").createIndexes([
          { key: { propertyId: 1 } },
          { key: { tenantId: 1, propertyId: 1 } },
        ]),
    },
    {
      name: "room_statuses",
      run: () =>
        db.collection("room_statuses").createIndexes([
          { key: { roomId: 1 }, unique: true, name: "uniq_roomId" },
          { key: { ownerId: 1 } },
          { key: { propertyId: 1 } },
        ]),
    },
    {
      name: "room_actions",
      run: () =>
        db.collection("room_actions").createIndexes([
          { key: { ownerId: 1, at: -1 } },
          { key: { roomId: 1, at: -1 } },
        ]),
    },
    {
      name: "tenants",
      run: () =>
        db.collection("tenants").createIndexes([
          { key: { tenantId: 1, createdAt: -1 } },
          { key: { tenantId: 1, leadId: 1 } },
          { key: { tenantId: 1, propertyId: 1, status: 1 } },
          { key: { tenantId: 1, status: 1 } },
        ]),
    },
  ];

  // Run sequentially with isolation: a single bad index must NOT prevent boot.
  for (const t of tasks) {
    try {
      await t.run();
    } catch (err) {
      console.warn(`[mongo] index '${t.name}' skipped:`, (err as Error).message);
    }
  }
}

export async function disconnectMongo() {
  await client?.close();
  client = null;
  db = null;
}
