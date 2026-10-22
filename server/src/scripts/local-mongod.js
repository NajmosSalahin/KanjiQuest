#!/usr/bin/env node
/**
 * Dev helper: local MongoDB without Docker, for when .env has no MONGODB_URI
 * yet (see DECISIONS.md D1). Uses mongodb-memory-server with an on-disk
 * wiredTiger dbPath on a fixed port, so seeded data survives restarts.
 *
 * Usage: node src/scripts/local-mongod.js   (prints the MONGODB_URI to use)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const dbPath = path.join(tmpdir(), 'opencode', 'kanjigarden-local-mongo');
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' },
});
process.stdout.write(`MONGODB_URI=${server.getUri('kanjigarden')}\n`);
process.stdout.write(`dbPath=${dbPath}\n`);

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 60000);

export { server, SERVER_DIR };
