import { connectMongo, col, disconnectMongo } from "./src/db/mongo.js";

async function main() {
    try {
        await connectMongo();
        console.log("Connected");
        const act = await col("activities").find({}).sort({occurredAt: -1}).limit(5).toArray();
        console.log("Activities:");
        console.dir(act, { depth: null });
        
        const tcmUsers = await col("users").find({ $or: [{role: "tcm"}, {isTcm: true}] }).toArray();
        console.log("TCM Users:", tcmUsers.map(u => ({ id: u._id, name: u.fullName })));
        
        const tcmIds = tcmUsers.map(u => u._id);
        const tcmAct = await col("activities").find({ actor: { $in: tcmIds } }).sort({occurredAt: -1}).limit(5).toArray();
        console.log("TCM Activities:");
        console.dir(tcmAct, { depth: null });
        
        const allAct = await col("activities").countDocuments({});
        console.log("Total Activities:", allAct);
    } finally {
        await disconnectMongo();
    }
}
main().catch(console.error);
