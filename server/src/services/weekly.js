/**
 * Weekly leaderboard clock — prompt.md §6.12: resets Monday 00:00 UTC.
 * The counter is lazy: every XP award / leaderboard read rolls the stored
 * week forward instead of relying on a cron job (D18).
 */

/** UTC Monday of the week containing `now`, as YYYY-MM-DD. */
export function weekStartUTC(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/** Reset the profile's weekly bucket when the stored week is stale. */
export function rollWeeklyXP(profile, now = new Date()) {
  const week = weekStartUTC(now);
  if (profile.weeklyXPWeek !== week) {
    profile.weeklyXP = 0;
    profile.weeklyXPWeek = week;
    return true;
  }
  return false;
}

/** Add XP to the current weekly bucket (after rolling the week). */
export function addWeeklyXP(profile, amount, now = new Date()) {
  rollWeeklyXP(profile, now);
  profile.weeklyXP = Math.max(0, (profile.weeklyXP ?? 0) + Math.round(amount));
  return profile.weeklyXP;
}

/**
 * Undo compensation: only subtract when the award happened in the current
 * week. `awardWeek` is the week key snapshotted at award time; a cross-week
 * undo must not touch the new week's counter.
 */
export function subtractWeeklyXP(profile, amount, awardWeek, now = new Date()) {
  if (!awardWeek || awardWeek !== weekStartUTC(now)) return profile.weeklyXP ?? 0;
  rollWeeklyXP(profile, now);
  profile.weeklyXP = Math.max(0, (profile.weeklyXP ?? 0) - Math.round(amount));
  return profile.weeklyXP;
}
