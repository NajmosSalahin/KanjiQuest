#!/usr/bin/env node
/**
 * v0.7.0 migration: Phase 6 quiz-session indexes + daily XP bucket backfill.
 * Usage: npm run migrate-070 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { GamificationProfile } from '../models/GamificationProfile.js';
import { QuizSession } from '../models/QuizSession.js';

const log = (message) => process.stdout.write(`${message}\n`);

/**
 * Idempotent index creation: Mongoose may have already created an equivalent
 * index under its default name, and MongoDB refuses to add the same key
 * pattern under a second name. Treat a matching key pattern as done instead
 * of dropping/recreating indexes on a live database.
 */
async function ensureIndex(collection, keys, options) {
  let existing = [];
  try {
    existing = await collection.indexes();
  } catch (err) {
    // A brand-new collection has no namespace yet; createIndex below makes it.
    if (err.codeName !== 'NamespaceNotFound' && err.code !== 26) throw err;
  }
  const wanted = JSON.stringify(keys);
  const match = existing.find((index) => JSON.stringify(index.key) === wanted);
  if (match) {
    if (options.unique && !match.unique) {
      log(
        `migrate-070: ${collection.collectionName} ${wanted} exists non-unique as ${match.name}; replacing`
      );
      await collection.dropIndex(match.name);
      await collection.createIndex(keys, options);
      log(`migrate-070: ${collection.collectionName} ${options.name} created`);
      return;
    }
    log(`migrate-070: ${collection.collectionName} ${wanted} already exists as ${match.name}`);
    return;
  }
  await collection.createIndex(keys, options);
  log(`migrate-070: ${collection.collectionName} ${options.name} created`);
}

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);

  // Phase 6 moved the daily XP bucket key from lastActivityDate (review-only)
  // to dailyXPDate (review + quiz). Profiles written before v0.7.0 keep their
  // in-progress bucket by copying the old key once; stale dates simply reset
  // naturally on the next award.
  const backfill = await GamificationProfile.collection.updateMany(
    { dailyXPDate: null, lastActivityDate: { $type: 'string' } },
    [{ $set: { dailyXPDate: '$lastActivityDate' } }]
  );
  log(`migrate-070: dailyXPDate backfilled for ${backfill.modifiedCount} profile(s)`);

  await ensureIndex(
    QuizSession.collection,
    { userId: 1, startedAt: -1 },
    { name: 'QuizSession_user_started' }
  );
  await ensureIndex(
    QuizSession.collection,
    { status: 1, expiresAt: 1 },
    { name: 'QuizSession_status_expires' }
  );
  log('migrate-070: quiz session indexes ensured');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`migrate-070 failed: ${err.message}`);
  process.exit(1);
});
