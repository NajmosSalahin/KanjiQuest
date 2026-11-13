import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { User } from '../src/models/User.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { UserInventory } from '../src/models/UserInventory.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrf = { 'X-Requested-With': 'XMLHttpRequest' };

let mongod;

function cookieHeader(res) {
  return (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function signUp(email = 'store@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrf)
    .send({ email, password: 'garden123', displayName: 'Store Tester' });
  const user = await User.findOne({ email });
  const profile = await GamificationProfile.findOne({ userId: user._id });
  return { jar: cookieHeader(res), user, profile };
}

async function setCoins(userId, coins) {
  await GamificationProfile.updateOne({ userId }, { $set: { coins } });
}

beforeAll(async () => {
  mongod = await startTestDb();
});

afterAll(async () => {
  await stopTestDb(mongod);
});

beforeEach(async () => {
  await clearDb();
  await Kanji.create({ character: '水', unicode: '6c34', meanings: ['water'], strokeCount: 4 });
});

describe('store catalogue and purchases (§6.11)', () => {
  it('lists all eight items with live affordability', async () => {
    const { jar, profile } = await signUp();
    const res = await request(app).get('/api/v1/store/items').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(8);
    const ids = res.body.data.items.map((item) => item.id);
    expect(ids).toEqual([
      'streak-freeze',
      'xp-boost',
      'title-diligent',
      'title-kokoro',
      'title-yama',
      'frame-sakura',
      'frame-take',
      'frame-tsuki',
    ]);
    expect(res.body.data.coins).toBe(profile.coins);
    expect(res.body.data.items[0]).toMatchObject({
      type: 'freeze',
      price: 50,
      maxActive: 2,
      canBuy: false,
      remainingCoins: 50,
      disabledReason: 'INSUFFICIENT_COINS',
    });
  });

  it('rejects an insufficient-funds purchase with INSUFFICIENT_COINS', async () => {
    const { jar } = await signUp();
    const res = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'streak-freeze' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    const profile = await GamificationProfile.findOne({});
    expect(profile.coins).toBe(0);
  });

  it('deducts coins and grants a streak freeze (max 2)', async () => {
    const { jar, user } = await signUp();
    await setCoins(user._id, 150);
    const first = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'streak-freeze' });
    expect(first.status).toBe(200);
    expect(first.body.data.coins).toBe(100);
    expect(first.body.data.streakFreezes).toBe(1);

    const second = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'streak-freeze' });
    expect(second.status).toBe(200);
    expect(second.body.data.streakFreezes).toBe(2);

    const third = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'streak-freeze' });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('MAX_FREEZES');

    const inventory = await UserInventory.findOne({ userId: user._id, itemId: 'streak-freeze' });
    expect(inventory.quantity).toBe(2);
  });

  it('extends an active XP boost from its current expiry (D17)', async () => {
    const { jar, user } = await signUp();
    await setCoins(user._id, 300);
    const first = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'xp-boost' });
    expect(first.status).toBe(200);
    const firstExpiry = new Date(first.body.data.xpBoostExpiresAt).getTime();
    expect(firstExpiry).toBeGreaterThan(Date.now() + 23 * 3600_000);

    const second = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'xp-boost' });
    const secondExpiry = new Date(second.body.data.xpBoostExpiresAt).getTime();
    expect(secondExpiry - firstExpiry).toBeGreaterThan(23 * 3600_000);
    expect(second.body.data.coins).toBe(100);
  });

  it('buys, equips, and unequips a title', async () => {
    const { jar, user } = await signUp();
    await setCoins(user._id, 40);
    const bought = await request(app)
      .post('/api/v1/gamification/store/purchase')
      .set(csrf)
      .set('Cookie', jar)
      .send({ itemId: 'title-diligent' });
    expect(bought.status).toBe(200);

    const equip = await request(app)
      .post('/api/v1/gamification/store/equip')
      .set(csrf)
      .set('Cookie', jar)
      .send({ slot: 'title', itemId: 'title-diligent' });
    expect(equip.status).toBe(200);
    expect(equip.body.data.equippedTitle).toBe('title-diligent');

    const me = await request(app).get('/api/v1/users/me').set('Cookie', jar);
    expect(me.body.data.gamification.equippedTitle).toBe('title-diligent');

    const unequip = await request(app)
      .post('/api/v1/gamification/store/equip')
      .set(csrf)
      .set('Cookie', jar)
      .send({ slot: 'title', itemId: null });
    expect(unequip.body.data.equippedTitle).toBeNull();
  });

  it('rejects equipping an unowned or wrong-slot item', async () => {
    const { jar } = await signUp();
    const unowned = await request(app)
      .post('/api/v1/gamification/store/equip')
      .set(csrf)
      .set('Cookie', jar)
      .send({ slot: 'title', itemId: 'title-yama' });
    expect(unowned.status).toBe(403);
    expect(unowned.body.error.code).toBe('NOT_OWNED');

    const wrong = await request(app)
      .post('/api/v1/gamification/store/equip')
      .set(csrf)
      .set('Cookie', jar)
      .send({ slot: 'frame', itemId: 'title-yama' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WRONG_SLOT');
  });

  it('consumes a freeze, unlocks Mamori, and decrements inventory', async () => {
    const { jar, user } = await signUp();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await GamificationProfile.updateOne(
      { userId: user._id },
      {
        $set: {
          currentStreak: 5,
          longestStreak: 5,
          lastActivityDate: twoDaysAgo,
          streakFreezes: 1,
        },
      }
    );
    await UserInventory.create({
      userId: user._id,
      itemId: 'streak-freeze',
      type: 'freeze',
      quantity: 1,
    });

    await request(app)
      .post('/api/v1/progress/add')
      .set(csrf)
      .set('Cookie', jar)
      .send({ character: '水' });
    const due = await request(app).get('/api/v1/progress/due').set('Cookie', jar);
    const reviewed = await request(app)
      .post('/api/v1/progress/review')
      .set(csrf)
      .set('Cookie', jar)
      .send({ cardId: due.body.data.items[0].id, rating: 2 });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.xp.newlyUnlocked.map((a) => a.id)).toContain('mamori');

    const profile = await GamificationProfile.findOne({ userId: user._id });
    expect(profile.streakFreezes).toBe(0);
    expect(profile.streakFreezesUsed).toBe(1);
    expect(profile.currentStreak).toBe(6);
    const inventory = await UserInventory.findOne({ userId: user._id, itemId: 'streak-freeze' });
    expect(inventory.quantity).toBe(0);
  });
});
