/**
 * XP service — §11.1/§11.2/§11.4. Phase 4 formalizes the Phase 3 "thin" XP
 * into the single server-authoritative awardXP entry every XP source will
 * flow through (reviews now; quiz/sprint in Phase 6, quests in Phase 5 —
 * the event signature exists for them).
 *
 * Achievement unlocks (§11.3) are evaluated inside awardXP and their rewards
 * land in the same transaction: coins immediately, XP through the same 1.5x
 * boost rule ("all XP", §11.1), level recomputed once at the end.
 *
 * Achievement XP counts toward totalXP/level but NOT toward the daily goal
 * or the streak (both are review-driven) — DECISIONS.md Phase 4 notes.
 */
import {
  QUIZ_XP,
  REVIEW_XP,
  XP_BOOST_MULTIPLIER,
  xpToNextLevel,
  MAX_LEVEL,
  DEFAULT_DAILY_GOAL_XP,
  LEVEL_TITLES,
  RATING,
} from '@kanjigarden/shared';
import { ensureGamificationProfile } from '../models/GamificationProfile.js';
import { applyStreak, crossedMilestone } from './streak.js';
import { evaluateAchievements } from './achievements.js';
import { localDay, localHour, addDays } from './time.js';

export { localDay, localHour };

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

/** Store XP boost: 1.5x for 24h, applied at award time server-side (§11.1). */
function applyBoost(profile, amount, now) {
  return profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now
    ? Math.round(amount * XP_BOOST_MULTIPLIER)
    : amount;
}

/**
 * Award XP for one gamification event. Currently 'review' (Phase 3 flow);
 * later events (quiz correct/session/sprint, quest, sweep) join here.
 *
 * Returns the response payload plus:
 *  - `newlyUnlocked[]` — achievements unlocked by this event (toast feed)
 *  - `streakMilestone` — 7/30/100 crossing days (celebration modal, §11.4)
 *  - `gami` — pre-award counter snapshot for the §6.5 undo's exact restore
 */
export async function awardXP(user, event, payload, now = new Date()) {
  if (event !== 'review') {
    throw new Error(`awardXP: unsupported event "${event}" (ships in a later phase)`);
  }
  const { rating } = payload;
  const profile = await ensureGamificationProfile(
    user._id,
    user.preferences?.dailyGoalXP ?? DEFAULT_DAILY_GOAL_XP
  );
  const tz = user.timezone ?? 'UTC';
  const today = localDay(now, tz);
  const yesterday = addDays(today, -1);

  // Exact-restore snapshot for undo (history[].gami).
  const gami = {
    totalReviews: profile.totalReviews,
    dailyReviewsCount: profile.dailyReviewsCount,
    dailyAgainToday: profile.dailyAgainToday,
    currentPerfectRun: profile.currentPerfectRun,
    reviewsBefore8: profile.reviewsBefore8,
    reviewsAfter23: profile.reviewsAfter23,
    goalStreak: profile.goalStreak,
    goalMetDate: profile.goalMetDate,
    dailyCountersDate: profile.dailyCountersDate,
  };

  const previousLevel = profile.currentLevel;
  const previousStreak = profile.currentStreak;

  const newDay = profile.lastActivityDate !== today;
  const dailyXP = newDay ? 0 : profile.dailyXPProgress;
  if (profile.dailyCountersDate !== today) {
    profile.dailyReviewsCount = 0;
    profile.dailyAgainToday = false;
    profile.dailyCountersDate = today;
  }

  // §11.1: per-rating XP + first-review-of-day + daily-goal crossing.
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

  const boostedReviewXP = applyBoost(profile, awarded, now);

  // §11.4 streak (timezone-correct, freeze-aware) + Phase 4 counters.
  applyStreak(profile, today);
  profile.lastActivityDate = today;
  profile.lastReviewDate = today;
  profile.dailyXPProgress = dailyXP + boostedReviewXP;
  profile.totalReviews += 1;
  profile.dailyReviewsCount += 1;
  profile.dailyAgainToday = profile.dailyAgainToday || rating === RATING.AGAIN;
  profile.currentPerfectRun = rating === RATING.AGAIN ? 0 : profile.currentPerfectRun + 1;
  const hour = localHour(now, tz);
  if (hour < 8) profile.reviewsBefore8 += 1;
  if (hour >= 23) profile.reviewsAfter23 += 1;

  // Daily-goal streak (§11.3 Nanakusa/Misoka/Hitasura): consecutive goal days.
  if (bonuses.includes('goalMet')) {
    profile.goalStreak = profile.goalMetDate === yesterday ? profile.goalStreak + 1 : 1;
    profile.goalMetDate = today;
  }

  profile.totalXP += boostedReviewXP;
  // Provisional level so LEVEL achievements evaluate against the crossing.
  const provisional = computeLevel(profile.totalXP);
  profile.currentLevel = provisional.level;
  profile.xpToNextLevel = provisional.xpToNextLevel;

  // §11.3 achievements — unlocks, coins, boosted reward XP.
  const { newly, achievementXP } = await evaluateAchievements(profile, user, { now });
  profile.totalXP += achievementXP;

  // §11.2 final level after every XP source landed.
  const { level, xpToNextLevel: toNext } = computeLevel(profile.totalXP);
  profile.currentLevel = level;
  profile.xpToNextLevel = toNext;
  profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
  await profile.save();

  const streakMilestone = crossedMilestone(previousStreak, profile.currentStreak);

  return {
    awarded: boostedReviewXP,
    bonuses,
    totalXP: profile.totalXP,
    dailyXPProgress: profile.dailyXPProgress,
    dailyGoalXP: profile.dailyGoalXP,
    currentStreak: profile.currentStreak,
    level,
    xpToNextLevel: toNext,
    title: LEVEL_TITLES[level - 1],
    previousLevel,
    leveledUp: level > previousLevel,
    coins: profile.coins,
    streakMilestone,
    newlyUnlocked: newly,
    gami,
  };
}

