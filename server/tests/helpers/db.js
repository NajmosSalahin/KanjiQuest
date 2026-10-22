import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** In-memory MongoDB for tests (D1: no Docker, no shared instance).
 *  launchTimeout: a cold mongod on this Windows device measures ~12s to
 *  "Waiting for connections" (FTDC/AV overhead) — above the 10s default. */
export async function startTestDb() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri('kanjigarden_test'));
  return mongod;
}

export async function stopTestDb(mongod) {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearDb() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}
