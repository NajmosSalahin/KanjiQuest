import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { QuestDef } from '../src/models/QuestDef.js';
import { User } from '../src/models/User.js';
import { UserQuest } from '../src/models/UserQuest.js';
import {
  QUEST_DEFS,
  selectDailyQuestIds,
  seedQuestDefs,
  loadQuestDefs,
  trackQuestEvent,
} from '../src/services/quests.js';
import { localDay } from '../src/services/time.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };
let mongod;

function cookieHeader(res) {
  const raw = res.headers['set-cookie'] ?? [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'quests@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrfHeaders)
    .send({ email, password: 'garden123', displayName: 'Quest Tester' });
  expect(res.status).toBe(201);
  const user = await User.findOne({ email });
  return { jar: cookieHeader(res), user };
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

describe('quest definitions (§6.7)', () => {
  it('seeds exactly 12 quests with 20–50 XP and 5–15 coins', async () => {
    await seedQuestDefs();
    const defs = await loadQuestDefs();
    expect(defs).toHaveLength(12);
    expect(QUEST_DEFS).toHaveLength(12);
    for (const def of defs) {
      expect(def.target).toBeGreaterThanOrEqual(1);
      expect(def.xpReward).toBeGreaterThanOrEqual(20);
      expect(def.xpReward).toBeLessThanOrEqual(50);
      expect(def.coinReward).toBeGreaterThanOrEqual(5);
      expect(def.coinReward).toBeLessThanOrEqual(15);
    }
    expect(await QuestDef.countDocuments()).toBe(12);
    expect(new Set(QUEST_DEFS.map((def) => def.id)).size).toBe(12);
  });

  it('selects three unique quests deterministically per user + day', () => {
    const a = selectDailyQuestIds('656f00000000000000000001', '2026-10-31');
    const b = selectDailyQuestIds('656f00000000000000000001', '2026-10-31');
    const c = selectDailyQuestIds('656f00000000000000000001', '2026-11-01');
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
    expect(a).not.toEqual(c);
    for (const id of a) {
      const def = QUEST_DEFS.find((quest) => quest.id === id);
      expect(def.phase).toBe(5);
    }
  });
});

describe('GET /api/v1/quests/today', () => {
  it('creates and persists three quests with schema fields and the sweep reward', async () => {
    const { jar } = await signUp();
    const first = await request(app).get('/api/v1/quests/today').set('Cookie', jar);
    expect(first.status).toBe(200);
    const data = first.body.data;
    expect(data.quests).toHaveLength(3);
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.sweepReward).toBe(30);
    expect(data.allDone).toBe(false);
    for (const quest of data.quests) {
      expect(quest).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        target: expect.any(Number),
        progress: 0,
        completed: false,
        xpReward: expect.any(Number),
        coinReward: expect.any(Number),
      });
      expect(quest.id).not.toMatch(/^quiz-|drawing|stroke/);
    }

    const second = await request(app).get('/api/v1/quests/today').set('Cookie', jar);
    expect(second.body.data.quests.map((q) => q.id)).toEqual(data.quests.map((q) => q.id));
    expect(
      await UserQuest.countDocuments({
        userId: (await User.findOne({ email: 'quests@example.com' }))._id,
      })
    ).toBe(3);
  });

  it('401s without a session', async () => {
    const res = await request(app).get('/api/v1/quests/today');
    expect(res.status).toBe(401);
  });
});

describe('trackQuestEvent', () => {
  it('awards per-quest rewards and the +30 sweep exactly once', async () => {
    const { user } = await signUp();
    const now = new Date();
    const date = localDay(now, user.timezone);
    await UserQuest.deleteMany({ userId: user._id, date });
    await UserQuest.create([
      {
        userId: user._id,
        date,
        questId: 'review-10',
        title: 'Review 10 cards',
        target: 10,
        xpReward: 25,
        coinReward: 5,
        progress: 9,
        order: 1,
      },
      {
        userId: user._id,
        date,
        questId: 'learn-3',
        title: 'Learn 3 new kanji',
        target: 3,
        xpReward: 30,
        coinReward: 8,
        progress: 2,
        order: 2,
      },
      {
        userId: user._id,
        date,
        questId: 'clear-due',
        title: 'Clear the queue',
        target: 1,
        xpReward: 35,
        coinReward: 10,
        progress: 0,
        order: 3,
      },
    ]);

    const result = await trackQuestEvent(
      user,
      { type: 'review', rating: 2, wasNew: true, dueCleared: true, dailyXPProgress: 100 },
      now
    );
    expect(result.completed).toHaveLength(3);
    expect(result.questXP).toBe(90);
    expect(result.questCoins).toBe(23);
    expect(result.sweep.awarded).toBe(30);
    expect(result.profile.newlyUnlocked.map((a) => a.id)).toContain('goukaku');
    expect(result.profile.totalXP).toBe(195); // 90 quest + 30 sweep + 75 Gōkaku
    const profile = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(profile.totalXP).toBe(195);
    expect(profile.coins).toBe(23);
    const rows = await UserQuest.find({ userId: user._id, date }).sort({ order: 1 }).lean();
    expect(rows.every((row) => row.completed && row.rewardClaimed && row.sweepAwarded)).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.xpAwarded, 0)).toBe(90);

    const again = await trackQuestEvent(
      user,
      { type: 'review', rating: 2, wasNew: true, dueCleared: true, dailyXPProgress: 110 },
      now
    );
    expect(again.questXP).toBe(0);
    expect(again.sweep).toBeNull();
    expect(again.completed).toEqual([]);
    const unchanged = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(unchanged.totalXP).toBe(195);
    expect(unchanged.coins).toBe(23);
  });

  it('resets the five-in-a-row quest on a miss and completes it on five Good ratings', async () => {
    const { user } = await signUp();
    const now = new Date();
    const date = localDay(now, user.timezone);
    await UserQuest.deleteMany({ userId: user._id, date });
    await UserQuest.create([
      {
        userId: user._id,
        date,
        questId: 'correct-5',
        title: 'Five in a row',
        target: 5,
        xpReward: 30,
        coinReward: 6,
        progress: 4,
        order: 1,
      },
      {
        userId: user._id,
        date,
        questId: 'review-20',
        title: 'Review 20 cards',
        target: 20,
        xpReward: 40,
        coinReward: 8,
        progress: 0,
        order: 2,
      },
      {
        userId: user._id,
        date,
        questId: 'learn-3',
        title: 'Learn 3 new kanji',
        target: 3,
        xpReward: 30,
        coinReward: 8,
        progress: 0,
        order: 3,
      },
    ]);

    await trackQuestEvent(user, { type: 'review', rating: 0, wasNew: false }, now);
    let row = await UserQuest.findOne({
      userId: user._id,
      date,
      questId: 'correct-5',
    }).lean();
    expect(row.progress).toBe(0);
    expect(row.completed).toBe(false);

    for (let i = 0; i < 4; i++) {
      await trackQuestEvent(user, { type: 'review', rating: 2, wasNew: false }, now);
    }
    row = await UserQuest.findOne({ userId: user._id, date, questId: 'correct-5' }).lean();
    expect(row.progress).toBe(4);
    expect(row.completed).toBe(false);

    const final = await trackQuestEvent(user, { type: 'review', rating: 3, wasNew: false }, now);
    row = await UserQuest.findOne({ userId: user._id, date, questId: 'correct-5' }).lean();
    expect(row.progress).toBe(5);
    expect(row.completed).toBe(true);
    expect(final.completed.map((q) => q.id)).toEqual(['correct-5']);
    expect(final.questXP).toBe(30);
    expect(final.questCoins).toBe(6);
  });
});
