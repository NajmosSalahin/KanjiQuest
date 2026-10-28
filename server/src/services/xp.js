/**
 * Thin XP/streak service for Phase 3 reviews — §11.1/§11.2/§11.4.
 *
 * Phase 4 replaces the call sites with the full awardXP service (quests,
 * achievements, quiz/sprint XP); the rules implemented here are exactly the
 * review-shaped ones: per-rating XP, first-review-of-day +20, daily-goal
 * crossing +30 (once/day via the crossing itself), streak increments, and
 * the store's 1.5x boost applied at award time server-side (§11.1).
 */
import {
  QUIZ_XP,
  REVIEW_XP,
  XP_BOOST_MULTIPLIER,
  xpToNextLevel,
  MAX_LEVEL,
} from '@kanjigarden/shared';
import { ensureGamificationProfile } from '../models/GamificationProfile.js';

/** YYYY-MM-DD in the user's timezone (§11.4 local-day boundaries). */
export function localDay(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Level N -> N+1 costs floor(100 x N^1.5); level holds when cumulative XP
 *  covers every cost below it (matches the profile's level-1 default of 100). */
export function computeLevel(totalXP) {
  let level = 1;
  let spent = 0;
  while (level < MAX_LEVEL) {
    const cost = xpToNextLevel(level);
    if (totalXP >= spent + cost) {
      spent += cost;
      level += 1;
    } else {
      break;
    }
  }
  return { level, xpToNextLevel: xpToNextLevel(level) };
}

/**
 * Award review XP for one rated card (server-authoritative, §11.1).
 * Returns the amounts for the response + the history entry's xpAwarded.
 */
export async function awardReviewXP(user, rating, now = new Date()) {
  const profile = await ensureGamificationProfile(user._id, user.preferences?.dailyGoalXP ?? 100);
  const tz = user.timezone ?? 'UTC';
  const today = localDay(now, tz);
  const yesterday = localDay(new Date(now.getTime() - 24 * 60 * 60 * 1000), tz);

  const newDay = profile.lastActivityDate !== today;
  const dailyXP = newDay ? 0 : profile.dailyXPProgress;

  let awarded = REVIEW_XP[rating];
  const bonuses = [];
  if (profile.lastReviewDate !== today) {
    awarded += QUIZ_XP.FIRST_REVIEW_OF_DAY;
    bonuses.push('firstReview');
  }
  const goalAlreadyMet = !newDay && profile.dailyXPProgress >= profile.dailyGoalXP;
  if (!goalAlreadyMet && dailyXP + awarded >= profile.dailyGoalXP) {
    awarded += QUIZ_XP.DAILY_GOAL_MET;
    bonuses.push('goalMet');
  }

  // Store XP boost: 1.5x for 24h, applied at award time server-side (§11.1).
  const boosted =
    profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now
      ? Math.round(awarded * XP_BOOST_MULTIPLIER)
      : awarded;

  // Streak (§11.4): first activity of a local day extends or restarts.
  let streak = profile.currentStreak;
  if (newDay) {
    streak = profile.lastActivityDate === yesterday ? streak + 1 : 1;
  }

  const totalXP = profile.totalXP + boosted;
  const { level, xpToNextLevel: toNext } = computeLevel(totalXP);

  profile.totalXP = totalXP;
  profile.dailyXPProgress = dailyXP + boosted;
  profile.currentLevel = level;
  profile.xpToNextLevel = toNext;
  profile.currentStreak = streak;
  profile.longestStreak = Math.max(profile.longestStreak, streak);
  profile.lastActivityDate = today;
  profile.lastReviewDate = today;
  await profile.save();

  return {
    awarded: boosted,
    bonuses,
    totalXP,
    dailyXPProgress: profile.dailyXPProgress,
    dailyGoalXP: profile.dailyGoalXP,
    currentStreak: streak,
    level,
    xpToNextLevel: toNext,
  };
}

/**
 * Compensating refund for §6.5 undo: reverses totalXP/level/dailyXP exactly.
 * Streaks are deliberately NOT reverted — showing up still counts, and the
 * 4-second undo window can't un-show (DECISIONS.md).
 */
export async function refundReviewXP(user, xpAwarded) {
  const profile = await ensureGamificationProfile(user._id, user.preferences?.dailyGoalXP ?? 100);
  const totalXP = Math.max(0, profile.totalXP - xpAwarded);
  const { level, xpToNextLevel: toNext } = computeLevel(totalXP);
  profile.totalXP = totalXP;
  profile.dailyXPProgress = Math.max(0, profile.dailyXPProgress - xpAwarded);
  profile.currentLevel = level;
  profile.xpToNextLevel = toNext;
  await profile.save();
  return {
    refunded: xpAwarded,
    totalXP,
    dailyXPProgress: profile.dailyXPProgress,
    level,
  };
}
