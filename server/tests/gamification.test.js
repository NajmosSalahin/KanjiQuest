import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { User } from '../src/models/User.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };

const KANJI = [
  { character: '水', unicode: '6c34', meanings: ['water'], strokeCount: 4 },
  { character: '火', unicode: '706b', meanings: ['fire'], strokeCount: 4 },
];

let mongod;

function cookieHeader(res) {
  const raw = res.headers['set-cookie'] ?? [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'rina@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrfHeaders)
    .send({ email, password: 'garden123', displayName: 'Rina' });
  return { jar: cookieHeader(res), email };
}

async function profileOf(email = 'rina@example.com') {
  const user = await User.findOne({ email });
  return GamificationProfile.findOne({ userId: user._id });
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

describe('GET /api/v1/gamification/profile', () => {
  it('starts a fresh user at the §11.6 default goal of 50 XP', async () => {
    const { jar } = await signUp();
    const res = await request(app).get('/api/v1/gamification/profile').set('Cookie', jar);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.dailyGoalXP).toBe(50);
    expect(d.currentStreak).toBe(0);
    expect(d.level).toBe(1);
    expect(d.title).toBe('Seedling');
    expect(d.week).toHaveLength(7);
    expect(d.nextMilestone).toBeNull();
    expect(d.achievements).toEqual({ unlocked: 0, total: 41 });
    expect(d.repair.available).toBe(false);
  });

  it('reflects reviews in the 7-day week grid and unlock counts', async () => {
    const { jar } = await signUp();
    await request(app)
      .post('/api/v1/progress/add')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ character: '水' });
    const due = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const reviewed = await request(app)
      .post('/api/v1/progress/review')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ cardId: due.body.data.items[0].id, rating: 2 });
    expect(reviewed.status).toBe(200);

    const res = await request(app).get('/api/v1/gamification/profile').set('Cookie', jar);
    const d = res.body.data;
    expect(d.currentStreak).toBe(1);
    expect(d.week[6].reviews).toBe(1); // today is the last grid slot
    expect(d.week.slice(0, 6).every((slot) => slot.reviews === 0)).toBe(true);
    expect(d.achievements.unlocked).toBe(1); // Hajimemashite
  });

  it('shows the next named milestone once the streak reaches 7 (§7.1 bar)', async () => {
    const { jar } = await signUp();
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { currentStreak: 20, lastActivityDate: new Date().toISOString().slice(0, 10) } }
    );
    const res = await request(app).get('/api/v1/gamification/profile').set('Cookie', jar);
    expect(res.body.data.nextMilestone).toEqual({ days: 30, name: 'Sakura', remaining: 10 });
  });

  it('hides a stale streak after a missed day and offers repair (§11.4)', async () => {
    const { jar } = await signUp();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    // lastActivity 2 days ago => yesterday missed => broken, repairable.
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { currentStreak: 12, longestStreak: 12, lastActivityDate: twoDaysAgo, coins: 150 } }
    );
    const res = await request(app).get('/api/v1/gamification/profile').set('Cookie', jar);
    expect(res.body.data.currentStreak).toBe(0); // stale value not shown
    expect(res.body.data.repair).toMatchObject({
      available: true,
      streakLost: 12,
      cost: 100,
      canAfford: true,
    });
  });

  it('401s without a session', async () => {
    const res = await request(app).get('/api/v1/gamification/profile');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/gamification/achievements', () => {
  it('self-seeds and lists all 41 with unlock status and progress', async () => {
    const { jar } = await signUp();
    const res = await request(app).get('/api/v1/gamification/achievements').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(41);

    const hajimemashite = res.body.data.items.find((a) => a.id === 'hajimemashite');
    expect(hajimemashite.unlocked).toBe(false);
    expect(hajimemashite.progress).toEqual({ current: 0, target: 1 });

    const kanpeki = res.body.data.items.find((a) => a.id === 'kanpeki');
    expect(kanpeki.progress).toBeNull(); // dormant quiz type

    const kokoro = res.body.data.items.find((a) => a.id === 'kokoro');
    expect(kokoro).toMatchObject({ name: 'Kokoro', nameJa: '心', category: 'streak' });
  });

  it('marks unlocked achievements with their unlock date and drops progress', async () => {
    const { jar } = await signUp();
    await request(app)
      .post('/api/v1/progress/add')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ character: '水' });
    const due = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    await request(app)
      .post('/api/v1/progress/review')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ cardId: due.body.data.items[0].id, rating: 2 });

    const res = await request(app).get('/api/v1/gamification/achievements').set('Cookie', jar);
    expect(res.body.data.unlockedCount).toBe(1);
    const hajimemashite = res.body.data.items.find((a) => a.id === 'hajimemashite');
    expect(hajimemashite.unlocked).toBe(true);
    expect(hajimemashite.unlockedAt).toBeTruthy();
    expect(hajimemashite.progress).toBeNull();
  });
});

describe('POST /api/v1/gamification/streak/repair (D10)', () => {
  async function breakStreak(coins = 150) {
    const { jar } = await signUp();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { currentStreak: 12, longestStreak: 12, lastActivityDate: twoDaysAgo, coins } }
    );
    return jar;
  }

  it('409s when nothing is broken', async () => {
    const { jar } = await signUp();
    const res = await request(app)
      .post('/api/v1/gamification/streak/repair')
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STREAK_NOT_REPAIRABLE');
  });

  it('409s without enough coins', async () => {
    const jar = await breakStreak(50);
    const res = await request(app)
      .post('/api/v1/gamification/streak/repair')
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
  });

  it('repairs for 100 coins, unlocks Fukkatsu, and lets the streak continue', async () => {
    const jar = await breakStreak(150);
    const res = await request(app)
      .post('/api/v1/gamification/streak/repair')
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(res.status).toBe(200);
    // The repair also evaluates milestones: streak 12 reaches Kokoro (心, +20 coins).
    expect(res.body.data).toMatchObject({
      repaired: true,
      currentStreak: 12,
      coins: 150 - 100 + 20,
    });
    const ids = res.body.data.newlyUnlocked.map((a) => a.id);
    expect(ids).toContain('fukkatsu');
    expect(ids).toContain('kokoro');
    // Fukkatsu +10 XP and Kokoro +100 XP land too.
    expect(res.body.data.totalXP).toBe(110);

    // The next review chains instead of resetting.
    await request(app)
      .post('/api/v1/progress/add')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ character: '水' });
    const due = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const reviewed = await request(app)
      .post('/api/v1/progress/review')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ cardId: due.body.data.items[0].id, rating: 2 });
    expect(reviewed.body.data.xp.currentStreak).toBe(13);
  });

  it('caps repair at once per calendar month (409)', async () => {
    const jar = await breakStreak(300);
    const first = await request(app)
      .post('/api/v1/gamification/streak/repair')
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(first.status).toBe(200);

    // Simulate a second break later this month, with coins topped up.
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { currentStreak: 8, lastActivityDate: twoDaysAgo, coins: 300 } }
    );
    const second = await request(app)
      .post('/api/v1/gamification/streak/repair')
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('REPAIR_ALREADY_USED');
  });
});
