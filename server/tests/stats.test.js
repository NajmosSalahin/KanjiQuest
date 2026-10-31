import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { User } from '../src/models/User.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };
let mongod;

function cookieHeader(res) {
  const raw = res.headers['set-cookie'] ?? [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'stats@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrfHeaders)
    .send({ email, password: 'garden123', displayName: 'Stats Tester' });
  expect(res.status).toBe(201);
  return { jar: cookieHeader(res), user: await User.findOne({ email }) };
}

function dayAt(offset, hour = 12) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function dayKey(offset) {
  return dayAt(offset).toISOString().slice(0, 10);
}

function historyEntry(reviewedAt, rating) {
  return {
    reviewedAt,
    rating,
    previousInterval: 0,
    newInterval: 1,
    xpAwarded: 0,
  };
}

async function seedStatsFixtures(user) {
  const kanji = await Kanji.create([
    { character: '日', unicode: '65e5', meanings: ['day'], strokeCount: 4, jlptLevel: 5 },
    { character: '水', unicode: '6c34', meanings: ['water'], strokeCount: 4, jlptLevel: 5 },
    { character: '火', unicode: '706b', meanings: ['fire'], strokeCount: 4, jlptLevel: 4 },
    { character: '木', unicode: '6728', meanings: ['tree'], strokeCount: 4, jlptLevel: 3 },
  ]);

  const history = [];
  for (let i = 0; i < 10; i++) history.push(historyEntry(dayAt(-1), i < 8 ? 2 : 0));
  for (let i = 0; i < 10; i++) history.push(historyEntry(dayAt(-2), i < 3 ? 2 : 0));
  for (let i = 0; i < 5; i++) history.push(historyEntry(dayAt(-3), 3));

  await UserProgress.create([
    {
      userId: user._id,
      kanjiId: kanji[0]._id,
      state: 'review',
      interval: 200,
      dueDate: dayAt(1),
      history,
    },
    {
      userId: user._id,
      kanjiId: kanji[1]._id,
      state: 'review',
      interval: 10,
      dueDate: dayAt(0),
    },
    {
      userId: user._id,
      kanjiId: kanji[2]._id,
      state: 'learning',
      interval: 10,
      dueDate: dayAt(2),
    },
    {
      userId: user._id,
      kanjiId: kanji[3]._id,
      state: 'new',
      dueDate: dayAt(40),
    },
  ]);
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

describe('GET /api/v1/stats (§7.7)', () => {
  it('returns heatmap, forecast, accuracy, JLPT statuses, and best/worst days', async () => {
    const { jar, user } = await signUp();
    await seedStatsFixtures(user);

    const res = await request(app).get('/api/v1/stats').set('Cookie', jar);
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.heatmap).toHaveLength(365);
    expect(data.heatmap.at(-1).date).toBe(dayKey(0));
    expect(data.heatmap.find((d) => d.date === dayKey(-1)).reviews).toBe(10);

    expect(data.forecast).toHaveLength(30);
    expect(data.forecast.at(0)).toMatchObject({ date: dayKey(0), count: 1 });
    expect(data.forecast.find((d) => d.date === dayKey(1))).toMatchObject({ count: 1 });
    expect(data.forecast.find((d) => d.date === dayKey(2))).toMatchObject({ count: 1 });
    expect(data.forecast.at(-1).date).toBe(dayKey(29));
    expect(data.forecast.reduce((sum, day) => sum + day.count, 0)).toBe(3);

    expect(data.accuracy.points).toHaveLength(30);
    expect(data.accuracy.total).toBe(25);
    expect(data.accuracy.good).toBe(16);
    expect(data.accuracy.rate).toBe(64);
    expect(data.accuracy.points.find((p) => p.date === dayKey(-1))).toMatchObject({
      total: 10,
      good: 8,
      rate: 80,
    });

    expect(data.jlpt).toHaveLength(3);
    expect(data.jlpt[0]).toMatchObject({
      level: 5,
      total: 2,
      new: 0,
      learning: 0,
      review: 1,
      mastered: 1,
    });
    expect(data.jlpt[1]).toMatchObject({ level: 4, total: 1, learning: 1 });
    expect(data.jlpt[2]).toMatchObject({ level: 3, total: 1, new: 1 });

    expect(data.bestWorst.best).toHaveLength(2);
    expect(data.bestWorst.best[0]).toMatchObject({ date: dayKey(-1), total: 10, rate: 80 });
    expect(data.bestWorst.worst[0]).toMatchObject({ date: dayKey(-2), total: 10, rate: 30 });
  });

  it('supports range query parameters and rejects invalid ranges', async () => {
    const { jar, user } = await signUp();
    await seedStatsFixtures(user);

    const heatmap = await request(app).get('/api/v1/stats/heatmap?range=7').set('Cookie', jar);
    expect(heatmap.status).toBe(200);
    expect(heatmap.body.data).toHaveLength(7);

    const forecast = await request(app).get('/api/v1/stats/forecast?days=7').set('Cookie', jar);
    expect(forecast.status).toBe(200);
    expect(forecast.body.data).toHaveLength(7);

    const accuracy = await request(app).get('/api/v1/stats/accuracy?days=7').set('Cookie', jar);
    expect(accuracy.status).toBe(200);
    expect(accuracy.body.data.days).toBe(7);

    const bestWorst = await request(app).get('/api/v1/stats/best-worst?days=7').set('Cookie', jar);
    expect(bestWorst.status).toBe(200);
    expect(bestWorst.body.data.days).toBe(7);

    const invalid = await request(app).get('/api/v1/stats/accuracy?days=0').set('Cookie', jar);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401s without a session', async () => {
    const res = await request(app).get('/api/v1/stats');
    expect(res.status).toBe(401);
  });
});
