import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { csrfHeaderCheck } from './middleware/csrf.js';
import { limiter, DEFAULT_RATE_LIMITS } from './middleware/rateLimit.js';

export function createApp(options = {}) {
  const rateLimits = { ...DEFAULT_RATE_LIMITS, ...options.rateLimits };
  const app = express();

  app.disable('x-powered-by');

  // Default CSP; adjusted for Google Fonts / asset hosts in Phase 10 when the
  // server serves the built client (prompt.md §14).
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // CSRF: SameSite=Strict cookies + X-Requested-With header requirement
  // (DECISIONS.md).
  app.use('/api/v1', csrfHeaderCheck);

  // Rate limits: 100 req/min general, 10 req/min auth (§14).
  app.use('/api/v1', limiter(rateLimits.general));
  app.use('/api/v1/auth', limiter(rateLimits.auth));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
