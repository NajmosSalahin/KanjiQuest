import { fail } from '../utils/envelope.js';

/** CSRF (DECISIONS.md): SameSite=Strict cookies + this custom-header
 *  requirement on every state-changing /api/v1 request. Cross-origin sites
 *  cannot set X-Requested-With without CORS approval; same-origin requests
 *  always carry it via the client's fetch wrapper. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfHeaderCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return fail(res, 403, 'CSRF_HEADER_MISSING', 'Missing X-Requested-With header.');
  }
  return next();
}
