#!/usr/bin/env tsx
/**
 * sync-owner-properties.ts
 *
 * Syncs property -> ownerId mappings from rent-insight-app MongoDB into
 * Gharpayy-Ops MongoDB for all RIA-style properties (IDs matching
 * /^[A-Z_]+$/ and p-custom-*).
 *
 * Also copies any missing rooms + room_statuses.
 *
 * Safe to run multiple times — uses upsert/updateOne throughout.
 *
 * Usage:
 *   cd server && npx tsx src/scripts/sync-owner-properties.ts
 */

import "dotenv/config";
import { MongoClient } from "mongodb";

// ── Config ──────────────────────────────────────────────────────────────────

const RIA_URI = process.env.RIA_URI as string;
const GOPS_URI = process.env.GOPS_URI as string;

const DB_NAME = "ops";

// ── Helpers ─────────────────────────────────────────────────────────────────

const RIA_STYLE_ID = /^[A-Z_]+$/;
const CUSTOM_PROP_ID = /^p-custom-/;
const RIA_ROOM_ID = /^r-custom-/;

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const ria = new MongoClient(RIA_URI);
  const gOps = new MongoClient(GOPS_URI);
  await Promise.all([ria.connect(), gOps.connect()]);

  const riaDb = ria.db(DB_NAME);
  const gOpsDb = gOps.db(DB_NAME);

  // Track counts
  let ownerIdFixed = 0;
  let ownerIdAlreadyCorrect = 0;
  let propsCopied = 0;
  let roomsCopied = 0;
  let roomStatusesCopied = 0;

  // ── Step 1: Fix ownerId on existing RIA-style properties ─────────────────
  console.log("── Step 1: Fix ownerId on RIA-style properties ──");

  const gOpsRiaProps = await gOpsDb
    .collection("properties")
    .find({ _id: { $regex: RIA_STYLE_ID } as any })
    .toArray();

  console.log(`  Found ${gOpsRiaProps.length} RIA-style properties in Go:Ops`);

  for (const prop of gOpsRiaProps) {
    const riaProp = await riaDb.collection("properties").findOne({ _id: prop._id });

    if (riaProp && riaProp.ownerId && riaProp.ownerId !== prop.ownerId) {
      // Look up the owner name in RIA
      const owner = await riaDb.collection("users").findOne({ _id: riaProp.ownerId });
      const ownerName = owner?.fullName || owner?.username || "";

      await gOpsDb.collection("properties").updateOne(
        { _id: prop._id },
        {
          $set: {
            ownerId: riaProp.ownerId,
            ownerName,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      ownerIdFixed++;
    } else if (riaProp && riaProp.ownerId === prop.ownerId) {
      ownerIdAlreadyCorrect++;
    }
  }

  console.log(`  Fixed: ${ownerIdFixed}, Already correct: ${ownerIdAlreadyCorrect}`);

  // ── Step 2: Copy missing custom properties ───────────────────────────────
  console.log("\n── Step 2: Copy missing custom properties ──");

  const riaCustomProps = await riaDb
    .collection("properties")
    .find({ _id: { $regex: CUSTOM_PROP_ID } as any })
    .toArray();

  for (const prop of riaCustomProps) {
    const exists = await gOpsDb.collection("properties").findOne({ _id: prop._id });
    if (!exists) {
      await gOpsDb.collection("properties").insertOne(prop);
      propsCopied++;
    }
  }

  console.log(`  Copied: ${propsCopied}, Skipped (already exist): ${riaCustomProps.length - propsCopied}`);

  // ── Step 3: Copy missing custom rooms ────────────────────────────────────
  console.log("\n── Step 3: Copy missing custom rooms ──");

  const riaCustomRooms = await riaDb
    .collection("rooms")
    .find({ _id: { $regex: RIA_ROOM_ID } as any })
    .toArray();

  for (const room of riaCustomRooms) {
    const exists = await gOpsDb.collection("rooms").findOne({ _id: room._id });
    if (!exists) {
      await gOpsDb.collection("rooms").insertOne(room);
      roomsCopied++;
    }
  }

  console.log(`  Copied: ${roomsCopied}, Skipped (already exist): ${riaCustomRooms.length - roomsCopied}`);

  // ── Step 4: Copy ALL room_statuses for RIA-style properties ──────────────
  // Go:Ops has 749 room_statuses (mostly mock), RIA has 795 (for real properties).
  // Since room_statuses' roomId references rooms, and we've ensured rooms exist,
  // we upsert all from RIA to get correct occupancy data.
  console.log("\n── Step 4: Upsert room_statuses from RIA ──");

  const riaRoomStatuses = await riaDb
    .collection("room_statuses")
    .find({})
    .toArray();

  // First, get the RIA room IDs to know which ones we're dealing with
  const riaRoomIds = new Set(riaRoomStatuses.map((rs: any) => rs.roomId));

  // Delete room_statuses in Go:Ops that reference RIA rooms (we'll re-insert)
  const deleteResult = await gOpsDb.collection("room_statuses").deleteMany({
    roomId: { $in: Array.from(riaRoomIds) },
  });
  console.log(`  Deleted ${deleteResult.deletedCount} outdated room_statuses in Go:Ops`);

  // Insert all RIA room_statuses
  if (riaRoomStatuses.length > 0) {
    await gOpsDb.collection("room_statuses").insertMany(riaRoomStatuses as any);
    roomStatusesCopied = riaRoomStatuses.length;
  }

  console.log(`  Inserted ${roomStatusesCopied} room_statuses from RIA`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n── Migration complete ──");
  console.log(`  Properties ownerId fixed : ${ownerIdFixed}`);
  console.log(`  Properties ownerId correct: ${ownerIdAlreadyCorrect}`);
  console.log(`  Custom properties copied : ${propsCopied}`);
  console.log(`  Custom rooms copied     : ${roomsCopied}`);
  console.log(`  Room statuses upserted  : ${roomStatusesCopied}`);

  await Promise.all([ria.close(), gOps.close()]);
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
