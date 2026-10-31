/**
 * Achievements — §11.3 as amended by the owner (D11): 41 definitions, all
 * Japanese-named (romaji + 漢字/かな), Completionist at 32 of 40 others.
 *
 * Definitions are seeded into the `achievements` collection (§8 structured
 * criteria); this module holds the canonical list, the criteria vocabulary,
 * and the evaluator that runs after gamification events (review, repair;
 * quiz/quest/store events join in Phases 5–7).
 */
import { Types } from 'mongoose';
import { XP_BOOST_MULTIPLIER, MASTERED_INTERVAL_DAYS } from '@kanjigarden/shared';
import { Achievement, publicAchievement } from '../models/Achievement.js';
import { UserProgress } from '../models/UserProgress.js';
import { Kanji } from '../models/Kanji.js';

/** Criteria types fed by events that exist by Phase 4. */
export const CRITERIA = Object.freeze({
  FIRST_REVIEW: 'FIRST_REVIEW',
  REVIEWS: 'REVIEWS', // {threshold} total reviews
  PERFECT_RUN: 'PERFECT_RUN', // {threshold} reviews in a row without Again
  PERFECT_DAY: 'PERFECT_DAY', // a day (≥ threshold reviews, default 10) with zero Again
  STREAK: 'STREAK', // {threshold} day streak
  GOAL_STREAK: 'GOAL_STREAK', // {threshold} consecutive goal-met days
  LEVEL: 'LEVEL', // {threshold} level reached
  LEARNED: 'LEARNED', // {threshold} first-reviewed kanji
  MASTERED: 'MASTERED', // {threshold} mastered kanji (review + interval ≥ 180, §10)
  MASTERED_JLPT: 'MASTERED_JLPT', // {level} all N-level kanji mastered
  ACCURACY_30D: 'ACCURACY_30D', // {minPercent, minReviews} over rolling 30 days
  TIME_OF_DAY: 'TIME_OF_DAY', // {beforeHour | afterHour, count} local-time reviews
  STREAK_REPAIR: 'STREAK_REPAIR', // {threshold} paid repairs
  UNLOCK_COUNT: 'UNLOCK_COUNT', // {threshold} other achievements unlocked
  // Dormant until their systems land (quiz Phase 6, quests Phase 5, store 7):
  QUIZ_ACCURACY: 'QUIZ_ACCURACY',
  SPRINT: 'SPRINT',
  STROKE_PERFECT: 'STROKE_PERFECT',
  DRAWING_SCORE: 'DRAWING_SCORE',
  QUEST_SWEEP: 'QUEST_SWEEP',
  QUIZ_MODES_ALL: 'QUIZ_MODES_ALL',
  FREEZE_USED: 'FREEZE_USED',
});

/** Criteria with no producing event yet — evaluator skips, progress is null. */
export const DORMANT = new Set([
  CRITERIA.QUIZ_ACCURACY,
  CRITERIA.SPRINT,
  CRITERIA.STROKE_PERFECT,
  CRITERIA.DRAWING_SCORE,
  CRITERIA.QUIZ_MODES_ALL,
  CRITERIA.FREEZE_USED,
]);

const AGGREGATE_TYPES = new Set([
  CRITERIA.LEARNED,
  CRITERIA.MASTERED,
  CRITERIA.MASTERED_JLPT,
  CRITERIA.ACCURACY_30D,
]);

