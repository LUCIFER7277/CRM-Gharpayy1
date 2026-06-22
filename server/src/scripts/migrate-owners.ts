#!/usr/bin/env tsx
/**
 * migrate-owners.ts
 *
 * Idempotent migration that imports all owners from the frontend seed data
 * (src/property-owner/data/owners-seed.ts) into MongoDB as proper user
 * documents with role="owner", then links each owner's properties by
 * setting property.ownerId on matching property documents.
 *
 * Safe to run multiple times — uses upsert logic throughout.
 *
 * Usage:
 *   cd server && npx tsx src/scripts/migrate-owners.ts
 *
 * Required env vars (same as the main server):
 *   MONGO_URL, MONGO_DB, JWT_SECRET, DEFAULT_TENANT
 */

import "dotenv/config";
import argon2 from "argon2";
import { connectMongo, col, disconnectMongo } from "../db/mongo.js";
import { ulid } from "../../../src/contracts/ids.js";
import { OWNERS_SEED } from "../../../src/property-owner/data/owners-seed.js";
import type { UserDoc } from "../auth/auth.js";

const DEFAULT_TENANT = process.env.DEFAULT_TENANT ?? "t-gharpayy";

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalise(s: string) {
  return s.trim().toLowerCase();
}

function cleanPhone(p: string) {
  return p.replace(/[^\d+]/g, "").slice(0, 20);
}

function buildEmail(username: string) {
  // owners-seed usernames are clean lowercase slugs — use them as emails
  return `${username}@gharpayy-owner.com`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await connectMongo();
  console.log("✓ Connected to MongoDB");

  const users = col<UserDoc>("users");
  const properties = col("properties");

  let created = 0;
  let updated = 0;
  let propLinked = 0;
  let skipped = 0;

  for (const owner of OWNERS_SEED) {
    const username = normalise(owner.username);
    const email = buildEmail(username);
    const now = new Date().toISOString();

    // ── Upsert user doc ────────────────────────────────────────────────────
    const existing = await users.findOne({ $or: [{ username }, { email }] });

    let userId: string;

    if (existing) {
      // Update password hash and ensure role/status are correct
      const passwordHash = await argon2.hash(owner.password);
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            username,
            email,
            fullName: owner.name,
            phone: cleanPhone(owner.phone),
            role: "owner",
            status: "active",
            passwordHash,
            tenantId: DEFAULT_TENANT,
            updatedAt: now,
          },
        },
      );
      userId = existing._id;
      updated++;
    } else {
      userId = owner.id; // keep seed id for traceability
      const passwordHash = await argon2.hash(owner.password);
      const doc: UserDoc = {
        _id: userId,
        username,
        email,
        phone: cleanPhone(owner.phone),
        passwordHash,
        fullName: owner.name,
        role: "owner",
        status: "active",
        zones: [],
        managerId: null,
        adminId: null,
        adminIds: [],
        memberIds: [],
        tenantId: DEFAULT_TENANT,
        invitedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await users.insertOne(doc);
        created++;
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate key — already exists under a different path, skip
          console.warn(`  ⚠ Duplicate key for ${username}, skipping insert`);
          skipped++;
          // Still try to fetch and use that userId for property linking
          const dup = await users.findOne({ $or: [{ username }, { email }] });
          if (dup) userId = dup._id;
          else continue;
        } else {
          throw err;
        }
      }
    }

    // ── Link properties ────────────────────────────────────────────────────
    if (owner.propertyIds && owner.propertyIds.length > 0) {
      for (const pgId of owner.propertyIds) {
        // Properties may be stored by their pg seed id (e.g. "BLISS", "VELUXE_COED")
        const prop = await properties.findOne({
          $or: [
            { _id: pgId },
            { customId: pgId },
            { name: pgId },
          ],
          tenantId: DEFAULT_TENANT,
        });

        if (prop) {
          // Only write if not already linked to prevent overwriting a later admin assignment
          if (!(prop as any).ownerId) {
            await properties.updateOne(
              { _id: prop._id },
              { $set: { ownerId: userId, ownerName: owner.name, updatedAt: new Date().toISOString() } },
            );
            propLinked++;
          }
        }
        // Properties not yet in DB are fine — owner can create them via portal
      }
    }

    const status = existing ? "updated" : "created";
    console.log(`  ${status === "created" ? "+" : "~"} ${owner.username} → userId=${userId} (${owner.propertyIds.length} properties)`);
  }

  console.log("\n── Migration complete ──");
  console.log(`  Users created : ${created}`);
  console.log(`  Users updated : ${updated}`);
  console.log(`  Users skipped : ${skipped}`);
  console.log(`  Properties linked: ${propLinked}`);

  await disconnectMongo();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
