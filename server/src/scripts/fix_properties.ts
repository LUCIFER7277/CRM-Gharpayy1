import { connectMongo, disconnectMongo } from "../db/mongo.js";

async function main() {
  console.log("Connecting to Mongo...");
  const db = await connectMongo();
  console.log("Updating properties...");
  const result = await db.collection("properties").updateMany({}, { $set: { status: "active" } });
  console.log(`Updated ${result.modifiedCount} properties.`);
  await disconnectMongo();
}

main().catch(console.error);