/** The full D11 roster — order is the display order (learning → special). */
export const ACHIEVEMENT_DEFS = Object.freeze([
  // — Learning (7) —
  {
    id: 'hajimemashite',
    name: 'Hajimemashite',
    nameJa: 'はじめまして',
    description: 'Complete your first review.',
    category: 'learning',
    criteria: { type: CRITERIA.FIRST_REVIEW },
    rewardXP: 20,
    rewardCoins: 0,
  },
  {
    id: 'juren',
    name: 'Jūren',
    nameJa: '十連',
    description: 'Review 10 times in a row without Again.',
    category: 'learning',
    criteria: { type: CRITERIA.PERFECT_RUN, threshold: 10 },
    rewardXP: 50,
    rewardCoins: 0,
  },
  {
    id: 'kanpeki',
    name: 'Kanpeki',
    nameJa: '完璧',
    description: 'Score 100% on a quiz of at least 10 questions.',
    category: 'learning',
    criteria: { type: CRITERIA.QUIZ_ACCURACY, minPercent: 100, minAnswers: 10 },
    rewardXP: 150,
    rewardCoins: 0,
  },
  {
    id: 'sokko',
    name: 'Sokkō',
    nameJa: '速攻',
    description: 'Finish a 60-second sprint with 20+ correct answers.',
    category: 'learning',
    criteria: { type: CRITERIA.SPRINT, maxSeconds: 60, minCorrect: 20 },
    rewardXP: 100,
    rewardCoins: 0,
  },
  {
    id: 'mizu-no-nagare',
    name: 'Mizu no Nagare',
    nameJa: '水の流れ',
    description: 'Hold 90%+ accuracy over the last 30 days (min. 30 reviews).',
    category: 'learning',
    criteria: { type: CRITERIA.ACCURACY_30D, minPercent: 90, minReviews: 30 },
    rewardXP: 300,
    rewardCoins: 0,
  },
  {
    id: 'hitsuwaza',
    name: 'Hitsuwaza',
    nameJa: '筆遣い',
    description: 'Solve 50 stroke-order quizzes perfectly.',
    category: 'learning',
    criteria: { type: CRITERIA.STROKE_PERFECT, count: 50 },
    rewardXP: 250,
    rewardCoins: 0,
  },
  {
    id: 'kaite-miro',
    name: 'Kaite Miro',
    nameJa: '書いてみろ',
    description: 'Score 85+ in 25 drawing quizzes.',
    category: 'learning',
    criteria: { type: CRITERIA.DRAWING_SCORE, count: 25, minScore: 85 },
    rewardXP: 250,
    rewardCoins: 0,
  },

  // — Streak (6) —
  {
    id: 'kokoro',
    name: 'Kokoro',
    nameJa: '心',
    description: 'Keep a 7-day streak.',
    category: 'streak',
    criteria: { type: CRITERIA.STREAK, threshold: 7 },
    rewardXP: 100,
    rewardCoins: 20,
  },
  {
    id: 'tsuki',
    name: 'Tsuki',
    nameJa: '月',
    description: 'Keep a 30-day streak.',
    category: 'streak',
    criteria: { type: CRITERIA.STREAK, threshold: 30 },
    rewardXP: 250,
    rewardCoins: 50,
  },
  {
    id: 'kaze',
    name: 'Kaze',
    nameJa: '風',
    description: 'Keep a 100-day streak.',
    category: 'streak',
    criteria: { type: CRITERIA.STREAK, threshold: 100 },
    rewardXP: 1000,
    rewardCoins: 200,
  },
  {
    id: 'hitasura',
    name: 'Hitasura',
    nameJa: 'ひたすら',
    description: 'Meet your daily goal 14 days in a row.',
    category: 'streak',
    criteria: { type: CRITERIA.GOAL_STREAK, threshold: 14 },
    rewardXP: 200,
    rewardCoins: 30,
  },
  {
    id: 'nanakusa',
    name: 'Nanakusa',
    nameJa: '七草',
    description: 'Meet your daily goal 7 days in a row.',
    category: 'streak',
    criteria: { type: CRITERIA.GOAL_STREAK, threshold: 7 },
    rewardXP: 75,
    rewardCoins: 10,
  },
  {
    id: 'misoka',
    name: 'Misoka',
    nameJa: '三十日',
    description: 'Meet your daily goal 30 days in a row.',
    category: 'streak',
    criteria: { type: CRITERIA.GOAL_STREAK, threshold: 30 },
    rewardXP: 300,
    rewardCoins: 60,
  },

  // — Collection (6) —
  {
    id: 'mebae',
    name: 'Mebae',
    nameJa: '芽生え',
    description: 'Learn 10 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 10 },
    rewardXP: 50,
    rewardCoins: 0,
  },
  {
    id: 'irodori',
    name: 'Irodori',
    nameJa: '彩り',
    description: 'Learn 25 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 25 },
    rewardXP: 100,
    rewardCoins: 0,
  },
  {
    id: 'hyakuji',
    name: 'Hyakuji',
    nameJa: '百字',
    description: 'Learn 100 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 100 },
    rewardXP: 200,
    rewardCoins: 0,
  },
  {
    id: 'nihyakugoji',
    name: 'Nihyakugoji',
    nameJa: '二百五十字',
    description: 'Learn 250 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 250 },
    rewardXP: 400,
    rewardCoins: 0,
  },
  {
    id: 'hayashi',
    name: 'Hayashi',
    nameJa: '林',
    description: 'Learn 500 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 500 },
    rewardXP: 800,
    rewardCoins: 100,
  },
  {
    id: 'senji',
    name: 'Senji',
    nameJa: '千字',
    description: 'Learn 1,000 kanji.',
    category: 'collection',
    criteria: { type: CRITERIA.LEARNED, threshold: 1000 },
    rewardXP: 1000,
    rewardCoins: 150,
  },

  // — Mastery (11) —
  {
    id: 'n5-kansei',
    name: 'N5 Kansei',
    nameJa: 'N5・完成',
    description: 'Master every N5 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED_JLPT, level: 5 },
    rewardXP: 500,
    rewardCoins: 50,
  },
  {
    id: 'n4-kansei',
    name: 'N4 Kansei',
    nameJa: 'N4・完成',
    description: 'Master every N4 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED_JLPT, level: 4 },
    rewardXP: 1000,
    rewardCoins: 100,
  },
  {
    id: 'n3-kansei',
    name: 'N3 Kansei',
    nameJa: 'N3・完成',
    description: 'Master every N3 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED_JLPT, level: 3 },
    rewardXP: 1500,
    rewardCoins: 150,
  },
  {
    id: 'n2-kansei',
    name: 'N2 Kansei',
    nameJa: 'N2・完成',
    description: 'Master every N2 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED_JLPT, level: 2 },
    rewardXP: 2500,
    rewardCoins: 250,
  },
  {
    id: 'n1-kansei',
    name: 'N1 Kansei',
    nameJa: 'N1・完成',
    description: 'Master every N1 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED_JLPT, level: 1 },
    rewardXP: 4000,
    rewardCoins: 400,
  },
  {
    id: 'sodachi',
    name: 'Sodachi',
    nameJa: '育ち',
    description: 'Master 500 kanji.',
    category: 'mastery',
    criteria: { type: CRITERIA.MASTERED, threshold: 500 },
    rewardXP: 600,
    rewardCoins: 75,
  },
  {
    id: 'wakaki',
    name: 'Wakaki',
    nameJa: '若木',
    description: 'Reach level 5 — Young Tree.',
    category: 'mastery',
    criteria: { type: CRITERIA.LEVEL, threshold: 5 },
    rewardXP: 150,
    rewardCoins: 20,
  },
  {
    id: 'shibami',
    name: 'Shibami',
    nameJa: '茂み',
    description: 'Reach level 10 — Thicket.',
    category: 'mastery',
    criteria: { type: CRITERIA.LEVEL, threshold: 10 },
    rewardXP: 500,
    rewardCoins: 100,
  },
  {
    id: 'shinrin',
    name: 'Shinrin',
    nameJa: '深林',
    description: 'Reach level 15 — Deep Forest.',
    category: 'mastery',
    criteria: { type: CRITERIA.LEVEL, threshold: 15 },
    rewardXP: 1000,
    rewardCoins: 200,
  },
  {
    id: 'joryoku',
    name: 'Jōryoku',
    nameJa: '常緑',
    description: 'Reach level 20 — Evergreen.',
    category: 'mastery',
    criteria: { type: CRITERIA.LEVEL, threshold: 20 },
    rewardXP: 2000,
    rewardCoins: 500,
  },
  {
    id: 'zenshu',
    name: 'Zenshū',
    nameJa: '全集',
    description: 'Unlock 32 other achievements.',
    category: 'mastery',
    criteria: { type: CRITERIA.UNLOCK_COUNT, threshold: 32 },
    rewardXP: 1000,
    rewardCoins: 200,
  },

  // — Special (11) —
  {
    id: 'ippo',
    name: 'Ippo',
    nameJa: '一歩',
    description: 'Complete 100 reviews.',
    category: 'special',
    criteria: { type: CRITERIA.REVIEWS, threshold: 100 },
    rewardXP: 30,
    rewardCoins: 0,
  },
  {
    id: 'tsuzuri',
    name: 'Tsuzuri',
    nameJa: '綴',
    description: 'Complete 500 reviews.',
    category: 'special',
    criteria: { type: CRITERIA.REVIEWS, threshold: 500 },
    rewardXP: 150,
    rewardCoins: 0,
  },
  {
    id: 'senkai',
    name: 'Senkai',
    nameJa: '千回',
    description: 'Complete 1,000 reviews.',
    category: 'special',
    criteria: { type: CRITERIA.REVIEWS, threshold: 1000 },
    rewardXP: 300,
    rewardCoins: 50,
  },
  {
    id: 'muso',
    name: 'Musō',
    nameJa: '無双',
    description: 'Review 25 times in a row without Again.',
    category: 'special',
    criteria: { type: CRITERIA.PERFECT_RUN, threshold: 25 },
    rewardXP: 100,
    rewardCoins: 0,
  },
  {
    id: 'hyakuten',
    name: 'Hyakuten',
    nameJa: '百点',
    description: 'Finish a day (10+ reviews) with zero Again.',
    category: 'special',
    criteria: { type: CRITERIA.PERFECT_DAY, threshold: 10 },
    rewardXP: 75,
    rewardCoins: 0,
  },
  {
    id: 'asagata',
    name: 'Asagata',
    nameJa: '朝型',
    description: 'Review 10 times before 8am (your time).',
    category: 'special',
    criteria: { type: CRITERIA.TIME_OF_DAY, beforeHour: 8, count: 10 },
    rewardXP: 50,
    rewardCoins: 0,
  },
  {
    id: 'yofukashi',
    name: 'Yofukashi',
    nameJa: '夜ふかし',
    description: 'Review 10 times after 11pm (your time).',
    category: 'special',
    criteria: { type: CRITERIA.TIME_OF_DAY, afterHour: 23, count: 10 },
    rewardXP: 50,
    rewardCoins: 0,
  },
  {
    id: 'fukkatsu',
    name: 'Fukkatsu',
    nameJa: '復活',
    description: 'Repair a broken streak with coins.',
    category: 'special',
    criteria: { type: CRITERIA.STREAK_REPAIR, threshold: 1 },
    rewardXP: 10,
    rewardCoins: 0,
  },
  {
    id: 'goukaku',
    name: 'Gōkaku',
    nameJa: '合格',
    description: 'Complete all 3 daily quests in one day.',
    category: 'special',
    criteria: { type: CRITERIA.QUEST_SWEEP },
    rewardXP: 75,
    rewardCoins: 0,
  },
  {
    id: 'itsutsu',
    name: 'Itsutsu',
    nameJa: '五つ',
    description: 'Complete every quiz mode at least once.',
    category: 'special',
    criteria: { type: CRITERIA.QUIZ_MODES_ALL, count: 5 },
    rewardXP: 200,
    rewardCoins: 0,
  },
  {
    id: 'mamori',
    name: 'Mamori',
    nameJa: '守り',
    description: 'Save a streak with a streak freeze.',
    category: 'special',
    criteria: { type: CRITERIA.FREEZE_USED },
    rewardXP: 30,
    rewardCoins: 0,
  },
]);

