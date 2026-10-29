import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Furigana init is slow and irrelevant here — same stub as kanji.test.js.
vi.mock('../src/services/furigana.js', () => ({
  furiganaTokens: async (sentence) => [{ text: sentence }],
  warmFurigana: () => {},
}));

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { User } from '../src/models/User.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };

const KANJI = [
  {
    character: '日',
    unicode: '65e5',
    meanings: ['day', 'sun'],
    readingsOn: ['ニチ'],
    readingsKun: ['ひ'],
    strokeCount: 4,
    mnemonic: 'The sun door.',
  },
  {
    character: '水',
    unicode: '6c34',
    meanings: ['water'],
    readingsOn: ['スイ'],
    readingsKun: ['みず'],
    strokeCount: 4,
  },
  {
    character: '火',
    unicode: '706b',
    meanings: ['fire'],
    readingsOn: ['カ'],
    readingsKun: ['ひ'],
    strokeCount: 4,
  },
  {
    character: '月',
    unicode: '6708',
    meanings: ['month', 'moon'],
    readingsOn: ['ゲツ', 'ガツ'],
    readingsKun: ['つき'],
    strokeCount: 4,
  },
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

async function add(jar, character) {
  return request(app)
    .post('/api/v1/progress/add')
    .set(csrfHeaders)
    .set('Cookie', jar)
    .send({ character });
}

async function review(jar, cardId, rating) {
  return request(app)
    .post('/api/v1/progress/review')
    .set(csrfHeaders)
    .set('Cookie', jar)
    .send({ cardId, rating });
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

describe('POST /api/v1/progress/add', () => {
  it('creates a new card due now (§7.4 Add to review)', async () => {
    const { jar } = await signUp();
    const res = await add(jar, '水');
    expect(res.status).toBe(201);
    expect(res.body.data.progress).toMatchObject({ state: 'new' });
    expect(new Date(res.body.data.progress.dueDate).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('409s when the kanji is already tracked', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const res = await add(jar, '水');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_IN_REVIEW');
  });

  it('404s for an unknown kanji and 401s without a session', async () => {
    const { jar } = await signUp();
    const missing = await add(jar, 'A');
    expect(missing.status).toBe(404);
    const anon = await request(app)
      .post('/api/v1/progress/add')
      .set(csrfHeaders)
      .send({ character: '水' });
    expect(anon.status).toBe(401);
  });
});

describe('GET /api/v1/progress/due', () => {
  it('returns due cards with kanji content for the §7.2 card back', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const res = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      character: '水',
      meanings: ['water'],
      state: 'new',
      hasStrokeOrder: false,
    });
    expect(res.body.data.total).toBe(1);
  });

  it('caps the queue at dailyReviewLimit (default 20)', async () => {
    const { jar } = await signUp();
    for (const k of KANJI) await add(jar, k.character);
    await User.updateOne(
      { email: 'rina@example.com' },
      { $set: { 'preferences.dailyReviewLimit': 2 } }
    );
    const res = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.limit).toBe(2);
  });

  it('reports the next scheduled review when nothing is due (§7.2 empty state)', async () => {
    const { jar } = await signUp();
    const empty = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(empty.body.data.items).toHaveLength(0);
    expect(empty.body.data.nextDueAt).toBeNull(); // nothing tracked yet

    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    await review(jar, body.data.items[0].id, 2); // Good -> due in 1 day

    const after = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(after.body.data.items).toHaveLength(0);
    expect(new Date(after.body.data.nextDueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('excludes suspended cards until their bury window passes', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const cardId = body.data.items[0].id;
    await request(app).post(`/api/v1/review/${cardId}/suspend`).set(csrfHeaders).set('Cookie', jar);

    const buried = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(buried.body.data.items).toHaveLength(0);

    await UserProgress.updateOne(
      { _id: cardId },
      { $set: { suspendedUntil: new Date(Date.now() - 1000) } }
    );
    const back = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    expect(back.body.data.items).toHaveLength(1);
  });
});

describe('POST /api/v1/progress/review', () => {
  it('applies SRS, appends history, and awards first-review XP (§11.1)', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const res = await review(jar, body.data.items[0].id, 2); // Good

    expect(res.status).toBe(200);
    const { progress, xp } = res.body.data;
    expect(progress).toMatchObject({ state: 'review', interval: 1, repetitions: 1 });
    expect(xp.awarded).toBe(30); // Good 10 + first-review 20
    expect(xp.bonuses).toContain('firstReview');
    // Phase 4: the first review also unlocks Hajimemashite (はじめまして, +20 XP).
    expect(xp.totalXP).toBe(50);
    expect(xp.currentStreak).toBe(1);
    expect(xp.title).toBe('Seedling');
    expect(xp.newlyUnlocked.map((a) => a.id)).toContain('hajimemashite');

    const stored = await UserProgress.findOne({ _id: progress.id }).lean();
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0]).toMatchObject({ rating: 2, xpAwarded: 30 });
    expect(stored.history[0].previous.state).toBe('new');
    // The gami snapshot rides along for the undo's exact counter restore.
    expect(stored.history[0].gami).toMatchObject({ totalReviews: 0, dailyReviewsCount: 0 });
  });

  it('does not re-award first-review XP later the same day', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    await add(jar, '火');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    await review(jar, body.data.items[0].id, 2);
    const second = await review(jar, body.data.items[1].id, 2);
    expect(second.body.data.xp.awarded).toBe(10);
    expect(second.body.data.xp.currentStreak).toBe(1);
  });

  it('crosses the daily goal once (+30) and never again that day', async () => {
    const { jar } = await signUp();
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { dailyGoalXP: 30 } }
    );
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const first = await review(jar, body.data.items[0].id, 3); // Easy: 15+20=35 >= 30 -> +30
    expect(first.body.data.xp.awarded).toBe(65);
    expect(first.body.data.xp.bonuses).toContain('goalMet');

    await add(jar, '火');
    const due2 = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const second = await review(jar, due2.body.data.items[0].id, 3);
    expect(second.body.data.xp.awarded).toBe(15);
  });

  it('extends the streak on the next local day', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    await review(jar, body.data.items[0].id, 2);

    // Pretend the last activity was yesterday (UTC default timezone).
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { lastActivityDate: yesterday, lastReviewDate: yesterday } }
    );
    await add(jar, '火');
    const due2 = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const res = await review(jar, due2.body.data.items[0].id, 2);
    expect(res.body.data.xp.currentStreak).toBe(2);
  });

  it('applies the store XP boost at award time (1.5x, §11.1)', async () => {
    const { jar } = await signUp();
    await GamificationProfile.updateOne(
      { userId: (await User.findOne({ email: 'rina@example.com' }))._id },
      { $set: { xpBoostExpiresAt: new Date(Date.now() + 60_000) } }
    );
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const res = await review(jar, body.data.items[0].id, 2);
    expect(res.body.data.xp.awarded).toBe(45); // (10 + 20) * 1.5
  });

  it('rejects invalid ratings and foreign cards', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const cardId = body.data.items[0].id;

    const bad = await review(jar, cardId, 9);
    expect(bad.status).toBe(400);

    const other = await signUp('other@example.com');
    const foreign = await review(other.jar, cardId, 2);
    expect(foreign.status).toBe(404);
  });
});

