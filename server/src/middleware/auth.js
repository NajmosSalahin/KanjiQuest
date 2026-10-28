import { fail } from '../utils/envelope.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/tokens.js';

/** Validates the kg_access cookie JWT and puts req.userId in scope. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return fail(res, 401, 'TOKEN_MISSING', 'Sign in to continue.');
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    return next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return fail(res, 401, code, 'Your session expired. Sign in again.');
  }
}

/** Attaches req.userId when a valid kg_access cookie is present; otherwise
 *  continues anonymously — public endpoints with per-user extras (§9
 *  myProgress, D6 status). An invalid/expired token degrades to anonymous
 *  rather than failing the request. */
export function optionalAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (token) {
    try {
      req.userId = verifyAccessToken(token).sub;
    } catch {
      req.userId = null;
    }
  }
  return next();
}
