/** API client — prompt.md §9 envelope, §14 CSRF header, cookie sessions. */

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: {
      // CSRF requirement (DECISIONS.md): every request carries this header.
      'X-Requested-With': 'XMLHttpRequest',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON error body
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? 'UNKNOWN',
      json?.error?.message ?? 'Something went wrong on our side.',
      json?.error?.fields
    );
  }
  return json.data;
}

/** Single-flight silent refresh: concurrent 401s share one /auth/refresh call. */
let refreshPromise = null;
function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', { method: 'POST' }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api(path, options = {}) {
  try {
    return await request(path, options);
  } catch (err) {
    const retriable =
      err instanceof ApiError &&
      err.status === 401 &&
      !path.startsWith('/auth/') &&
      options.retry !== true;
    if (!retriable) throw err;
    await refreshOnce();
    return request(path, options);
  }
}
