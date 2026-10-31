import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';
import { Kanji } from '../src/models/Kanji.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { Achievement } from '../src/models/Achievement.js';
import {
  ACHIEVEMENT_DEFS,
  CRITERIA,
  DORMANT,
  seedAchievements,
  loadAchievementDefs,
  aggregateLearningSignals,
  profileSignals,
  criteriaMet,
  progressFor,
  evaluateAchievements,
} from '../src/services/achievements.js';

let mongod;

beforeAll(async () => {
  mongod = await startTestDb();
});

afterAll(async () => {
  await stopTestDb(mongod);
});

beforeEach(async () => {
  await clearDb();
});

describe('D11 roster (41 achievements)', () => {
  it('has exactly 41 defs with unique ids and Japanese names', () => {
    expect(ACHIEVEMENT_DEFS).toHaveLength(41);
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(41);
    for (const def of ACHIEVEMENT_DEFS) {
      expect(def.nameJa).toBeTruthy();
      expect(def.icon).toBeUndefined(); // icon key = id, assigned at seed
      expect(def.description).toBeTruthy();
    }
  });

  it('rescales Completionist to 32 of the other 40 (D11)', () => {
    const zenshu = ACHIEVEMENT_DEFS.find((d) => d.id === 'zenshu');
    expect(zenshu.criteria).toEqual({ type: CRITERIA.UNLOCK_COUNT, threshold: 32 });
  });

  it('seeds idempotently into the achievements collection', async () => {
    const first = await seedAchievements();
    expect(first.upsertedCount).toBe(41);
    const second = await seedAchievements();
    expect(second.upsertedCount).toBe(0);
    expect(await Achievement.countDocuments()).toBe(41);
    // Seeded docs carry icon = id and display order.
    const kokoro = await Achievement.findOne({ id: 'kokoro' }).lean();
    expect(kokoro.icon).toBe('kokoro');
    expect(kokoro.rewardCoins).toBe(20);

    const loaded = await loadAchievementDefs();
    expect(loaded).toHaveLength(41);
  });

  it('activates quests in Phase 5 while quiz/store criteria stay dormant', () => {
    expect(DORMANT.has(CRITERIA.QUIZ_ACCURACY)).toBe(true);
    expect(DORMANT.has(CRITERIA.QUEST_SWEEP)).toBe(false);
    expect(DORMANT.has(CRITERIA.FREEZE_USED)).toBe(true);
    expect(DORMANT.has(CRITERIA.STREAK)).toBe(false);
  });
});

describe('criteria + progress (cheap signals)', () => {
  const signals = {
    totalReviews: 120,
    perfectRun: 12,
    streak: 31,
    goalStreak: 8,
    level: 5,
    dailyReviewsCount: 10,
    dailyAgainToday: false,
    reviewsBefore8: 10,
    reviewsAfter23: 3,
    unlockedCount: 4,
    repairCount: 1,
  };

  it('evaluates every Phase-4 criteria type', () => {
    expect(criteriaMet({ type: CRITERIA.FIRST_REVIEW }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.REVIEWS, threshold: 100 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.REVIEWS, threshold: 500 }, signals)).toBe(false);
    expect(criteriaMet({ type: CRITERIA.PERFECT_RUN, threshold: 10 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.PERFECT_RUN, threshold: 25 }, signals)).toBe(false);
    expect(criteriaMet({ type: CRITERIA.PERFECT_DAY, threshold: 10 }, signals)).toBe(true);
    expect(
      criteriaMet(
        { type: CRITERIA.PERFECT_DAY, threshold: 10 },
        { ...signals, dailyAgainToday: true }
      )
    ).toBe(false);
    expect(criteriaMet({ type: CRITERIA.STREAK, threshold: 30 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.GOAL_STREAK, threshold: 7 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.LEVEL, threshold: 5 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.TIME_OF_DAY, beforeHour: 8, count: 10 }, signals)).toBe(
      true
    );
    expect(criteriaMet({ type: CRITERIA.STREAK_REPAIR, threshold: 1 }, signals)).toBe(true);
    expect(criteriaMet({ type: CRITERIA.UNLOCK_COUNT, threshold: 32 }, signals)).toBe(false);
    expect(
      criteriaMet({ type: CRITERIA.ACCURACY_30D, minPercent: 90, minReviews: 30 }, signals)
    ).toBe(false); // no data
  });

  it('renders live progress for locked achievements and null for dormant', () => {
    expect(progressFor({ type: CRITERIA.REVIEWS, threshold: 500 }, signals)).toEqual({
      current: 120,
      target: 500,
    });
    expect(progressFor({ type: CRITERIA.STREAK, threshold: 100 }, signals)).toEqual({
      current: 31,
      target: 100,
    });
    expect(progressFor({ type: CRITERIA.TIME_OF_DAY, afterHour: 23, count: 10 }, signals)).toEqual({
      current: 3,
      target: 10,
    });
    expect(
      progressFor({ type: CRITERIA.QUIZ_ACCURACY, minPercent: 100, minAnswers: 10 }, signals)
    ).toBeNull();
  });
});

