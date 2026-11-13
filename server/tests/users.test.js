import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { UserInventory } from '../src/models/UserInventory.js';
import { AvatarAsset } from '../src/models/AvatarAsset.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrf = { 'X-Requested-With': 'XMLHttpRequest' };
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7u8AAAAASUVORK5CYII=',
  'base64'
);

let mongod;

function cookieHeader(res) {
  return (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'profile@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrf)
    .send({ email, password: 'garden123', displayName: 'Rina Kobayashi' });
  return { jar: cookieHeader(res), user: await User.findOne({ email }) };
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

describe('profile and account settings (§6.13)', () => {
  it('updates display name, JLPT level, and timezone', async () => {
    const { jar } = await signUp();
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(csrf)
      .set('Cookie', jar)
      .send({ displayName: 'Rina K.', jlptLevel: 5, timezone: 'Asia/Tokyo' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      displayName: 'Rina K.',
      jlptLevel: 5,
      timezone: 'Asia/Tokyo',
    });

    const invalid = await request(app)
      .patch('/api/v1/users/me')
      .set(csrf)
      .set('Cookie', jar)
      .send({ timezone: 'Not/AZone' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('uploads, replaces, serves, and removes an avatar', async () => {
    const { jar } = await signUp();
    const uploaded = await request(app)
      .post('/api/v1/users/me/avatar')
      .set(csrf)
      .set('Cookie', jar)
      .attach('avatar', PNG, { filename: 'avatar.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data.avatarUrl).toMatch(/^\/api\/v1\/assets\/[a-f\d]{24}$/);
    const firstUrl = uploaded.body.data.avatarUrl;

    const served = await request(app).get(firstUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
    expect(served.headers['cache-control']).toContain('immutable');

    const replaced = await request(app)
      .post('/api/v1/users/me/avatar')
      .set(csrf)
      .set('Cookie', jar)
      .attach('avatar', PNG, { filename: 'new.png', contentType: 'image/png' });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.avatarUrl).not.toBe(firstUrl);
    expect((await request(app).get(firstUrl)).status).toBe(404);

    const removed = await request(app)
      .delete('/api/v1/users/me/avatar')
      .set(csrf)
      .set('Cookie', jar);
    expect(removed.status).toBe(200);
    expect(removed.body.data.avatarUrl).toBeNull();
    expect((await request(app).get(replaced.body.data.avatarUrl)).status).toBe(404);
  });

  it('rejects non-image uploads', async () => {
    const { jar } = await signUp();
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set(csrf)
      .set('Cookie', jar)
      .attach('avatar', Buffer.from('<svg></svg>'), {
        filename: 'avatar.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AVATAR_TYPE');
  });

  it('deletes the account only when the display name matches, cascading data', async () => {
    const { jar, user } = await signUp();
    await UserInventory.create({
      userId: user._id,
      itemId: 'title-diligent',
      type: 'title',
      quantity: 1,
    });
    await AvatarAsset.create({
      userId: user._id,
      mimeType: 'image/png',
      size: PNG.length,
      data: PNG,
    });

    const mismatch = await request(app)
      .delete('/api/v1/users/me')
      .set(csrf)
      .set('Cookie', jar)
      .send({ confirmName: 'Someone Else' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('CONFIRM_NAME_MISMATCH');

    const deleted = await request(app)
      .delete('/api/v1/users/me')
      .set(csrf)
      .set('Cookie', jar)
      .send({ confirmName: 'Rina Kobayashi' });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    expect(await User.countDocuments()).toBe(0);
    expect(await GamificationProfile.countDocuments()).toBe(0);
    expect(await UserInventory.countDocuments()).toBe(0);
    expect(await AvatarAsset.countDocuments()).toBe(0);
    const after = await request(app).get('/api/v1/users/me').set('Cookie', jar);
    expect(after.status).toBe(401);
  });
});