describe('POST /api/v1/review/:cardId/undo (§6.5)', () => {
  it('reverts the last review and refunds its XP inside the window', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const cardId = body.data.items[0].id;
    await review(jar, cardId, 2);

    const res = await request(app)
      .post(`/api/v1/review/${cardId}/undo`)
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.progress).toMatchObject({ state: 'new', interval: 0 });
    // Refund is the review XP exactly; Hajimemashite's +20 stays (permanent).
    expect(res.body.data.xp).toMatchObject({ refunded: 30, totalXP: 20 });

    const stored = await UserProgress.findOne({ _id: cardId }).lean();
    expect(stored.history).toHaveLength(0);
  });

  it('409s with nothing to undo and after the window closes', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const cardId = body.data.items[0].id;

    const empty = await request(app)
      .post(`/api/v1/review/${cardId}/undo`)
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(empty.status).toBe(409);
    expect(empty.body.error.code).toBe('NOTHING_TO_UNDO');

    await review(jar, cardId, 2);
    await UserProgress.updateOne(
      { _id: cardId },
      { $set: { 'history.0.reviewedAt': new Date(Date.now() - 60_000) } }
    );
    const late = await request(app)
      .post(`/api/v1/review/${cardId}/undo`)
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('UNDO_WINDOW_CLOSED');
  });
});

