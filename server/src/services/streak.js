/**
 * Streak service — §11.4. The profile's currentStreak is authoritative but
 * "lazy": it only changes on activity, so dashboard display and repair
 * evaluate what the stored value means *today* (user's local day, §11.4).
 *
 * - First activity of a local day extends (or restarts) the streak.
 * - A missed calendar day resets to 0 — unless a streak freeze covers every
 *   missed day (freeze items are granted by the store in Phase 7; the
 *   consumption rule lives here and is unit-tested now).
 * - Milestones 7/30/100 trigger achievements + the celebration modal.
 * - Repair (D10 endpoint): a streak that ended "yesterday" can be bought
 *   back for STORE.STREAK_REPAIR_COST coins, once per calendar month.
 */
import { STORE, STREAK_MILESTONES, BAR_MILESTONES } from '@kanjigarden/shared';
import { dayDiff, addDays, localDay } from './time.js';

/**
 * Apply today's activity to the streak. Mutates profile.currentStreak only;
 * the caller persists (lastActivityDate is the caller's bookkeeping).
 * Returns { streak, extended, reset, froze }.
 */
export function applyStreak(profile, today) {
  const last = profile.lastActivityDate;
  if (!last) {
    profile.currentStreak = 1;
    return { streak: 1, extended: false, reset: false, froze: 0 };
  }
  if (last === today) {
    return { streak: profile.currentStreak, extended: false, reset: false, froze: 0 };
  }

  const diff = dayDiff(last, today);
  if (diff === 1) {
    profile.currentStreak += 1;
    return { streak: profile.currentStreak, extended: true, reset: false, froze: 0 };
  }

  // At least one full calendar day was missed (diff >= 2).
  const missed = diff - 1;
  if (profile.currentStreak > 0 && profile.streakFreezes >= missed) {
    profile.streakFreezes -= missed;
    profile.currentStreak += 1;
    return { streak: profile.currentStreak, extended: true, reset: false, froze: missed };
  }
  const reset = profile.currentStreak > 0;
  profile.currentStreak = 1;
  return { streak: 1, extended: false, reset, froze: 0 };
}

/**
 * What the streak reads as today WITHOUT saving (dashboard display).
 * A stale stored value from before a break must not show on the card.
 */
export function displayStreak(profile, today) {
  const last = profile.lastActivityDate;
  if (!last) return 0;
  const diff = dayDiff(last, today);
  if (diff <= 1) return profile.currentStreak;
  const missed = diff - 1;
  if (profile.currentStreak > 0 && profile.streakFreezes >= missed) {
    return profile.currentStreak;
  }
  return 0;
}

/** §11.4: first of 7/30/100 crossed between two streak values (celebration). */
export function crossedMilestone(previousStreak, currentStreak) {
  return STREAK_MILESTONES.find((m) => previousStreak < m && currentStreak >= m) ?? null;
}

/** §7.1 bar: next named milestone above the streak (shown when streak >= 7). */
export function nextMilestone(streak) {
  if (streak < 7) return null;
  const next = BAR_MILESTONES.find((m) => streak < m.days);
  return next ? { days: next.days, name: next.name, remaining: next.days - streak } : null;
}

/**
 * §11.4 repair banner state: "Your N-day streak ended yesterday. Repair for
 * 100 coins?" — broken means exactly one full local day went unreviewed (the
 * previous day), one repair per calendar month, price from §6.11.
 */
export function repairStatus(profile, today, timeZone = 'UTC') {
  const last = profile.lastActivityDate;
  const gap = last ? dayDiff(last, today) : null;
  const wasBroken = gap === 2 && profile.currentStreak > 0;
  const monthUsed =
    !!profile.lastStreakRepairAt &&
    localDay(profile.lastStreakRepairAt, timeZone).slice(0, 7) === today.slice(0, 7);
  return {
    available: wasBroken && !monthUsed,
    monthUsed,
    canAfford: profile.coins >= STORE.STREAK_REPAIR_COST,
    cost: STORE.STREAK_REPAIR_COST,
    brokenDay: addDays(today, -1),
    streakLost: wasBroken ? profile.currentStreak : 0,
  };
}

/** Apply a paid repair: the missed day counts as shown-up, so the next
 *  review chains normally (dayDiff becomes 1 -> streak extends). */
export function applyRepair(profile, today, now = new Date()) {
  profile.lastActivityDate = addDays(today, -1);
  profile.lastStreakRepairAt = now;
  profile.coins -= STORE.STREAK_REPAIR_COST;
}
