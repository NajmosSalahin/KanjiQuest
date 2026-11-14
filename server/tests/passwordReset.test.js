import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { Session } from '../src/models/Session.js';
import { PasswordResetToken } from '../src/models/PasswordResetToken.js';
import { sendPasswordResetEmail } from '../src/services/email.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

vi.mock('../src/services/email.js', () => ({
  RESET_TOKEN_TTL_MINUTES: 30,
  sendPasswordResetEmail: vi.fn(async () => ({ delivered: true, provider: 'test' })),
  buildPasswordResetEmail: vi.fn(),
}));

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrf = { 'X-Requested-With': 'XMLHttpRequest' };
const GENERIC_MESSAGE =
  'If an account exists for that email, a reset link is on its way. Check your inbox in a minute.';

let mongod;

async function signUp(email = 'reset@example.com') {
  return request(app)
    .post('/api/v1/auth/register')
    .set(csrf)
    .send({ email, password: 'garden123', displayName: 'Rina' });
}

async function forgot(email) {
  return request(app).post('/api/v1/auth/forgot-password').set(csrf).send({ email });
}

function latestToken() {
  const call = sendPasswordResetEmail.mock.calls.at(-1);
  expect(call).toBeTruthy();
  const url = new URL(call[0].resetUrl);
  return { call: call[0], token: url.searchParams.get('token') };
}

beforeAll(async () => {
  mongod = await startTestDb();
});
afterAll(async () => {
  await stopTestDb(mongod);
});
beforeEach(async () => {
  await clearDb();
  sendPasswordResetEmail.mockClear();
});

describe('POST /auth/forgot-password (D21)', () => {
  it('returns the same generic message for known and unknown accounts', async () => {
    await signUp();
    const known = await forgot('reset@example.com');
    const unknown = await forgot('nobody@example.com');

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data.message).toBe(GENERIC_MESSAGE);
    expect(unknown.body.data.message).toBe(GENERIC_MESSAGE);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const { call, token } = latestToken();
    expect(call.to).toBe('reset@example.com');
    expect(call.displayName).toBe('Rina');
    expect(call.resetUrl).toContain('/reset-password?token=');
    expect(token).toBeTruthy();

    // Only the hash is stored, never the raw token.
    const stored = await PasswordResetToken.findOne();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an invalid email shape without revealing anything', async () => {
    const res = await forgot('not-an-email');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('invalidates the previous link when a new one is requested', async () => {
    await signUp();
    await forgot('reset@example.com');
    const first = latestToken().token;
    await forgot('reset@example.com');
    const second = latestToken().token;

    const stale = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token: first, password: 'newgarden456' });
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('INVALID_RESET_TOKEN');

    const fresh = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token: second, password: 'newgarden456' });
    expect(fresh.status).toBe(200);
  });
});

describe('POST /auth/reset-password (D21)', () => {
  it('sets a new password, consumes the token, and revokes every session', async () => {
    const registered = await signUp();
    expect(registered.headers['set-cookie'].join(';')).toContain('kg_refresh=');
    expect(await Session.countDocuments()).toBe(1);

    await forgot('reset@example.com');
    const { token } = latestToken();

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token, password: 'newgarden456' });

    expect(reset.status).toBe(200);
    expect(reset.body.data.message).toMatch(/Password updated/);
    expect(await Session.countDocuments()).toBe(0);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .set(csrf)
      .send({ email: 'reset@example.com', password: 'garden123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .set(csrf)
      .send({ email: 'reset@example.com', password: 'newgarden456' });
    expect(newLogin.status).toBe(200);

    const replay = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token, password: 'another123' });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired tokens', async () => {
    await signUp();
    await forgot('reset@example.com');
    const { token } = latestToken();
    await PasswordResetToken.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token, password: 'newgarden456' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects unknown tokens and weak passwords', async () => {
    const unknown = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token: 'made-up-token', password: 'newgarden456' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('INVALID_RESET_TOKEN');

    await signUp();
    await forgot('reset@example.com');
    const { token } = latestToken();
    const weak = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token, password: 'nodigits' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect(weak.body.error.fields.password).toBeDefined();

    // A validation failure must not consume the link.
    const good = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(csrf)
      .send({ token, password: 'newgarden456' });
    expect(good.status).toBe(200);
  });
});