/** Load defs from the DB, falling back to the in-code roster (fresh envs). */
export async function loadAchievementDefs() {
  const stored = await Achievement.find().sort({ order: 1 }).lean();
  if (stored.length > 0) return stored;
  return ACHIEVEMENT_DEFS.map((def, i) => ({ ...def, icon: def.id, order: i + 1 }));
}

/** Idempotent upsert of the canonical 41 defs into `achievements` (§8). */
export async function seedAchievements() {
  const ops = ACHIEVEMENT_DEFS.map((def, i) => ({
    updateOne: {
      filter: { id: def.id },
      update: { $set: { ...def, icon: def.id, order: i + 1 } },
      upsert: true,
    },
  }));
  return Achievement.collection.bulkWrite(ops, { ordered: false });
}

/**
 * Aggregation-derived signals: learned/mastered counts, mastered per JLPT,
 * rolling 30-day accuracy. One $facet round trip + static JLPT totals.
 */
export async function aggregateLearningSignals(userId, now = new Date()) {
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);
  const match = { userId: new Types.ObjectId(String(userId)) };

  const [facets, jlptRows] = await Promise.all([
    UserProgress.aggregate([
      { $match: match },
      {
        $lookup: {
          from: Kanji.collection.collectionName,
          localField: 'kanjiId',
          foreignField: '_id',
          as: 'k',
        },
      },
      { $unwind: '$k' },
      {
        $facet: {
          learned: [{ $match: { lastReviewedAt: { $ne: null } } }, { $count: 'n' }],
          mastered: [
            { $match: { state: 'review', interval: { $gte: MASTERED_INTERVAL_DAYS } } },
            { $count: 'n' },
          ],
          masteredByJlpt: [
            {
              $match: {
                state: 'review',
                interval: { $gte: MASTERED_INTERVAL_DAYS },
                'k.jlptLevel': { $in: [1, 2, 3, 4, 5] },
              },
            },
            { $group: { _id: '$k.jlptLevel', n: { $sum: 1 } } },
          ],
          accuracy: [
            { $match: { 'history.reviewedAt': { $gte: windowStart } } },
            { $unwind: '$history' },
            { $match: { 'history.reviewedAt': { $gte: windowStart } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                correct: {
                  $sum: { $cond: [{ $gte: ['$history.rating', 2] }, 1, 0] },
                },
              },
            },
          ],
        },
      },
    ]),
    Kanji.aggregate([
      { $match: { jlptLevel: { $in: [1, 2, 3, 4, 5] } } },
      { $group: { _id: '$jlptLevel', n: { $sum: 1 } } },
    ]),
  ]);

  const f = facets[0] ?? {};
  const accuracy = (f.accuracy ?? [])[0] ?? null;
  const masteredByJlpt = {};
  for (const row of f.masteredByJlpt ?? []) masteredByJlpt[row._id] = row.n;
  const jlptTotals = {};
  for (const row of jlptRows) jlptTotals[row._id] = row.n;

  return {
    learnedCount: (f.learned ?? [])[0]?.n ?? 0,
    masteredCount: (f.mastered ?? [])[0]?.n ?? 0,
    masteredByJlpt,
    jlptTotals,
    accuracy30: accuracy
      ? {
          total: accuracy.total,
          correct: accuracy.correct,
          rate: accuracy.correct / accuracy.total,
        }
      : null,
  };
}

