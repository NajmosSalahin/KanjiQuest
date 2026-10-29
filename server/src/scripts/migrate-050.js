#!/usr/bin/env node
/**
 * v0.5.0 one-off migration: §11.6 says the daily goal defaults to 50 XP with
 * options 20/50/100/200 — Phase 1 shipped a default of 100 and an enum
 * without 20. No settings UI has existed to customize the goal, so flipping
 * every stored 100 back to 50 is safe (owner-confirmed, Phase 4).
 * Usage: npm run migrate-050 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { GamificationProfile } from '../models/GamificationProfile.js';

const log = (message) => process.stdout.write(`${message}\n`);

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);

  const users = await User.updateMany(
    { 'preferences.dailyGoalXP': 100 },
    { $set: { 'preferences.dailyGoalXP': 50 } }
  );
  const profiles = await GamificationProfile.updateMany(
    { dailyGoalXP: 100 },
    { $set: { dailyGoalXP: 50 } }
  );
  log(
    `migrate-050: users 100→50: ${users.modifiedCount}; profiles 100→50: ${profiles.modifiedCount}`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`migrate-050 failed: ${err.message}`);
  process.exit(1);
});
