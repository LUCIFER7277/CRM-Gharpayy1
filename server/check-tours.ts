import { col, connectMongo } from './src/db/mongo.js';
async function run() {
  await connectMongo();
  const tours = await col('tours').find({}).toArray();
  console.log('Tours count:', tours.length);
  if (tours.length > 0) {
    console.log(JSON.stringify(tours[0], null, 2));
  }
  process.exit(0);
}
run();
