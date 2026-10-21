/**
 * Shared constants — prompt.md §10 (Gamification Rules) and §10 (SRS).
 * Used by both client and server; the server is always authoritative.
 */

/** SRS ratings: 0=Again, 1=Hard, 2=Good, 3=Easy */
export const RATING = Object.freeze({ AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 });

export const RATING_LABELS = Object.freeze(['Again', 'Hard', 'Good', 'Easy']);

/** XP awarded per review rating (§11.1). */
export const REVIEW_XP = Object.freeze([2, 5, 10, 15]);

/** Quiz XP (§11.1). */
export const QUIZ_XP = Object.freeze({
  CORRECT: 5,
  SESSION_COMPLETE: 20, // ≥10 answers
  SESSION_MIN_ANSWERS: 10,
  SPRINT_BASE: 30,
  SPRINT_PER_CORRECT: 10,
  DAILY_GOAL_MET: 30, // once/day
  FIRST_REVIEW_OF_DAY: 20, // once/day
  DAILY_SWEEP: 30, // all 3 quests
});

/** Levels (§11.2): 20 levels, xpToNextLevel(N) = floor(100 * N^1.5). */
export const MAX_LEVEL = 20;
export const LEVEL_TITLES = Object.freeze([
  'Seedling', // 1
  'Sprout',
  'Leaf',
  'Sapling',
  'Young Tree',
  'Bough',
  'Branch',
  'Canopy',
  'Grove',
  'Thicket',
  'Copse',
  'Wood',
  'Stand',
  'Forest',
  'Deep Forest',
  'Ancient Woods',
  'Old Growth',
  'Wilder',
  'Mountain',
  'Evergreen', // 20
]);

export function xpToNextLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** Store prices (§6.11). */
export const STORE = Object.freeze({
  STREAK_FREEZE: { price: 50, maxActive: 2 },
  XP_BOOST: { price: 100, multiplier: 1.5, durationHours: 24 },
  STREAK_REPAIR_COST: 100,
});

/** Mastered = review state with interval ≥ 180 days (§10). */
export const MASTERED_INTERVAL_DAYS = 180;

export const XP_BOOST_MULTIPLIER = 1.5;
