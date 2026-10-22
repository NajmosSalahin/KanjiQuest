#!/usr/bin/env node
/**
 * Seed the radicals collection from server/data/radical-mnemonics.json (§5.6).
 * Usage: npm run seed-radicals -w server
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { Radical } from '../models/Radical.js';
import { radicalChar, KANGXI_COUNT } from '../services/seed/kangxi.js';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const MNEMONICS_PATH = path.join(SERVER_DIR, 'data', 'radical-mnemonics.json');
const log = (message) => process.stdout.write(`${message}\n`);

async function main() {
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);

  const entries = JSON.parse(readFileSync(MNEMONICS_PATH, 'utf8'));
  const covered = new Set(entries.map((entry) => entry.character));
  const missingNumbers = [];
  for (let n = 1; n <= KANGXI_COUNT; n++) {
    if (!covered.has(radicalChar(n))) missingNumbers.push(n);
  }

  const ops = entries.map((entry) => ({
    updateOne: {
      filter: { character: entry.character },
      update: {
        $set: {
          character: entry.character,
          meaning: entry.meaning,
          mnemonic: entry.mnemonic,
          strokeCount: entry.strokeCount,
          variants: entry.variants ?? [],
        },
      },
      upsert: true,
    },
  }));
  // Native driver bulkWrite (same mongoose bulkWrite no-op issue as seed-kanji).
  const result = await Radical.collection.bulkWrite(ops, { ordered: false });

  log(
    `radicals: ${entries.length} entries — upserted ${result.upsertedCount}, modified ${result.modifiedCount}`
  );
  if (missingNumbers.length > 0) {
    log(
      `radicals: no mnemonic yet for Kangxi numbers: ${missingNumbers.join(', ')} ` +
        `(${KANGXI_COUNT - missingNumbers.length}/${KANGXI_COUNT} covered)`
    );
  } else {
    log(`radicals: full Kangxi coverage (${KANGXI_COUNT}/${KANGXI_COUNT})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(`seed-radicals failed: ${err.message}`);
  process.exit(1);
});
