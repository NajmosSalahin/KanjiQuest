import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function start() {
  // Phase 1 on: the database is mandatory (DECISIONS.md — the Phase 0
  // DB-less escape hatch is removed; auth cannot work without a DB).
  if (!env.MONGODB_URI) {
    logger.error(
      'MONGODB_URI is not set — copy .env.example to .env and add your connection string'
    );
    process.exit(1);
  }
  try {
    await connectDB(env.MONGODB_URI);
    logger.info('mongodb connected');
  } catch (err) {
    logger.error({ err: err.message }, 'mongodb connection failed');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`api listening on http://localhost:${env.PORT}/api/v1/health`);
  });

  const shutdown = async () => {
    logger.info('shutting down');
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