/** Cheap signals — everything readable straight off the profile. */
export function profileSignals(profile, extra = {}) {
  return {
    totalReviews: profile.totalReviews,
    perfectRun: profile.currentPerfectRun,
    streak: profile.currentStreak,
    goalStreak: profile.goalStreak,
    level: profile.currentLevel,
    dailyReviewsCount: profile.dailyReviewsCount,
    dailyAgainToday: profile.dailyAgainToday,
    reviewsBefore8: profile.reviewsBefore8,
    reviewsAfter23: profile.reviewsAfter23,
    unlockedCount: profile.unlockedAchievementIds.length,
    repairCount: profile.lastStreakRepairAt ? 1 : 0,
    ...extra,
  };
}

/** Criteria check (shared by the evaluator and progress rendering). */
export function criteriaMet(criteria, signals) {
  switch (criteria.type) {
    case CRITERIA.FIRST_REVIEW:
      return signals.totalReviews >= 1;
    case CRITERIA.REVIEWS:
      return signals.totalReviews >= criteria.threshold;
    case CRITERIA.PERFECT_RUN:
      return signals.perfectRun >= criteria.threshold;
    case CRITERIA.PERFECT_DAY:
      return signals.dailyReviewsCount >= (criteria.threshold ?? 10) && !signals.dailyAgainToday;
    case CRITERIA.STREAK:
      return signals.streak >= criteria.threshold;
    case CRITERIA.GOAL_STREAK:
      return signals.goalStreak >= criteria.threshold;
    case CRITERIA.LEVEL:
      return signals.level >= criteria.threshold;
    case CRITERIA.LEARNED:
      return (signals.learnedCount ?? 0) >= criteria.threshold;
    case CRITERIA.MASTERED:
      return (signals.masteredCount ?? 0) >= criteria.threshold;
    case CRITERIA.MASTERED_JLPT: {
      const have = signals.masteredByJlpt?.[criteria.level] ?? 0;
      const total = signals.jlptTotals?.[criteria.level] ?? 0;
      return total > 0 && have >= total;
    }
    case CRITERIA.ACCURACY_30D: {
      const acc = signals.accuracy30;
      return !!acc && acc.total >= criteria.minReviews && acc.rate >= criteria.minPercent / 100;
    }
    case CRITERIA.TIME_OF_DAY:
      return (
        (criteria.beforeHour ? signals.reviewsBefore8 : signals.reviewsAfter23) >= criteria.count
      );
    case CRITERIA.STREAK_REPAIR:
      return (signals.repairCount ?? 0) >= criteria.threshold;
    case CRITERIA.QUEST_SWEEP:
      return (signals.questSweep ?? 0) >= 1;
    case CRITERIA.UNLOCK_COUNT:
      return signals.unlockedCount >= criteria.threshold;
    default:
      return false; // dormant quiz/quest/freeze types
  }
}

