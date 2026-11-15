#!/usr/bin/env node
/**
 * v0.10.0 migration — Phase 9 offline review idempotency.
 * - ensures the unique (userId, eventId) index on reviewEvents;
 * - ensures the 7-day TTL so the collection stays small.
 * Additive only; no data rewrite.
 * Usage: npm run migrate-100 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';

const log = (message) => process.stdout.write(`${message}\n`);

async function ensureIndex(collection, keys, options = {}) {
  let existing = [];
  try {
    existing = await collection.indexes();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound' && err.code !== 26) throw err;
  }
  const wanted = JSON.stringify(keys);
  const match = existing.find((index) => JSON.stringify(index.key) === wanted);
  if (match) {
    log(`  index ${match.name} already exists`);
    return;
  }
  const name = await collection.createIndex(keys, options);
  log(`  created index ${name}`);
}

async function main() {
  await connectDB(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const events = db.collection('reviewevents');

  log('ReviewEvent indexes');
  await ensureIndex(
    events,
    { userId: 1, eventId: 1 },
    { unique: true, name: 'review_event_user_unique' }
  );
  await ensureIndex(
    events,
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60, name: 'review_event_ttl' }
  );

  await mongoose.disconnect();
  log('migrate-100 complete');
}

main().catch(async (err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