describe('aggregateLearningSignals', () => {
  it('counts learned, mastered, per-JLPT mastery, and 30-day accuracy', async () => {
    const userId = new Types.ObjectId();
    await Kanji.create([
      { character: '水', unicode: '6c34', meanings: ['water'], strokeCount: 4, jlptLevel: 5 },
      { character: '火', unicode: '706b', meanings: ['fire'], strokeCount: 4, jlptLevel: 5 },
      { character: '月', unicode: '6708', meanings: ['moon'], strokeCount: 4, jlptLevel: 4 },
    ]);
    const [sui, hi, tsuki] = await Kanji.find().lean();
    const now = new Date();
    await UserProgress.create([
      // Learned + mastered N5 #1
      {
        userId,
        kanjiId: sui._id,
        state: 'review',
        interval: 180,
        dueDate: now,
        lastReviewedAt: now,
        history: [
          { reviewedAt: now, rating: 2, previousInterval: 0, newInterval: 1 },
          { reviewedAt: now, rating: 0, previousInterval: 1, newInterval: 1 },
        ],
      },
      // Learned only (still learning) — N5 #2
      {
        userId,
        kanjiId: hi._id,
        state: 'learning',
        interval: 1,
        dueDate: now,
        lastReviewedAt: now,
        history: [{ reviewedAt: now, rating: 3, previousInterval: 0, newInterval: 1 }],
      },
      // Tracked but never reviewed — not learned
      { userId, kanjiId: tsuki._id, state: 'new', dueDate: now },
    ]);

    const signals = await aggregateLearningSignals(userId);
    expect(signals.learnedCount).toBe(2);
    expect(signals.masteredCount).toBe(1);
    expect(signals.masteredByJlpt).toEqual({ 5: 1 });
    expect(signals.jlptTotals).toEqual({ 5: 2, 4: 1 });
    // 3 reviews in window: 2 Good-or-better, 1 Again => rate 2/3.
    expect(signals.accuracy30).toMatchObject({ total: 3, correct: 2 });
  });
});