/** Live progress for a locked achievement ({current, target}) or null. */
export function progressFor(criteria, signals) {
  switch (criteria.type) {
    case CRITERIA.FIRST_REVIEW:
      return { current: signals.totalReviews, target: 1 };
    case CRITERIA.REVIEWS:
      return { current: signals.totalReviews, target: criteria.threshold };
    case CRITERIA.PERFECT_RUN:
      return { current: signals.perfectRun, target: criteria.threshold };
    case CRITERIA.PERFECT_DAY:
      return { current: signals.dailyReviewsCount, target: criteria.threshold ?? 10 };
    case CRITERIA.STREAK:
      return { current: signals.streak, target: criteria.threshold };
    case CRITERIA.GOAL_STREAK:
      return { current: signals.goalStreak, target: criteria.threshold };
    case CRITERIA.LEVEL:
      return { current: signals.level, target: criteria.threshold };
    case CRITERIA.LEARNED:
      return { current: signals.learnedCount ?? 0, target: criteria.threshold };
    case CRITERIA.MASTERED:
      return { current: signals.masteredCount ?? 0, target: criteria.threshold };
    case CRITERIA.MASTERED_JLPT:
      return {
        current: signals.masteredByJlpt?.[criteria.level] ?? 0,
        target: signals.jlptTotals?.[criteria.level] ?? 0,
      };
    case CRITERIA.ACCURACY_30D:
      return {
        current: Math.round((signals.accuracy30?.rate ?? 0) * 100),
        target: criteria.minPercent,
      };
    case CRITERIA.TIME_OF_DAY:
      return {
        current: criteria.beforeHour ? signals.reviewsBefore8 : signals.reviewsAfter23,
        target: criteria.count,
      };
    case CRITERIA.STREAK_REPAIR:
      return { current: signals.repairCount ?? 0, target: criteria.threshold };
    case CRITERIA.QUEST_SWEEP:
      return { current: signals.questSweep ?? 0, target: 1 };
    case CRITERIA.UNLOCK_COUNT:
      return { current: signals.unlockedCount, target: criteria.threshold };
    default:
      return null; // dormant types show "Locked" without progress (§6.10)
  }
}