describe('GET /api/v1/progress/stats', () => {
  it('aggregates tracked/due/review numbers', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    await add(jar, '火');
    const { body } = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    await review(jar, body.data.items[0].id, 2);
    await review(jar, body.data.items[0].id, 0); // second review on same card

    const res = await request(app).get('/api/v1/progress/stats').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, totalReviews: 2 });
    expect(res.body.data.byState.new).toBe(1); // 火 untouched
    expect(res.body.data.byState).toHaveProperty('relearning'); // again -> relearning
    expect(res.body.data.dueNow).toBeGreaterThanOrEqual(1);
    expect(res.body.data.accuracy).toBeCloseTo(0.5, 5);
  });
});

describe('D8 — DELETE /api/v1/progress/:character and myProgress', () => {
  it('removes the pair with 204 and 404s afterwards', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    const res = await request(app)
      .delete(`/api/v1/progress/${encodeURIComponent('水')}`)
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(res.status).toBe(204);

    const again = await request(app)
      .delete(`/api/v1/progress/${encodeURIComponent('水')}`)
      .set(csrfHeaders)
      .set('Cookie', jar);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('PROGRESS_NOT_FOUND');
  });

  it('surfaces myProgress on the kanji detail: null when untracked, populated when tracked', async () => {
    const { jar } = await signUp();
    const before = await request(app)
      .get(`/api/v1/kanji/${encodeURIComponent('水')}`)
      .set('Cookie', jar);
    expect(before.status).toBe(200);
    expect(before.body.data.myProgress).toBeNull();

    await add(jar, '水');
    const after = await request(app)
      .get(`/api/v1/kanji/${encodeURIComponent('水')}`)
      .set('Cookie', jar);
    expect(after.body.data.myProgress).toMatchObject({
      state: 'new',
      mastered: false,
      suspended: false,
    });
  });
});

describe('D6 status filter with real progress', () => {
  it("status=learning returns the user's tracked kanji for them and nothing for others", async () => {
    const { jar } = await signUp();
    await add(jar, '水');

    const mine = await request(app).get('/api/v1/kanji?status=learning').set('Cookie', jar);
    expect(mine.body.data.total).toBe(1);
    expect(mine.body.data.items[0].character).toBe('水');

    const anon = await request(app).get('/api/v1/kanji?status=learning');
    expect(anon.body.data.total).toBe(0);

    const other = await signUp('other@example.com');
    const theirs = await request(app).get('/api/v1/kanji?status=learning').set('Cookie', other.jar);
    expect(theirs.body.data.total).toBe(0);
  });

  it('status=mastered only counts review cards with interval >= 180d', async () => {
    const { jar } = await signUp();
    await add(jar, '水');
    await add(jar, '火');
    const user = await User.findOne({ email: 'rina@example.com' });
    const progress = await UserProgress.find({ userId: user._id });
    const byChar = new Map(progress.map((p) => [String(p.kanjiId), p]));

    // Promote 水 to mastered and 火 to a young review card.
    const kanji = await Kanji.find({ character: { $in: ['水', '火'] } });
    const ids = new Map(kanji.map((k) => [k.character, String(k._id)]));
    await UserProgress.updateOne(
      { _id: byChar.get(ids.get('水'))._id },
      { $set: { state: 'review', interval: 200 } }
    );
    await UserProgress.updateOne(
      { _id: byChar.get(ids.get('火'))._id },
      { $set: { state: 'review', interval: 10 } }
    );

    const mastered = await request(app).get('/api/v1/kanji?status=mastered').set('Cookie', jar);
    expect(mastered.body.data.items.map((i) => i.character)).toEqual(['水']);

    const learning = await request(app).get('/api/v1/kanji?status=learning').set('Cookie', jar);
    expect(learning.body.data.items.map((i) => i.character)).toEqual(['火']);
  });
});
