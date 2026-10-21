import { Schema, model } from 'mongoose';
import { xpToNextLevel } from '@kanjigarden/shared';

/** gamificationProfile — prompt.md §8. Created at registration (Phase 1). */
const gamificationProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  totalXP: { type: Number, default: 0 },
  currentLevel: { type: Number, default: 1 },
  xpToNextLevel: { type: Number, default: () => xpToNextLevel(1) },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActivityDate: { type: String, default: null },
  coins: { type: Number, default: 0 },
  dailyGoalXP: { type: Number, default: 100 },
  dailyXPProgress: { type: Number, default: 0 },
  unlockedAchievementIds: { type: [String], default: [] },
  equippedTitle: { type: String, default: null },
  xpBoostExpiresAt: { type: Date, default: null },
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
export async function createGamificationProfile(userId, dailyGoalXP = 100) {
  return GamificationProfile.create({
    userId,
    dailyGoalXP,
    xpToNextLevel: xpToNextLevel(1),
  });
}

/** Ensure a profile exists (self-healing for /users/me). */
export async function ensureGamificationProfile(userId, dailyGoalXP = 100) {
  let profile = await GamificationProfile.findOne({ userId });
  if (!profile) {
    profile = await createGamificationProfile(userId, dailyGoalXP);
  }
  return profile;
}
