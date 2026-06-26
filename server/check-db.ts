import { connectMongo, col } from "./src/db/mongo.js";

async function run() {
  await connectMongo();
  const leads = await col("leads").countDocuments();
  console.log("Total leads:", leads);

  const now = new Date();
  
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  const leadsToCall = await col("leads").countDocuments({
    nextFollowUpAt: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
  });
  console.log("Leads to call today (by nextFollowUpAt):", leadsToCall);

  const overdue = await col("follow_ups").countDocuments({
    done: false,
    dueAt: { $lt: now.toISOString() }
  });
  console.log("Overdue follow-ups:", overdue);

  const bookings = await col("bookings").countDocuments();
  console.log("Total bookings:", bookings);

  const tours = await col("tours").countDocuments();
  console.log("Total tours:", tours);

  process.exit(0);
}
run().catch(console.error);
