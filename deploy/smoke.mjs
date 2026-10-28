/**
 * Live smoke test — run after every phase's deploy (31 checks).
 *
 *   node deploy/smoke.mjs                       # defaults to https://kanjiquest.vercel.app
 *   node deploy/smoke.mjs https://my-app.vercel.app
 *
 * Exercises the deployed client + /api proxy end to end: health, register,
 * cookies (HttpOnly/Secure/SameSite=Strict), authenticated me, kanji list +
 * D6 sort/status, detail + 404 envelope, radicals, licenses, auth failure
 * paths, CSRF header enforcement, the full Phase 3 review flow (add, due,
 * review+XP, undo, re-review, suspend, stats, D8 delete, myProgress, D6
 * learning join, anonymous invariants), logout, SPA fallback, security
 * headers.
 *
 * Registers a throwaway `smoke+<epoch>@example.com` user; when a root `.env`
 * with MONGODB_URI is found (local runs), it deletes that user + sessions +
 * profile + progress afterwards so prod stays clean. Exit code 0 only if all
 * checks pass.
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
    'kanji status=learning -> empty for fresh user',
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

// 14. Phase 3: add to review + myProgress on detail (D8 field)
{
  const r = await call('/api/v1/progress/add', { method: 'POST', body: { character: '水' } });
  check(
    'progress/add -> 201 new card',
    r.status === 201 && r.json?.data?.progress?.state === 'new',
    `status=${r.status}`
  );
  const d = await call(`/api/v1/kanji/${encodeURIComponent('水')}`);
  check(
    'detail myProgress -> state new',
    d.json?.data?.myProgress?.state === 'new',
    `myProgress=${JSON.stringify(d.json?.data?.myProgress?.state)}`
  );
}

// 15. due queue carries card content (§7.2 back)
{
  await call('/api/v1/progress/add', { method: 'POST', body: { character: '火' } });
  await call('/api/v1/progress/add', { method: 'POST', body: { character: '月' } });
  const r = await call('/api/v1/progress/due');
  const items = r.json?.data?.items ?? [];
  check(
    'progress/due -> 3 cards with content',
    r.status === 200 && items.length === 3 && items.every((i) => i.character && i.id && Array.isArray(i.meanings)),
    `items=${items.length} total=${r.json?.data?.total}`
  );
}

// 16-19. review -> first-review XP -> undo -> re-review -> suspend
{
  const due = await call('/api/v1/progress/due');
  const card = due.json?.data?.items?.[0];

  const r = await call('/api/v1/progress/review', { method: 'POST', body: { cardId: card.id, rating: 2 } });
  const p = r.json?.data?.progress;
  const xp = r.json?.data?.xp;
  check(
    'progress/review Good -> SRS + first-review XP (30) + streak 1',
    r.status === 200 && p?.state === 'review' && p?.interval === 1 && xp?.awarded === 30 && xp?.currentStreak === 1,
    `state=${p?.state} interval=${p?.interval} xp=${xp?.awarded}`
  );

  const u = await call(`/api/v1/review/${card.id}/undo`, { method: 'POST' });
  check(
    'undo in window -> restored new + refund 30',
    u.status === 200 &&
      u.json?.data?.progress?.state === 'new' &&
      u.json?.data?.xp?.refunded === 30 &&
      u.json?.data?.xp?.totalXP === 0,
    `status=${u.status} state=${u.json?.data?.progress?.state}`
  );

  const again = await call('/api/v1/progress/review', { method: 'POST', body: { cardId: card.id, rating: 2 } });
  check(
    're-review after undo -> 10 XP (first bonus already used)',
    again.status === 200 && again.json?.data?.xp?.awarded === 10 && again.json?.data?.xp?.totalXP === 10,
    `xp=${again.json?.data?.xp?.awarded}`
  );

  const due2 = await call('/api/v1/progress/due');
  const buriedCard = (due2.json?.data?.items ?? []).find((i) => i.character === '月');
  const s = await call(`/api/v1/review/${buriedCard.id}/suspend`, { method: 'POST' });
  const due3 = await call('/api/v1/progress/due');
  const stillDue = (due3.json?.data?.items ?? []).some((i) => i.id === buriedCard.id);
  check(
    'suspend -> suspended 7d and excluded from due',
    s.status === 200 && s.json?.data?.progress?.suspended === true && !stillDue,
    `status=${s.status}`
  );
}

// 20. stats aggregate
{
  const r = await call('/api/v1/progress/stats');
  const d = r.json?.data;
  check(
    'progress/stats totals + accuracy',
    r.status === 200 && d?.total === 3 && d?.totalReviews >= 1 && typeof d?.accuracy === 'number',
    `total=${d?.total} reviews=${d?.totalReviews}`
  );
}

// 21. D6 status=learning is real for authenticated users (Phase 3)
{
  const r = await call('/api/v1/kanji?limit=5&status=learning');
  check(
    'kanji status=learning -> tracked kanji',
    r.status === 200 && (r.json?.data?.total ?? 0) >= 1,
    `total=${r.json?.data?.total}`
  );
}

// 22. D8 remove from review: 204 then 404
{
  const d = await call(`/api/v1/progress/${encodeURIComponent('水')}`, { method: 'DELETE' });
  const repeat = await call(`/api/v1/progress/${encodeURIComponent('水')}`, { method: 'DELETE' });
  check(
    'D8 DELETE -> 204 then 404',
    d.status === 204 && repeat.status === 404 && repeat.json?.error?.code === 'PROGRESS_NOT_FOUND',
    `first=${d.status} repeat=${repeat.status}`
  );
}

// 23. logout invalidates
{
  const r = await call('/api/v1/auth/logout', { method: 'POST' });
  const me = await call('/api/v1/users/me');
  check('logout -> 204 and me 401', r.status === 204 && me.status === 401, `logout=${r.status} me=${me.status}`);
}

// 24. anonymous invariants (Phase 3): myProgress null, status=learning empty
{
  const d = await call(`/api/v1/kanji/${encodeURIComponent('水')}`);
  check(
    'anonymous detail -> myProgress null',
    d.status === 200 && d.json?.data?.myProgress === null,
    `myProgress=${JSON.stringify(d.json?.data?.myProgress)}`
  );
  const s = await call('/api/v1/kanji?limit=3&status=learning');
  check(
    'anonymous status=learning -> empty',
    s.status === 200 && (s.json?.data?.total ?? -1) === 0,
    `total=${s.json?.data?.total}`
  );
  const due = await call('/api/v1/progress/due');
  check('anonymous /progress/due -> 401', due.status === 401, `status=${due.status}`);
}

// 25. SPA fallback
{
  const res = await fetch(BASE + '/learn');
  const html = await res.text();
  check('SPA fallback /learn serves app', res.status === 200 && /<!doctype html>/i.test(html) && html.includes('<div id="root"'), `status=${res.status}`);
}

// 26. security headers on static responses
{
  const res = await fetch(BASE + '/');
  check('security headers on client', !!(res.headers.get('content-security-policy') || res.headers.get('x-content-type-options')));
}

// 27. proxy pass-through headers survive (CORS is same-origin; verify no ACAO needed + API reachable via /health alias)
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
        await db.collection('userprogresses').deleteMany({ userId: { $in: ids } });
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
