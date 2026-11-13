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

/** Quiz modes (§6.6). */
export const QUIZ_MODES = Object.freeze(['meaning', 'reading', 'stroke', 'drawing', 'sprint']);

/** Practice-session length; §11.1's completion bonus needs ≥10 answers. */
export const QUIZ_SESSION_LENGTH = 10;

/** Sprint duration before bonuses (§6.6/§7.6). */
export const QUIZ_SPRINT_SECONDS = 60;

/** Drawing-canvas score bands (§7.6) and attempt cap. */
export const QUIZ_DRAWING = Object.freeze({
  CORRECT: 85,
  CLOSE: 60,
  MAX_ATTEMPTS: 2,
  CANVAS_SIZE: 300,
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

/**
 * Store catalogue (§6.11 + §7.10). `type` drives the purchase/equip rules:
 * freeze and boost are consumable effects, title and frame are permanent
 * cosmetics. `value` is what the profile stores when a cosmetic is equipped.
 */
export const STORE_ITEM_TYPES = Object.freeze({
  FREEZE: 'freeze',
  BOOST: 'boost',
  TITLE: 'title',
  FRAME: 'frame',
});

export const STORE = Object.freeze({
  STREAK_FREEZE: { price: 50, maxActive: 2 },
  XP_BOOST: { price: 100, multiplier: 1.5, durationHours: 24 },
  STREAK_REPAIR_COST: 100,
  ITEMS: Object.freeze([
    {
      id: 'streak-freeze',
      type: STORE_ITEM_TYPES.FREEZE,
      name: 'Streak freeze',
      description: 'Protects your streak for one missed day.',
      price: 50,
      maxActive: 2,
      icon: 'freeze',
    },
    {
      id: 'xp-boost',
      type: STORE_ITEM_TYPES.BOOST,
      name: 'XP boost',
      description: 'Earn 1.5× XP for the next 24 hours.',
      price: 100,
      icon: 'boost',
    },
    {
      id: 'title-diligent',
      type: STORE_ITEM_TYPES.TITLE,
      name: 'The Diligent',
      description: 'A title for those who show up every day.',
      price: 25,
      value: 'The Diligent',
      icon: 'title',
    },
    {
      id: 'title-kokoro',
      type: STORE_ITEM_TYPES.TITLE,
      name: 'Kokoro no Tsuchi',
      description: 'The hammer of the heart. A title for steady hands.',
      price: 50,
      value: 'Kokoro no Tsuchi',
      icon: 'title',
    },
    {
      id: 'title-yama',
      type: STORE_ITEM_TYPES.TITLE,
      name: 'Yama no Ue',
      description: 'Above the mountain. A title for the long climb.',
      price: 75,
      value: 'Yama no Ue',
      icon: 'title',
    },
    {
      id: 'frame-sakura',
      type: STORE_ITEM_TYPES.FRAME,
      name: 'Sakura',
      nameJa: '桜',
      description: 'A frame of falling cherry blossoms.',
      price: 100,
      value: 'sakura',
      icon: 'frame-sakura',
    },
    {
      id: 'frame-take',
      type: STORE_ITEM_TYPES.FRAME,
      name: 'Take',
      nameJa: '竹',
      description: 'A frame of clean bamboo lines.',
      price: 100,
      value: 'take',
      icon: 'frame-take',
    },
    {
      id: 'frame-tsuki',
      type: STORE_ITEM_TYPES.FRAME,
      name: 'Tsuki',
      nameJa: '月',
      description: 'A frame lit by a quiet moon.',
      price: 100,
      value: 'tsuki',
      icon: 'frame-tsuki',
    },
  ]),
});

/** Look up one catalogue item by id; undefined when it does not exist. */
export function storeItem(itemId) {
  return STORE.ITEMS.find((item) => item.id === itemId);
}

/** Mastered = review state with interval ≥ 180 days (§10). */
export const MASTERED_INTERVAL_DAYS = 180;

export const XP_BOOST_MULTIPLIER = 1.5;

/** Daily goal (§11.6): default 50 XP, configurable 20/50/100/200. */
export const DAILY_GOAL_OPTIONS = Object.freeze([20, 50, 100, 200]);
export const DEFAULT_DAILY_GOAL_XP = 50;

/** §11.4 streak milestones: achievements + celebration modal at 7/30/100. */
export const STREAK_MILESTONES = Object.freeze([7, 30, 100]);

/** §7.1 dashboard bar: next-milestone label names (owner decision, Phase 4). */
export const BAR_MILESTONES = Object.freeze([
  { days: 14, name: 'Wakaba' },
  { days: 30, name: 'Sakura' },
  { days: 60, name: 'Hanami' },
  { days: 100, name: 'Momiji' },
]);

/** §11.3 amended by owner (D11): 41 achievements, all Japanese-named. */
export const ACHIEVEMENT_TOTAL = 41;

/** §11.4 streak repair price (coins). */
export const STREAK_REPAIR_COST = STORE.STREAK_REPAIR_COST;
