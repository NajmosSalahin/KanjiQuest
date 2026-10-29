import { Schema, model } from 'mongoose';
import { xpToNextLevel, DEFAULT_DAILY_GOAL_XP } from '@kanjigarden/shared';

/** gamificationProfile — prompt.md §8. Created at registration (Phase 1).
 *  Fields beyond §8 are Phase 4 additive counters (DECISIONS.md): each powers
 *  a §11.3 achievement without per-review aggregation. */
const gamificationProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  totalXP: { type: Number, default: 0 },
  currentLevel: { type: Number, default: 1 },
  xpToNextLevel: { type: Number, default: () => xpToNextLevel(1) },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActivityDate: { type: String, default: null },
  coins: { type: Number, default: 0 },
  dailyGoalXP: { type: Number, default: DEFAULT_DAILY_GOAL_XP },
  dailyXPProgress: { type: Number, default: 0 },
  lastReviewDate: { type: String, default: null }, // YYYY-MM-DD, first-review-of-day bookkeeping
  unlockedAchievementIds: { type: [String], default: [] },
  /** id -> unlock Date (D11 supplement; unlockedAchievementIds stays §8-canonical). */
  achievementUnlocks: { type: Map, of: Date, default: () => new Map() },
  equippedTitle: { type: String, default: null },
  xpBoostExpiresAt: { type: Date, default: null },

  // — Phase 4 additive (DECISIONS.md "Implementation notes (Phase 4)") —
  streakFreezes: { type: Number, default: 0 }, // store (Phase 7) grants these
  goalStreak: { type: Number, default: 0 }, // consecutive daily-goal days (§11.3)
  goalMetDate: { type: String, default: null },
  totalReviews: { type: Number, default: 0 },
  currentPerfectRun: { type: Number, default: 0 }, // reviews since last Again
  reviewsBefore8: { type: Number, default: 0 }, // Asagata (朝型)
  reviewsAfter23: { type: Number, default: 0 }, // Yofukashi (夜ふかし)
  lastStreakRepairAt: { type: Date, default: null }, // §11.4: once per month
  dailyCountersDate: { type: String, default: null }, // day the daily counters belong to
  dailyReviewsCount: { type: Number, default: 0 },
  dailyAgainToday: { type: Boolean, default: false }, // Hyakuten (百点) gate
});

export const GamificationProfile = model('GamificationProfile', gamificationProfileSchema);

/** Nav/summary projection — GET /users/me and auth responses. */
export function gamificationSummary(profile) {
  return {
    totalXP: profile.totalXP,
    currentLevel: profile.currentLevel,
    xpToNextLevel: profile.xpToNextLevel,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    coins: profile.coins,
    dailyGoalXP: profile.dailyGoalXP,
  };
}

/** Create the profile with sane defaults at registration. */
export async function createGamificationProfile(userId, dailyGoalXP = DEFAULT_DAILY_GOAL_XP) {
  return GamificationProfile.create({
    userId,
    dailyGoalXP,
    xpToNextLevel: xpToNextLevel(1),
  });
}

/** Ensure a profile exists (self-healing for /users/me). */
export async function ensureGamificationProfile(userId, dailyGoalXP = DEFAULT_DAILY_GOAL_XP) {
  let profile = await GamificationProfile.findOne({ userId });
  if (!profile) {
    profile = await createGamificationProfile(userId, dailyGoalXP);
  }
  return profile;
}