/**
 * Compensating refund for §6.5 undo: reverses totalXP/level/dailyXP and the
 * Phase 4 counters exactly (via the gami snapshot). Streaks are deliberately
 * NOT reverted — showing up still counts, and the 4-second undo window can't
 * un-show; unlocked achievements are permanent (DECISIONS.md).
 */
export async function refundReviewXP(user, xpAwarded, gami) {
  const profile = await ensureGamificationProfile(
    user._id,
    user.preferences?.dailyGoalXP ?? DEFAULT_DAILY_GOAL_XP
  );
  const totalXP = Math.max(0, profile.totalXP - xpAwarded);
  const { level, xpToNextLevel: toNext } = computeLevel(totalXP);
  profile.totalXP = totalXP;
  profile.dailyXPProgress = Math.max(0, profile.dailyXPProgress - xpAwarded);
  profile.currentLevel = level;
  profile.xpToNextLevel = toNext;
  if (gami) {
    profile.totalReviews = Math.max(0, gami.totalReviews ?? profile.totalReviews);
    profile.dailyReviewsCount = Math.max(0, gami.dailyReviewsCount ?? profile.dailyReviewsCount);
    profile.dailyAgainToday = gami.dailyAgainToday ?? profile.dailyAgainToday;
    profile.currentPerfectRun = Math.max(0, gami.currentPerfectRun ?? profile.currentPerfectRun);
    profile.reviewsBefore8 = Math.max(0, gami.reviewsBefore8 ?? profile.reviewsBefore8);
    profile.reviewsAfter23 = Math.max(0, gami.reviewsAfter23 ?? profile.reviewsAfter23);
    profile.goalStreak = Math.max(0, gami.goalStreak ?? profile.goalStreak);
    profile.goalMetDate = gami.goalMetDate ?? profile.goalMetDate;
    profile.dailyCountersDate = gami.dailyCountersDate ?? profile.dailyCountersDate;
  }
  await profile.save();
  return {
    refunded: xpAwarded,
    totalXP,
    dailyXPProgress: profile.dailyXPProgress,
    level,
  };
}
