#!/usr/bin/env node
/**
 * v0.9.0 migration — Phase 8 onboarding + password reset.
 * - marks every existing account as onboarding-complete (D20 legacy rule);
 * - ensures the password-reset token indexes (unique hash + TTL).
 * Additive only; no destructive rewrite.
 * Usage: npm run migrate-090 -w server
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';

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

  log('Marking legacy accounts as onboarding-complete');
  const backfill = await User.collection.updateMany(
    {
      $or: [
        { 'preferences.onboardingCompleted': { $exists: false } },
        { 'preferences.onboardingCompleted': null },
      ],
    },
    { $set: { 'preferences.onboardingCompleted': true } }
  );
  log(`  updated ${backfill.modifiedCount} account(s)`);

  log('Converting furigana booleans to always/hover/never');
  const always = await User.collection.updateMany(
    { 'preferences.furigana': true },
    { $set: { 'preferences.furigana': 'always' } }
  );
  const never = await User.collection.updateMany(
    { 'preferences.furigana': false },
    { $set: { 'preferences.furigana': 'never' } }
  );
  const missing = await User.collection.updateMany(
    {
      $or: [{ 'preferences.furigana': { $exists: false } }, { 'preferences.furigana': null }],
    },
    { $set: { 'preferences.furigana': 'always' } }
  );
  log(
    `  always=${always.modifiedCount} never=${never.modifiedCount} missing=${missing.modifiedCount}`
  );

  log('PasswordResetToken indexes');
  await ensureIndex(
    db.collection('passwordresettokens'),
    { tokenHash: 1 },
    { unique: true, name: 'reset_token_hash_unique' }
  );
  await ensureIndex(
    db.collection('passwordresettokens'),
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'reset_token_ttl' }
  );
  await ensureIndex(
    db.collection('passwordresettokens'),
    { userId: 1 },
    { name: 'reset_token_user' }
  );

  await mongoose.disconnect();
  log('migrate-090 complete');
}

main().catch(async (err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
