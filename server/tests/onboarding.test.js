import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { User } from '../src/models/User.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrf = { 'X-Requested-With': 'XMLHttpRequest' };

let mongod;

const KANJI = [
  { character: '日', unicode: '65e5', strokeCount: 4, jlptLevel: 5, frequencyRank: 1 },
  { character: '月', unicode: '6708', strokeCount: 4, jlptLevel: 5, frequencyRank: 2 },
  { character: '火', unicode: '706b', strokeCount: 4, jlptLevel: 5, frequencyRank: 3 },
  { character: '会', unicode: '4f1a', strokeCount: 6, jlptLevel: 4, frequencyRank: 10 },
  { character: '学', unicode: '5b66', strokeCount: 8, jlptLevel: 4, frequencyRank: 11 },
  { character: '政', unicode: '653f', strokeCount: 9, jlptLevel: 3, frequencyRank: 20 },
];

function cookieHeader(res) {
  return (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'onboarding@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrf)
    .send({ email, password: 'garden123', displayName: 'Rina' });
  return { jar: cookieHeader(res), res, user: await User.findOne({ email }) };
}

function onboarding(jar, body) {
  return request(app).post('/api/v1/users/me/onboarding').set(csrf).set('Cookie', jar).send(body);
}

beforeAll(async () => {
  mongod = await startTestDb();
});
afterAll(async () => {
  await stopTestDb(mongod);
});
beforeEach(async () => {
  await clearDb();
  await Kanji.create(KANJI);
});

describe('Phase 8 onboarding (D20)', () => {
  it('starts incomplete for new accounts', async () => {
    const { res } = await signUp();
    expect(res.body.data.user.preferences.onboardingCompleted).toBe(false);
  });

  it('preloads the chosen JLPT level, due now, with pace and reminders', async () => {
    const { jar, user } = await signUp();

    const res = await onboarding(jar, {
      level: 4,
      dailyReviewLimit: 40,
      reminderTime: '20:00',
      reminderEnabled: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.preloadedCount).toBe(2);
    expect(res.body.data.alreadyCompleted).toBe(false);
    expect(res.body.data.user).toMatchObject({
      jlptLevel: 4,
      preferences: {
        onboardingCompleted: true,
        dailyReviewLimit: 40,
        reminderTime: '20:00',
        reminderEnabled: true,
      },
    });

    const rows = await UserProgress.find({ userId: user._id });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.state).toBe('new');
      expect(row.dueDate.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('skip uses defaults and preloads N5', async () => {
    const { jar, user } = await signUp();

    const res = await onboarding(jar, { skipped: true });

    expect(res.status).toBe(200);
    expect(res.body.data.preloadedCount).toBe(3);
    expect(res.body.data.user).toMatchObject({
      jlptLevel: 5,
      preferences: {
        onboardingCompleted: true,
        dailyReviewLimit: 20,
        reminderTime: null,
        reminderEnabled: false,
      },
    });
    expect(await UserProgress.countDocuments({ userId: user._id })).toBe(3);
  });

  it('is idempotent — a retry never duplicates progress rows', async () => {
    const { jar, user } = await signUp();
    await onboarding(jar, { level: 5, dailyReviewLimit: 10 });

    const retry = await onboarding(jar, { level: 3, dailyReviewLimit: 40 });

    expect(retry.status).toBe(200);
    expect(retry.body.data.alreadyCompleted).toBe(true);
    expect(retry.body.data.preloadedCount).toBe(0);
    expect(retry.body.data.user.jlptLevel).toBe(5);
    expect(retry.body.data.user.preferences.dailyReviewLimit).toBe(10);
    expect(await UserProgress.countDocuments({ userId: user._id })).toBe(3);
  });

  it('treats legacy accounts without the field as complete', async () => {
    const { jar, user } = await signUp();
    await User.updateOne({ _id: user._id }, { $unset: { 'preferences.onboardingCompleted': 1 } });

    const me = await request(app).get('/api/v1/users/me').set(csrf).set('Cookie', jar);
    expect(me.status).toBe(200);
    expect(me.body.data.user.preferences.onboardingCompleted).toBe(true);

    const retry = await onboarding(jar, { level: 3 });
    expect(retry.status).toBe(200);
    expect(retry.body.data.alreadyCompleted).toBe(true);
    expect(retry.body.data.preloadedCount).toBe(0);
  });

  it('rejects a level outside N5/N4/N3', async () => {
    const { jar } = await signUp();
    const res = await onboarding(jar, { level: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.level).toBeDefined();
  });
});
