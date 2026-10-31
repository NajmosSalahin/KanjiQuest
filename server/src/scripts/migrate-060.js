#!/usr/bin/env node
/**
 * v0.6.0 migration: Phase 5 collections/indexes. No destructive data rewrite.
 * Usage: npm run migrate-060 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { QuestDef } from '../models/QuestDef.js';
import { UserQuest } from '../models/UserQuest.js';

const log = (message) => process.stdout.write(`${message}\n`);

/**
 * Idempotent index creation: Mongoose may have already created an equivalent
 * index under its default name (userId_1_date_1), and MongoDB refuses to add
 * the same key pattern under a second name. Treat a matching key pattern as
 * done instead of dropping/recreating indexes on a live database.
 */
async function ensureIndex(collection, keys, options) {
  const existing = await collection.indexes();
  const wanted = JSON.stringify(keys);
  const match = existing.find((index) => JSON.stringify(index.key) === wanted);
  if (match) {
    if (options.unique && !match.unique) {
      log(
        `migrate-060: ${collection.collectionName} ${wanted} exists non-unique as ${match.name}; replacing`
      );
      await collection.dropIndex(match.name);
      await collection.createIndex(keys, options);
      log(`migrate-060: ${collection.collectionName} ${options.name} created`);
      return;
    }
    log(`migrate-060: ${collection.collectionName} ${wanted} already exists as ${match.name}`);
    return;
  }
  await collection.createIndex(keys, options);
  log(`migrate-060: ${collection.collectionName} ${options.name} created`);
}

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);

  await ensureIndex(QuestDef.collection, { id: 1 }, { unique: true, name: 'QuestDef_id' });
  await ensureIndex(
    UserQuest.collection,
    { userId: 1, date: 1, questId: 1 },
    { unique: true, name: 'UserQuest_user_date_quest' }
  );
  await ensureIndex(UserQuest.collection, { userId: 1, date: 1 }, { name: 'UserQuest_user_date' });
  log('migrate-060: quest indexes ensured');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`migrate-060 failed: ${err.message}`);
  process.exit(1);
});
