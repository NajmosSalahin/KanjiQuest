/** Gamification view helpers — §7.1 dashboard, §11.4 milestones. */

/** 7/30/100 streak milestones unlock Kokoro/Tsuki/Kaze (§11.3) — when the
 *  celebration modal shows the milestone, its achievement toast is folded in. */
export const MILESTONE_ACHIEVEMENT = Object.freeze({ 7: 'kokoro', 30: 'tsuki', 100: 'kaze' });

/** Toast copy for an unlocked achievement (owner decision: toast for
 *  everything that isn't a level-up/streak-milestone celebration). */
export function unlockToastMessage(achievement) {
  const rewards = [];
  if (achievement.rewardXP) rewards.push(`+${achievement.rewardXP} XP`);
  if (achievement.rewardCoins) rewards.push(`${achievement.rewardCoins} coins`);
  return `Achievement unlocked: ${achievement.name} (${achievement.nameJa})${
    rewards.length ? ` — ${rewards.join(', ')}` : ''
  }`;
}

/** "Wednesday, March 12" (§7.1 header row). */
export function formatToday(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** Monday-anchored date keys (YYYY-MM-DD) for this week's dot grid (§7.1). */
export function weekDateKeys(now = new Date()) {
  const keys = [];
  // Local (browser) calendar day, Monday first.
  const start = new Date(now);
  const day = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - day);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return keys;
}

/** Dot-grid day letters, Monday first (§7.1: "M T W T F S S"). */
export const WEEKDAY_LETTERS = Object.freeze(['M', 'T', 'W', 'T', 'F', 'S', 'S']);

/** "14:30" local time for the caught-up line (§7.1). */
export function formatClock(iso, timeZone) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}
