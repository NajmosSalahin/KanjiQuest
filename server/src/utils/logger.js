import { createRequire } from 'node:module';
import pino from 'pino';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

/** pino-pretty is a devDependency — a production-only image may omit it. */
function hasPinoPretty() {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export const logger =
  !isProd && hasPinoPretty()
    ? pino({
        level: env.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:mm:ss' },
        },
      })
    : pino({ level: env.LOG_LEVEL });
