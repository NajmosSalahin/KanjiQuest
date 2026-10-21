import pino from 'pino';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

export const logger = isProd
  ? pino({ level: env.LOG_LEVEL })
  : pino({
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    });
