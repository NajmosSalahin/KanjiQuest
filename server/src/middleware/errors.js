import { fail } from '../utils/envelope.js';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function notFound(req, res) {
  fail(res, 404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof SyntaxError && 'body' in err) {
    return fail(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err instanceof ApiError) {
    return fail(res, err.status, err.code, err.message, err.fields);
  }
  logger.error({ err, path: req.originalUrl }, 'unhandled error');
  return fail(res, 500, 'INTERNAL', 'Something went wrong on our side');
}
