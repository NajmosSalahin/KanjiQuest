/**
 * Response envelope — prompt.md §9:
 * success: { success: true, data }
 * error:   { success: false, error: { code, message, fields? } }
 */

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data) {
  return res.status(201).json({ success: true, data });
}

export function noContent(res) {
  return res.status(204).end();
}

export function fail(res, status, code, message, fields) {
  const error = fields ? { code, message, fields } : { code, message };
  return res.status(status).json({ success: false, error });
}
