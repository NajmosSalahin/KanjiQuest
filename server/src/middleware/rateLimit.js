import { rateLimit } from 'express-rate-limit';
import { fail } from '../utils/envelope.js';

/** prompt.md §14: 100 req/min general, 10 req/min auth (per IP).
 *  Limits are overridable per app instance so tests can pin them. */
export function limiter(limit) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      fail(res, 429, 'TOO_MANY_REQUESTS', 'Too many requests. Try again in a minute.'),
  });
}

export const DEFAULT_RATE_LIMITS = Object.freeze({ general: 100, auth: 10 });
