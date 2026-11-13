import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { getLeaderboard } from '../src/services/leaderboard.js';
import { weekStartUTC } from '../src/services/weekly.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrf = { 'X-Requested-With': 'XMLHttpRequest' };
const WEEK = weekStartUTC();
const LAST_WEEK = '2000-01-03';

let mongod;

function cookieHeader(res) {
  return (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function makeUser(email, { totalXP = 0, weeklyXP = 0, weeklyXPWeek = WEEK } = {}) {
  const user = await User.create({
    email,
    passwordHash: 'x',
    displayName: email.split('@')[0],
  });
  await GamificationProfile.create({ userId: user._id, totalXP, weeklyXP, weeklyXPWeek });
  return user;
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

describe('leaderboard service (§6.12)', () => {
  it('orders by XP and shares a competition rank for ties', async () => {
    const first = await makeUser('first@example.com', { weeklyXP: 90 });
    await makeUser('second@example.com', { weeklyXP: 70 });
    await makeUser('third@example.com', { weeklyXP: 70 });
    const board = await getLeaderboard(first._id, 'weekly');
    expect(board.weekStart).toBe(WEEK);
    expect(board.entries.map((entry) => entry.xp)).toEqual([90, 70, 70]);
    expect(board.entries.map((entry) => entry.rank)).toEqual([1, 2, 2]);
    expect(board.entries[0].isYou).toBe(true);
    expect(board.me.rank).toBe(1);
  });

  it('excludes stale weeks and zero-XP users from the top entries', async () => {
    const current = await makeUser('current@example.com', { weeklyXP: 0 });
    await makeUser('stale@example.com', { weeklyXP: 999, weeklyXPWeek: LAST_WEEK });
    await makeUser('active@example.com', { weeklyXP: 15 });
    const board = await getLeaderboard(current._id, 'weekly');
    expect(board.entries.map((entry) => entry.userId)).toEqual([
      (await User.findOne({ email: 'active@example.com' }))._id.toString(),
    ]);
    expect(board.me).toMatchObject({ xp: 0, rank: null, isYou: true });
  });

  it('builds the all-time board from totalXP', async () => {
    const current = await makeUser('alltime@example.com', { totalXP: 120 });
    await makeUser('higher@example.com', { totalXP: 500 });
    const board = await getLeaderboard(current._id, 'allTime');
    expect(board.period).toBe('allTime');
    expect(board.weekStart).toBeNull();
    expect(board.entries[0].xp).toBe(500);
    expect(board.me.rank).toBe(2);
  });

  it('limits the top 100 and still ranks a user outside it', async () => {
    const current = await makeUser('outside@example.com', { weeklyXP: 1 });
    const users = [];
    const profiles = [];
    for (let i = 0; i < 101; i += 1) {
      users.push({
        email: `bulk${i}@example.com`,
        passwordHash: 'x',
        displayName: `Bulk ${i}`,
      });
    }
    const inserted = await User.insertMany(users);
    for (const [i, user] of inserted.entries()) {
      profiles.push({
        userId: user._id,
        weeklyXP: 1000 - i,
        weeklyXPWeek: WEEK,
        totalXP: 1000 - i,
      });
    }
    await GamificationProfile.insertMany(profiles);

    const board = await getLeaderboard(current._id, 'weekly');
    expect(board.entries).toHaveLength(100);
    expect(board.me).toMatchObject({ xp: 1, rank: 102 });
  });

  it('serves the authenticated route with a sticky current row', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set(csrf)
      .send({ email: 'route@example.com', password: 'garden123', displayName: 'Route User' });
    const jar = cookieHeader(reg);
    const res = await request(app).get('/api/v1/leaderboard?period=weekly').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('weekly');
    expect(res.body.data.entries).toEqual([]);
    expect(res.body.data.me).toMatchObject({ xp: 0, rank: null });
    const bad = await request(app).get('/api/v1/leaderboard?period=monthly').set('Cookie', jar);
    expect(bad.status).toBe(400);
  });
});
