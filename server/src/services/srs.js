/**
 * SRS algorithm (SM-2, Modified) — prompt.md §10. Pure function; routes own
 * persistence, gamification owns XP.
 *
 * Interval units per transition (§10 is explicit per state):
 *   - learning/relearning steps: MINUTES (learning Again 1m, Hard 10m;
 *     relearning floors every step at 10m)
 *   - review intervals + review-Again lapse interval: DAYS
 *   - graduation (learning/relearning -> review): 1d (Good) or 4d (Easy)
 *
 * Ease deltas are §10's modified values (Again -0.20, Hard -0.15, Good 0,
 * Easy +0.15), clamped to [1.3, 3.0]; the standard SM-2 formula in §10 is
 * background, and the section title ("SM-2, Modified") makes the per-state
 * rules operative. See DECISIONS.md.
 *
 * dueDate = lastReviewedAt + interval, rounded to the nearest minute.
 */
import { RATING, MASTERED_INTERVAL_DAYS } from '@kanjigarden/shared';

export const EASE = Object.freeze({ START: 2.5, MIN: 1.3, MAX: 3.0 });

/** Per-rating ease deltas while in review state. */
const REVIEW_EASE_DELTA = Object.freeze({
  [RATING.AGAIN]: -0.2,
  [RATING.HARD]: -0.15,
  [RATING.GOOD]: 0,
  [RATING.EASY]: 0.15,
});

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const STATES = new Set(['new', 'learning', 'review', 'relearning']);

function clampEase(ease) {
  return Math.min(EASE.MAX, Math.max(EASE.MIN, ease));
}

/** dueDate with same-day intervals rounded to the nearest minute (§10). */
function dueDate(now, interval, unitMs) {
  return now + Math.round((interval * unitMs) / MINUTE) * MINUTE;
}

/** A brand-new card (state 'new', no interval, ease 2.5). */
export function emptyCard() {
  return { state: 'new', interval: 0, easeFactor: EASE.START, repetitions: 0, lapses: 0 };
}

/** Mastered = review state with interval >= 180 days (§10). */
export function isMastered(card) {
  return card.state === 'review' && card.interval >= MASTERED_INTERVAL_DAYS;
}

/**
 * Apply one rating to one card and return the next scheduling state (§10).
 *
 * @param {{state?: string, interval?: number, easeFactor?: number,
 *          repetitions?: number, lapses?: number}} card current scheduling state
 * @param {0|1|2|3} rating 0=Again, 1=Hard, 2=Good, 3=Easy
 * @param {number} [now] epoch ms of the review (injectable for tests)
 * @returns {{state: string, interval: number, easeFactor: number,
 *            repetitions: number, lapses: number, dueDate: number}}
 */
export function scheduleReview(card, rating, now = Date.now()) {
  if (!Number.isInteger(rating) || rating < RATING.AGAIN || rating > RATING.EASY) {
    throw new RangeError(`rating must be 0-3, got ${rating}`);
  }
  const state = card.state ?? 'new';
  if (!STATES.has(state)) {
    throw new RangeError(`unknown srs state: ${state}`);
  }
  const ease = clampEase(card.easeFactor ?? EASE.START);
  const lapses = card.lapses ?? 0;
  const repetitions = card.repetitions ?? 0;

  let next;
  let unitMs;

  if (state === 'new') {
    // New: Again -> learning 1m, Hard -> learning 6m, Good -> review 1d,
    // Easy -> review 4d; reps 1 on every path.
    const byRating = {
      [RATING.AGAIN]: { state: 'learning', interval: 1 },
      [RATING.HARD]: { state: 'learning', interval: 6 },
      [RATING.GOOD]: { state: 'review', interval: 1 },
      [RATING.EASY]: { state: 'review', interval: 4 },
    };
    next = { ...byRating[rating], repetitions: 1, easeFactor: ease, lapses };
    unitMs = next.state === 'review' ? DAY : MINUTE;
  } else if (state === 'learning' || state === 'relearning') {
    // Steps are minutes; relearning floors every step at 10m. Again/Hard
    // keep reps; Good/Easy graduate to review with reps 1.
    const floor = state === 'relearning' ? 10 : 1;
    const byRating = {
      [RATING.AGAIN]: { state, interval: floor, repetitions },
      [RATING.HARD]: { state, interval: Math.max(10, floor), repetitions },
      [RATING.GOOD]: { state: 'review', interval: 1, repetitions: 1 },
      [RATING.EASY]: { state: 'review', interval: 4, repetitions: 1 },
    };
    next = { ...byRating[rating], easeFactor: ease, lapses };
    unitMs = next.state === 'review' ? DAY : MINUTE;
  } else {
    // Review: intervals in DAYS. Again lapses (reps 0, lapses +1, interval
    // halved floor 1d, ease -0.20); Hard x1.2 ease -0.15; Good x ease;
    // Easy x ease x 1.3 ease +0.15. Success paths keep counting reps.
    const days = Math.max(card.interval ?? 1, 0);
    const easeNext = clampEase(ease + REVIEW_EASE_DELTA[rating]);
    if (rating === RATING.AGAIN) {
      next = {
        state: 'relearning',
        interval: Math.max(1, days * 0.5),
        easeFactor: easeNext,
        repetitions: 0,
        lapses: lapses + 1,
      };
    } else {
      const byRating = {
        [RATING.HARD]: days * 1.2,
        [RATING.GOOD]: days * ease,
        [RATING.EASY]: days * ease * 1.3,
      };
      next = {
        state: 'review',
        interval: byRating[rating],
        easeFactor: easeNext,
        repetitions: repetitions + 1,
        lapses,
      };
    }
    unitMs = DAY;
  }

  return { ...next, dueDate: dueDate(now, next.interval, unitMs) };
}
