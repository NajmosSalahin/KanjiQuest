#!/usr/bin/env node
/**
 * Seed the achievements collection with the canonical 41 D11 defs (§8).
 * Idempotent — safe to re-run; the GET /gamification/achievements route
 * also self-seeds when the collection is empty.
 * Usage: npm run seed-achievements -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { seedAchievements, ACHIEVEMENT_DEFS } from '../services/achievements.js';

const log = (message) => process.stdout.write(`${message}\n`);

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);

  const result = await seedAchievements();
  log(
    `achievements: ${ACHIEVEMENT_DEFS.length} defs — upserted ${result.upsertedCount}, modified ${result.modifiedCount}`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`seed-achievements failed: ${err.message}`);
  process.exit(1);
});