describe('evaluateAchievements', () => {
  async function makeProfile(fields = {}) {
    return GamificationProfile.create({ userId: new Types.ObjectId(), ...fields });
  }

  it('unlocks Hajimemashite on the first review and records the date', async () => {
    const profile = await makeProfile({ totalReviews: 1 });
    const { newly, achievementXP } = await evaluateAchievements(profile, {}, {});
    const ids = newly.map((a) => a.id);
    expect(ids).toContain('hajimemashite');
    expect(ids).not.toContain('mebae'); // needs 10 learned kanji
    expect(achievementXP).toBe(20);
    expect(profile.achievementUnlocks.get('hajimemashite')).toBeInstanceOf(Date);
    expect(profile.unlockedAchievementIds).toContain('hajimemashite');
  });

  it('unlocks streak and goal-streak achievements from profile counters', async () => {
    const profile = await makeProfile({ currentStreak: 30, goalStreak: 7 });
    const { newly } = await evaluateAchievements(profile, {}, {});
    const ids = newly.map((a) => a.id);
    expect(ids).toContain('kokoro');
    expect(ids).toContain('tsuki');
    expect(ids).toContain('nanakusa');
    expect(ids).not.toContain('kaze'); // 100 days
    expect(ids).not.toContain('hitasura'); // 14 goal days
    expect(profile.coins).toBe(20 + 50 + 10); // Kokoro 20 + Tsuki 50 + Nanakusa 10
  });

  it('unlocks level titles and their rewards', async () => {
    const profile = await makeProfile({ currentLevel: 10 });
    const { newly, achievementXP } = await evaluateAchievements(profile, {}, {});
    const ids = newly.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['wakaki', 'shibami']));
    expect(achievementXP).toBe(150 + 500);
    expect(profile.coins).toBe(20 + 100);
  });

  it('unlocks Zenshū in the same pass once the count reaches 32', async () => {
    const others = Array.from({ length: 31 }, (_, i) => `other-${i}`);
    const profile = await makeProfile({ unlockedAchievementIds: others, totalReviews: 1 });
    const { newly } = await evaluateAchievements(profile, {}, {});
    // Hajimemashite is the 32nd unlock -> Zenshū follows in the same loop.
    expect(newly.map((a) => a.id)).toEqual(expect.arrayContaining(['hajimemashite', 'zenshu']));
  });

  it('never unlocks dormant quiz/quest/store achievements', async () => {
    const profile = await makeProfile({
      totalReviews: 2000,
      currentPerfectRun: 40,
      currentStreak: 200,
      goalStreak: 40,
      currentLevel: 20,
      dailyReviewsCount: 10,
      reviewsBefore8: 40,
      reviewsAfter23: 40,
      coins: 9999,
      lastStreakRepairAt: new Date(),
    });
    const { newly } = await evaluateAchievements(profile, {}, {});
    const ids = newly.map((a) => a.id);
    expect(ids).not.toContain('kanpeki'); // quiz — Phase 6
    expect(ids).not.toContain('goukaku'); // quests — Phase 5
    expect(ids).not.toContain('mamori'); // freeze — Phase 7
    expect(ids).not.toContain('zenshu'); // needs 32; pool caps at 20 without learned/mastered data
    // Every Phase-4-definable-with-this-profile achievement unlocked.
    expect(new Set(ids)).toEqual(
      new Set([
        'hajimemashite',
        'juren',
        'kokoro',
        'tsuki',
        'kaze',
        'hitasura',
        'nanakusa',
        'misoka',
        'wakaki',
        'shibami',
        'shinrin',
        'joryoku',
        'ippo',
        'tsuzuri',
        'senkai',
        'muso',
        'hyakuten',
        'asagata',
        'yofukashi',
        'fukkatsu',
      ])
    );
  });

  it('is a no-op once everything evaluable is unlocked', async () => {
    const profile = await makeProfile({ totalReviews: 5 });
    await evaluateAchievements(profile, {}, {});
    await profile.save();
    const { newly } = await evaluateAchievements(profile, {}, {});
    expect(newly).toHaveLength(0);
  });

  it('uses repairCount to unlock Fukkatsu only on a repair event', async () => {
    const profile = await makeProfile({});
    const before = await evaluateAchievements(profile, {}, {});
    expect(before.newly.map((a) => a.id)).not.toContain('fukkatsu');

    const fresh = await makeProfile({});
    const during = await evaluateAchievements(fresh, {}, { repairCount: 1 });
    expect(during.newly.map((a) => a.id)).toContain('fukkatsu');
    // Repair unlocks do not depend on profile counters — lastStreakRepairAt
    // is only the progress display's proxy.
    expect(profileSignals(profile).repairCount).toBe(0);
  });
});