/** 1.5x store boost at award time, server-side (§11.1 — "all XP"). */
function boosted(profile, amount, now) {
  return profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now
    ? Math.round(amount * XP_BOOST_MULTIPLIER)
    : amount;
}

/**
 * Evaluate every locked, non-dormant achievement against current signals.
 * Mutates the profile (unlocks, coins, unlock dates) and returns the fresh
 * unlocks plus their XP total (already boosted) for the caller to fold into
 * totalXP and recompute the level.
 */
export async function evaluateAchievements(
  profile,
  user,
  { now = new Date(), repairCount, questSweep } = {}
) {
  const defs = await loadAchievementDefs();
  const unlocked = new Set(profile.unlockedAchievementIds);
  const extra = {
    ...(repairCount !== undefined ? { repairCount } : {}),
    ...(questSweep ? { questSweep } : {}),
  };
  const signals = profileSignals(profile, extra);

  const needsAggregates = defs.some(
    (def) =>
      !unlocked.has(def.id) &&
      !DORMANT.has(def.criteria.type) &&
      AGGREGATE_TYPES.has(def.criteria.type)
  );
  if (needsAggregates) {
    Object.assign(signals, await aggregateLearningSignals(profile.userId, now));
  }

  const newly = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of defs) {
      if (unlocked.has(def.id) || DORMANT.has(def.criteria.type)) continue;
      if (criteriaMet(def.criteria, signals)) {
        unlocked.add(def.id);
        signals.unlockedCount = unlocked.size; // feed Zenshū in the same pass
        newly.push(def);
        changed = true;
      }
    }
  }

  let achievementXP = 0;
  for (const def of newly) {
    profile.unlockedAchievementIds.push(def.id);
    if (profile.achievementUnlocks instanceof Map) {
      profile.achievementUnlocks.set(def.id, now);
    }
    profile.coins += def.rewardCoins ?? 0;
    achievementXP += boosted(profile, def.rewardXP ?? 0, now);
  }

  return { newly: newly.map(publicAchievement), achievementXP };
}
