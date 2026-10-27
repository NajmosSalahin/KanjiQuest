/**
 * Live smoke test — run after every phase's deploy (17 checks).
 *
 *   node deploy/smoke.mjs                       # defaults to https://kanjiquest.vercel.app
 *   node deploy/smoke.mjs https://my-app.vercel.app
 *
 * Exercises the deployed client + /api proxy end to end: health, register,
 * cookies (HttpOnly/Secure/SameSite=Strict), authenticated me, kanji list +
 * D6 sort/status, detail + 404 envelope, radicals, licenses, auth failure
 * paths, CSRF header enforcement, logout, SPA fallback, security headers.
 *
 * Registers a throwaway `smoke+<epoch>@example.com` user; when a root `.env`
 * with MONGODB_URI is found (local runs), it deletes that user + sessions +
 * profile afterwards so prod stays clean. Exit code 0 only if all checks pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = (process.argv[2] ?? 'https://kanjiquest.vercel.app').replace(/\/+$/, '');
const EMAIL = `smoke+${Date.now()}@example.com`;
const PASSWORD = 'SmokeTest!12345';

const results = [];
const cookies = new Map();

const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') || undefined;

function absorb(res) {
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i).trim();
    const val = pair.slice(i + 1).trim();
    if (!val || /Max-Age=0/i.test(c)) cookies.delete(name);
    else cookies.set(name, val);
  }
  return set;
}

async function call(path, { method = 'GET', body, withCsrf = true } = {}) {
  const headers = {};
  if (withCsrf) headers['X-Requested-With'] = 'XMLHttpRequest';
  if (body) headers['Content-Type'] = 'application/json';
  const ck = cookieHeader();
  if (ck) headers.Cookie = ck;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookies = absorb(res);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  let text = null;
  if (!json) {
    try {
      text = await res.text();
    } catch {}
  }
  return { status: res.status, json, text, setCookies };
}

function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  :: ' + detail : ''}`);
}

console.log(`smoke target: ${BASE}\n`);

// 1. health through the proxy
{
  const r = await call('/api/v1/health');
  check('health via vercel proxy', r.status === 200 && r.json?.success === true, `status=${r.status}`);
}

// 2. register + cookie attributes
let registerSetCookies = [];
{
  const r = await call('/api/v1/auth/register', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD, displayName: 'Smoke Test' },
  });
  registerSetCookies = r.setCookies ?? [];
  const sc = registerSetCookies.join(' | ');
  check('register -> 201 + session', r.status === 201 && r.json?.success === true, `status=${r.status}`);
  check(
    'cookies: HttpOnly + Secure + SameSite=Strict',
    /httponly/i.test(sc) && /secure/i.test(sc) && /samesite=strict/i.test(sc)
  );
}

// 3. authenticated /users/me
{
  const r = await call('/api/v1/users/me');
  check('users/me with cookie', r.status === 200 && r.json?.data?.user?.email === EMAIL, `status=${r.status}`);
}

// 4. kanji list
{
  const r = await call('/api/v1/kanji?limit=3&status=all');
  check('kanji list limit=3', r.status === 200 && r.json?.data?.items?.length === 3, `total=${r.json?.data?.total}`);
}

// 5. D6 sort=strokes — integer counts, non-decreasing (bug #3 regression: NaN used to sort first as nulls)
{
  const r = await call('/api/v1/kanji?limit=5&sort=strokes&status=all');
  const items = r.json?.data?.items ?? [];
  const ints = items.every((it) => Number.isInteger(it.strokeCount) && it.strokeCount >= 1);
  const sorted = items.every((it, i) => i === 0 || items[i - 1].strokeCount <= it.strokeCount);
  check(
    'kanji sort=strokes ascending, integer counts',
    r.status === 200 && items.length === 5 && ints && sorted,
    `strokes=${items.map((i) => i.strokeCount).join(',')}`
  );
}

// 6. D6 status != all (empty until Phase 3 progress exists)
{
  const r = await call('/api/v1/kanji?limit=3&status=learning');
  check(
    'kanji status=learning -> empty pre-Phase-3',
    r.status === 200 && r.json?.data?.items?.length === 0 && r.json?.data?.total === 0,
    `status=${r.status}`
  );
}

// 7. detail
{
  const r = await call(`/api/v1/kanji/${encodeURIComponent('水')}`);
  const d = r.json?.data;
  check('kanji detail (water)', r.status === 200 && (d?.kanji?.character ?? d?.character) === '水', `status=${r.status}`);
}

// 8. detail 404 envelope
{
  const r = await call('/api/v1/kanji/A');
  check('kanji detail 404 envelope', r.status === 404 && r.json?.error?.code === 'KANJI_NOT_FOUND', `code=${r.json?.error?.code}`);
}

// 9. radicals
{
  const r = await call('/api/v1/radicals');
  check('radicals list', r.status === 200 && (r.json?.data?.radicals?.length ?? 0) > 0, `count=${r.json?.data?.radicals?.length}`);
}

// 10. licenses
{
  const r = await call('/api/v1/licenses');
  check('licenses', r.status === 200 && r.json?.success === true, `status=${r.status}`);
}

// 11. bad login — uniform 401
{
  const r = await call('/api/v1/auth/login', { method: 'POST', body: { email: EMAIL, password: 'wrong-password-x' } });
  check('bad login -> 401 INVALID_CREDENTIALS', r.status === 401 && r.json?.error?.code === 'INVALID_CREDENTIALS', `status=${r.status}`);
}

// 12. missing CSRF header — rejected
{
  const r = await call('/api/v1/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD }, withCsrf: false });
  check('missing X-Requested-With -> rejected', r.status === 403 && r.json?.error?.code === 'CSRF_HEADER_MISSING', `status=${r.status}`);
}

// 13. correct login
{
  cookies.clear();
  const r = await call('/api/v1/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  check('login -> 200 + cookies', r.status === 200 && cookies.size > 0, `status=${r.status}`);
}

// 14. logout invalidates
{
  const r = await call('/api/v1/auth/logout', { method: 'POST' });
  const me = await call('/api/v1/users/me');
  check('logout -> 204 and me 401', r.status === 204 && me.status === 401, `logout=${r.status} me=${me.status}`);
}

// 15. SPA fallback
{
  const res = await fetch(BASE + '/learn');
  const html = await res.text();
  check('SPA fallback /learn serves app', res.status === 200 && /<!doctype html>/i.test(html) && html.includes('<div id="root"'), `status=${res.status}`);
}

// 16. security headers on static responses
{
  const res = await fetch(BASE + '/');
  check('security headers on client', !!(res.headers.get('content-security-policy') || res.headers.get('x-content-type-options')));
}

// 17. proxy pass-through headers survive (CORS is same-origin; verify no ACAO needed + API reachable via /health alias)
{
  const r = await call('/health');
  check('legacy /health alias via proxy', r.status === 200 && r.json?.success === true, `status=${r.status}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);

// Best-effort cleanup of this run's throwaway user (needs root .env, local runs).
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = join(root, '.env');
  if (existsSync(envPath)) {
    const uri = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('MONGODB_URI='))
      ?.slice('MONGODB_URI='.length);
    if (uri) {
      const require = createRequire(join(root, 'package.json'));
      const mongoose = require('mongoose');
      await mongoose.connect(uri, { dbName: 'kanjiquest', serverSelectionTimeoutMS: 15000 });
      const db = mongoose.connection.db;
      const users = await db.collection('users').find({ email: EMAIL }, { projection: { _id: 1 } }).toArray();
      if (users.length > 0) {
        const ids = users.map((u) => u._id);
        await db.collection('sessions').deleteMany({ userId: { $in: ids } });
        await db.collection('gamificationprofiles').deleteMany({ userId: { $in: ids } });
        await db.collection('users').deleteMany({ _id: { $in: ids } });
        console.log(`cleanup: removed smoke user ${EMAIL}`);
      }
      await mongoose.disconnect();
    }
  }
} catch {
  console.log(`cleanup: skipped (no local DB access) — remove ${EMAIL} manually if desired`);
}

process.exit(failed.length ? 1 : 0);
