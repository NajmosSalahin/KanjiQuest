#!/usr/bin/env node
/**
 * Seed the 12 daily quest definitions (§6.7). Idempotent.
 * Usage: npm run seed-quests -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { QUEST_DEFS, seedQuestDefs, loadQuestDefs } from '../services/quests.js';

const log = (message) => process.stdout.write(`${message}\n`);

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);
  await seedQuestDefs();
  const defs = await loadQuestDefs();
  log(`quests: ${QUEST_DEFS.length} defs seeded (${defs.length} active)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`seed-quests failed: ${err.message}`);
  process.exit(1);
});
