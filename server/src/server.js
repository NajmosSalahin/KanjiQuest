import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();

async function start() {
  if (env.MONGODB_URI) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      logger.info('mongodb connected');
    } catch (err) {
      // Phase 0 has no DB-backed routes; don't block health checks on a missing
      // URI. Phase 1 makes connect-or-fail mandatory (see DECISIONS.md).
      logger.warn({ err: err.message }, 'mongodb unavailable — continuing without DB');
    }
  } else {
    logger.warn('MONGODB_URI not set — running without database (Phase 0 only)');
  }

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
