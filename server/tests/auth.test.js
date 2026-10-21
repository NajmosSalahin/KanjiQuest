import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

let mongod;

// Generous limits so functional tests never trip the limiter; the limit
// itself gets a dedicated test with a pinned low value.
const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };

function cookies(res) {
  const raw = res.headers['set-cookie'] ?? [];
  return Object.fromEntries(
    raw.map((c) => {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      return [pair.slice(0, idx), pair.slice(idx + 1)];
    })
  );
}

async function register(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrfHeaders)
    .send({
      email: 'rina@example.com',
      password: 'garden123',
      displayName: 'Rina',
      ...overrides,
    });
  return res;
}

beforeAll(async () => {
  mongod = await startTestDb();
});
afterAll(async () => {
  await stopTestDb(mongod);
});
beforeEach(async () => {
  await clearDb();
});

describe('POST /auth/register', () => {
  it('creates user + gamification profile and sets session cookies', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: 'rina@example.com', displayName: 'Rina' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.gamification).toMatchObject({
      totalXP: 0,
      currentLevel: 1,
      xpToNextLevel: 100,
      currentStreak: 0,
      coins: 0,
    });

    const setCookie = res.headers['set-cookie'].join(';');
    expect(setCookie).toContain('kg_access=');
    expect(setCookie).toContain('kg_refresh=');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const users = await User.find();
    const profiles = await GamificationProfile.find();
    expect(users).toHaveLength(1);
    expect(String(profiles[0].userId)).toBe(String(users[0]._id));
  });

  it('rejects a duplicate email with 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid payloads with field-level errors', async () => {
    const res = await register({ email: 'nope', password: 'short', displayName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.email).toBeDefined();
    expect(res.body.error.fields.password).toBeDefined();
    expect(res.body.error.fields.displayName).toBeDefined();
  });

  it('requires a number in the password', async () => {
    const res = await register({ password: 'numpassword' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.password[0]).toMatch(/number/);
  });
});

describe('POST /auth/login', () => {
  it('returns the session envelope on success', async () => {
    await register();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set(csrfHeaders)
      .send({ email: 'rina@example.com', password: 'garden123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('rina@example.com');
    expect(res.headers['set-cookie'].join(';')).toContain('kg_access=');
  });

  it('returns the same error for unknown email and wrong password', async () => {
    await register();
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .set(csrfHeaders)
      .send({ email: 'rina@example.com', password: 'wrongpass1' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .set(csrfHeaders)
      .send({ email: 'ghost@example.com', password: 'wrongpass1' });
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Email or password is incorrect.');
    }
  });
});

describe('GET /users/me', () => {
  it('401 without a token, 200 with one', async () => {
    const anon = await request(app).get('/api/v1/users/me');
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('TOKEN_MISSING');

    const registered = await register();
    const access = cookies(registered).kg_access;
    const res = await request(app).get('/api/v1/users/me').set('Cookie', `kg_access=${access}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('rina@example.com');
    expect(res.body.data.gamification.currentLevel).toBe(1);
  });

  it('rejects an expired access token with TOKEN_EXPIRED', async () => {
    const registered = await register();
    const userId = (await User.findOne())._id;
    const expired = jwt.sign({ sub: String(userId) }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: -10,
    });
    const res = await request(app).get('/api/v1/users/me').set('Cookie', `kg_access=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    expect(registered.status).toBe(201);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and revokes the old session', async () => {
    const registered = await register();
    const firstRefresh = cookies(registered).kg_refresh;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${firstRefresh}`);
    expect(res.status).toBe(200);
    const secondRefresh = cookies(res).kg_refresh;
    expect(secondRefresh).toBeDefined();
    expect(secondRefresh).not.toBe(firstRefresh);

    const sessions = await Session.find();
    // Rotation revokes the old row and adds a new one (§8 keeps revokedAt).
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.revokedAt)).toHaveLength(1);
    expect(sessions.filter((s) => !s.revokedAt)).toHaveLength(1);
  });

  it('detects reuse of a rotated token and revokes every session', async () => {
    const registered = await register();
    const firstRefresh = cookies(registered).kg_refresh;

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${firstRefresh}`);
    const validRefresh = cookies(rotated).kg_refresh;

    // Replay the rotated-away token.
    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${firstRefresh}`);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSE_DETECTED');

    // Theft response: even the newest token is now dead.
    const afterTheft = await request(app)
      .post('/api/v1/auth/refresh')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${validRefresh}`);
    expect(afterTheft.status).toBe(401);
  });

  it('401 without a refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').set(csrfHeaders);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_MISSING');
  });
});

describe('POST /auth/logout', () => {
  it('204, clears cookies, and invalidates the refresh token', async () => {
    const registered = await register();
    const refresh = cookies(registered).kg_refresh;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${refresh}`);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toContain('kg_refresh=;');

    const after = await request(app)
      .post('/api/v1/auth/refresh')
      .set(csrfHeaders)
      .set('Cookie', `kg_refresh=${refresh}`);
    expect(after.status).toBe(401);
  });
});

describe('CSRF header requirement (§14)', () => {
  it('rejects state-changing requests without X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rina@example.com', password: 'garden123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_HEADER_MISSING');
  });
});

describe('PATCH /users/me/preferences', () => {
  it('updates allowed preferences and rejects unknown fields', async () => {
    const registered = await register();
    const access = cookies(registered).kg_access;

    const okRes = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set(csrfHeaders)
      .set('Cookie', `kg_access=${access}`)
      .send({ theme: 'dark', dailyGoalXP: 200 });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.preferences).toMatchObject({ theme: 'dark', dailyGoalXP: 200 });

    const bad = await request(app)
      .patch('/api/v1/users/me/preferences')
      .set(csrfHeaders)
      .set('Cookie', `kg_access=${access}`)
      .send({ theme: 'rainbow' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.theme).toBeDefined();
  });
});

describe('rate limiting (§14: 10 req/min auth)', () => {
  it('429s after the auth limit with the standard envelope', async () => {
    const small = createApp({ rateLimits: { general: 10_000, auth: 2 } });
    for (let i = 0; i < 2; i++) {
      await request(small)
        .post('/api/v1/auth/login')
        .set(csrfHeaders)
        .send({ email: 'a@b.co', password: 'x' });
    }
    const res = await request(small)
      .post('/api/v1/auth/login')
      .set(csrfHeaders)
      .send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
