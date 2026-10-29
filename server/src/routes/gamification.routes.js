import { Router } from 'express';
import { Types } from 'mongoose';
import { LEVEL_TITLES, STORE } from '@kanjigarden/shared';
import { User } from '../models/User.js';
import { UserProgress } from '../models/UserProgress.js';
import { Achievement, publicAchievement } from '../models/Achievement.js';
import { ensureGamificationProfile, gamificationSummary } from '../models/GamificationProfile.js';
import {
  loadAchievementDefs,
  aggregateLearningSignals,
  profileSignals,
  progressFor,
  evaluateAchievements,
  seedAchievements,
} from '../services/achievements.js';
import { displayStreak, nextMilestone, repairStatus, applyRepair } from '../services/streak.js';
import { computeLevel } from '../services/xp.js';
import { localDay, addDays } from '../services/time.js';
import { ok, fail } from '../utils/envelope.js';

export const gamificationRouter = Router();

// GET /api/v1/gamification/profile — dashboard payload (§9: XP, level,
// streak, coins, achievements) plus streak-card/repair state for §7.1.
gamificationRouter.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('timezone preferences').lean();
    const profile = await ensureGamificationProfile(user._id, user.preferences?.dailyGoalXP);
    const tz = user.timezone ?? 'UTC';
    const now = new Date();
    const today = localDay(now, tz);

    const streak = displayStreak(profile, today);
    const repair = repairStatus(profile, today, tz);

    // 7-day dot grid (§7.1): reviews per local day, derived from history.
    const since = new Date(now.getTime() - 8 * 86_400_000); // generous window; slots filter
    const rows = await UserProgress.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          'history.reviewedAt': { $gte: since },
        },
      },
      { $unwind: '$history' },
      { $match: { 'history.reviewedAt': { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$history.reviewedAt', timezone: tz } },
          reviews: { $sum: 1 },
        },
      },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r.reviews]));
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const day = addDays(today, -i);
      week.push({ date: day, reviews: byDay.get(day) ?? 0 });
    }

    const defCount = (await Achievement.countDocuments()) || (await loadAchievementDefs()).length;

    return ok(res, {
      ...gamificationSummary(profile),
      level: profile.currentLevel,
      currentStreak: streak, // break-corrected (stored value is lazy until next review)
      title: LEVEL_TITLES[profile.currentLevel - 1],
      dailyXPProgress: profile.dailyXPProgress,
      week,
      nextMilestone: nextMilestone(streak),
      streakFreezes: profile.streakFreezes,
      goalStreak: profile.goalStreak,
      achievements: { unlocked: profile.unlockedAchievementIds.length, total: defCount },
      repair: {
        available: repair.available,
        cost: repair.cost,
        brokenDay: repair.available ? repair.brokenDay : null,
        streakLost: repair.streakLost,
        canAfford: repair.canAfford,
        monthUsed: repair.monthUsed,
      },
      xpBoostActive: !!profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/gamification/achievements — all defs + unlock status and
// live progress for locked ones (§6.10 copy lands with the profile tabs).
gamificationRouter.get('/achievements', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('timezone preferences').lean();
    const profile = await ensureGamificationProfile(user._id, user.preferences?.dailyGoalXP);
    let defs = await Achievement.find().sort({ order: 1 }).lean();
    if (defs.length === 0) {
      await seedAchievements();
      defs = await Achievement.find().sort({ order: 1 }).lean();
    }

    const signals = profileSignals(profile);
    const needsAggregates = defs.some((def) =>
      ['LEARNED', 'MASTERED', 'MASTERED_JLPT', 'ACCURACY_30D'].includes(def.criteria.type)
    );
    if (needsAggregates) {
      Object.assign(signals, await aggregateLearningSignals(profile.userId));
    }

    const unlocked = new Set(profile.unlockedAchievementIds);
    const items = defs.map((def) => {
      const isUnlocked = unlocked.has(def.id);
      return {
        ...publicAchievement(def),
        unlocked: isUnlocked,
        unlockedAt: isUnlocked ? (profile.achievementUnlocks?.get?.(def.id) ?? null) : null,
        progress: isUnlocked ? null : progressFor(def.criteria, signals),
      };
    });

    return ok(res, { items, unlockedCount: unlocked.size });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/gamification/streak/repair — D10 (§11.4 banner action): buy a
// broken-in-the-last-24h streak back for 100 coins, once per calendar month.
gamificationRouter.post('/streak/repair', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('timezone preferences').lean();
    const profile = await ensureGamificationProfile(user._id, user.preferences?.dailyGoalXP);
    const tz = user.timezone ?? 'UTC';
    const now = new Date();
    const today = localDay(now, tz);

    const status = repairStatus(profile, today, tz);
    if (status.monthUsed) {
      return fail(res, 409, 'REPAIR_ALREADY_USED', 'You already repaired your streak this month.');
    }
    if (status.streakLost === 0) {
      return fail(res, 409, 'STREAK_NOT_REPAIRABLE', 'Your streak cannot be repaired right now.');
    }
    if (profile.coins < STORE.STREAK_REPAIR_COST) {
      return fail(
        res,
        409,
        'INSUFFICIENT_COINS',
        `You need ${STORE.STREAK_REPAIR_COST} coins to repair your streak.`
      );
    }

    applyRepair(profile, today, now);
    // Fukkatsu (復活): the repair itself is the unlock event.
    const { newly, achievementXP } = await evaluateAchievements(profile, user, {
      now,
      repairCount: 1,
    });
    profile.totalXP += achievementXP;
    const { level, xpToNextLevel } = computeLevel(profile.totalXP);
    profile.currentLevel = level;
    profile.xpToNextLevel = xpToNextLevel;
    profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
    await profile.save();

    return ok(res, {
      repaired: true,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      coins: profile.coins,
      totalXP: profile.totalXP,
      level,
      xpToNextLevel,
      newlyUnlocked: newly,
    });
  } catch (err) {
    return next(err);
  }
});
