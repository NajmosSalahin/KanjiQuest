#!/usr/bin/env node
/**
 * v0.8.0 migration — Phase 7 store/inventory/leaderboard/avatar indexes and
 * additive field backfills. No destructive data rewrite.
 * Usage: npm run migrate-080 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { GamificationProfile } from '../models/GamificationProfile.js';
import { UserInventory } from '../models/UserInventory.js';
import { weekStartUTC } from '../services/weekly.js';

const log = (message) => process.stdout.write(`${message}\n`);

async function ensureIndex(collection, keys, options = {}) {
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
      await collection.dropIndex(match.name);
    } else {
      log(`  index ${match.name} already exists`);
      return;
    }
  }
  const name = await collection.createIndex(keys, options);
  log(`  created index ${name}`);
}

async function main() {
  await connectDB(env.MONGODB_URI);
  const db = mongoose.connection.db;

  log('GamificationProfile indexes');
  await ensureIndex(
    db.collection('gamificationprofiles'),
    { weeklyXPWeek: 1, weeklyXP: -1 },
    { name: 'weekly_leaderboard' }
  );
  await ensureIndex(
    db.collection('gamificationprofiles'),
    { totalXP: -1 },
    { name: 'alltime_leaderboard' }
  );

  log('UserInventory index');
  await ensureIndex(
    db.collection('userinventories'),
    { userId: 1, itemId: 1 },
    { unique: true, name: 'user_item_unique' }
  );

  log('AvatarAsset index');
  await ensureIndex(db.collection('avatarassets'), { userId: 1 }, { name: 'user_avatars' });

  const week = weekStartUTC();
  const now = new Date();

  log('Adding Phase 7 fields to gamification profiles');
  const weekly = await GamificationProfile.collection.updateMany(
    { $or: [{ weeklyXP: { $exists: false } }, { weeklyXP: null }] },
    { $set: { weeklyXP: 0 } }
  );
  const weekField = await GamificationProfile.collection.updateMany(
    { $or: [{ weeklyXPWeek: { $exists: false } }, { weeklyXPWeek: null }] },
    { $set: { weeklyXPWeek: week } }
  );
  const frameField = await GamificationProfile.collection.updateMany(
    { equippedFrame: { $exists: false } },
    { $set: { equippedFrame: null } }
  );
  const freezeUsed = await GamificationProfile.collection.updateMany(
    { $or: [{ streakFreezesUsed: { $exists: false } }, { streakFreezesUsed: null }] },
    { $set: { streakFreezesUsed: 0 } }
  );
  log(
    `  weeklyXP=${weekly.modifiedCount} weeklyXPWeek=${weekField.modifiedCount} ` +
      `equippedFrame=${frameField.modifiedCount} streakFreezesUsed=${freezeUsed.modifiedCount}`
  );

  log('Mirroring existing streak freezes into UserInventory');
  let mirrored = 0;
  const profiles = await GamificationProfile.collection
    .find({ streakFreezes: { $gt: 0 } }, { projection: { userId: 1, streakFreezes: 1 } })
    .toArray();
  for (const profile of profiles) {
    const result = await UserInventory.updateOne(
      { userId: profile.userId, itemId: 'streak-freeze' },
      {
        $setOnInsert: {
          type: 'freeze',
          quantity: profile.streakFreezes,
          firstPurchasedAt: now,
          lastPurchasedAt: now,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) mirrored += 1;
  }
  log(`  inventory rows created: ${mirrored}`);

  await mongoose.disconnect();
  log('migrate-080 complete');
}

main().catch(async (err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
