const { MongoClient } = require('mongodb');
require('dotenv').config();
async function run() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'ops');
  const users = await db.collection('users').find({ $or: [{ role: 'tcm' }, { role: 'member', isTcm: true }] }).toArray();
  const allNames = users.map(u => ({ id: u._id, name: u.fullName }));
  console.log(allNames);
  
  const names = users.map(u => u.fullName);
  const duplicates = names.filter((e, i, a) => a.indexOf(e) !== i);
  console.log("Duplicate names:", duplicates);
  
  await client.close();
}
run().catch(console.error);
