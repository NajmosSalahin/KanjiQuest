import { describe, it, expect } from 'vitest';
import { RATING } from '@kanjigarden/shared';
import { scheduleReview, emptyCard, isMastered, EASE } from '../src/services/srs.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Card helper — anything omitted takes the §10 default. */
function card(overrides = {}) {
  return { ...emptyCard(), ...overrides };
}

const NOW = Date.UTC(2026, 0, 15, 9, 30);

describe('SRS (§10) — new cards', () => {
  it('Again -> learning, 1m, reps 1', () => {
    const r = scheduleReview(card(), RATING.AGAIN, NOW);
    expect(r).toMatchObject({ state: 'learning', interval: 1, repetitions: 1, lapses: 0 });
    expect(r.dueDate).toBe(NOW + 1 * MINUTE);
  });

  it('Hard -> learning, 6m, reps 1', () => {
    const r = scheduleReview(card(), RATING.HARD, NOW);
    expect(r).toMatchObject({ state: 'learning', interval: 6, repetitions: 1 });
    expect(r.dueDate).toBe(NOW + 6 * MINUTE);
  });

  it('Good -> review, 1d, reps 1', () => {
    const r = scheduleReview(card(), RATING.GOOD, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 1, repetitions: 1 });
    expect(r.dueDate).toBe(NOW + 1 * DAY);
  });

  it('Easy -> review, 4d, reps 1', () => {
    const r = scheduleReview(card(), RATING.EASY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 4, repetitions: 1 });
    expect(r.dueDate).toBe(NOW + 4 * DAY);
  });

  it('keeps ease at the 2.5 start and never lapses on new', () => {
    for (const rating of [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY]) {
      const r = scheduleReview(card(), rating, NOW);
      expect(r.easeFactor).toBe(EASE.START);
      expect(r.lapses).toBe(0);
    }
  });

  it('treats a card with omitted fields as new', () => {
    const r = scheduleReview({}, RATING.GOOD, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 1, easeFactor: EASE.START });
  });
});

describe('SRS (§10) — learning cards', () => {
  it('Again -> 1m, reps stay, state stays learning', () => {
    const r = scheduleReview(
      card({ state: 'learning', interval: 6, repetitions: 3 }),
      RATING.AGAIN,
      NOW
    );
    expect(r).toMatchObject({ state: 'learning', interval: 1, repetitions: 3 });
    expect(r.dueDate).toBe(NOW + 1 * MINUTE);
  });

  it('Hard -> 10m, reps stay', () => {
    const r = scheduleReview(
      card({ state: 'learning', interval: 1, repetitions: 2 }),
      RATING.HARD,
      NOW
    );
    expect(r).toMatchObject({ state: 'learning', interval: 10, repetitions: 2 });
    expect(r.dueDate).toBe(NOW + 10 * MINUTE);
  });

  it('Good -> review, 1d, reps 1', () => {
    const r = scheduleReview(
      card({ state: 'learning', interval: 6, repetitions: 2 }),
      RATING.GOOD,
      NOW
    );
    expect(r).toMatchObject({ state: 'review', interval: 1, repetitions: 1 });
    expect(r.dueDate).toBe(NOW + 1 * DAY);
  });

  it('Easy -> review, 4d, reps 1', () => {
    const r = scheduleReview(card({ state: 'learning', interval: 1 }), RATING.EASY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 4, repetitions: 1 });
  });

  it('never changes ease or lapses in learning', () => {
    const r = scheduleReview(card({ state: 'learning', easeFactor: 2.13 }), RATING.AGAIN, NOW);
    expect(r.easeFactor).toBe(2.13);
    expect(r.lapses).toBe(0);
  });
});

describe('SRS (§10) — review cards', () => {
  it('Again -> relearning, reps 0, lapses +1, interval halved floor 1d, ease -0.20', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 10, easeFactor: 2.5, repetitions: 5, lapses: 1 }),
      RATING.AGAIN,
      NOW
    );
    expect(r).toMatchObject({
      state: 'relearning',
      interval: 5,
      easeFactor: 2.3,
      repetitions: 0,
      lapses: 2,
    });
    expect(r.dueDate).toBe(NOW + 5 * DAY);
  });

  it('Again never halves below 1 day', () => {
    const r = scheduleReview(card({ state: 'review', interval: 1 }), RATING.AGAIN, NOW);
    expect(r.interval).toBe(1);
  });

  it('Again floors ease at 1.3', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 6, easeFactor: 1.35 }),
      RATING.AGAIN,
      NOW
    );
    expect(r.easeFactor).toBe(1.3);
  });

  it('Hard -> interval x 1.2, ease -0.15, reps +1', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 10, easeFactor: 2.5, repetitions: 2 }),
      RATING.HARD,
      NOW
    );
    expect(r).toMatchObject({ state: 'review', interval: 12, easeFactor: 2.35, repetitions: 3 });
    expect(r.dueDate).toBe(NOW + 12 * DAY);
  });

  it('Hard floors ease at 1.3', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 10, easeFactor: 1.35 }),
      RATING.HARD,
      NOW
    );
    expect(r.easeFactor).toBe(1.3);
  });

  it('Good -> interval x ease, ease unchanged, reps +1', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 6, easeFactor: 2.5, repetitions: 1 }),
      RATING.GOOD,
      NOW
    );
    expect(r).toMatchObject({ state: 'review', interval: 15, easeFactor: 2.5, repetitions: 2 });
    expect(r.dueDate).toBe(NOW + 15 * DAY);
  });

  it('Easy -> interval x ease x 1.3, ease +0.15, reps +1', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 10, easeFactor: 2.5, repetitions: 3 }),
      RATING.EASY,
      NOW
    );
    expect(r).toMatchObject({ state: 'review', interval: 32.5, easeFactor: 2.65, repetitions: 4 });
  });

  it('Easy ceilings ease at 3.0', () => {
    const r = scheduleReview(
      card({ state: 'review', interval: 10, easeFactor: 2.95 }),
      RATING.EASY,
      NOW
    );
    expect(r.easeFactor).toBe(3.0);
  });

  it('keeps lapses untouched on success paths', () => {
    for (const rating of [RATING.HARD, RATING.GOOD, RATING.EASY]) {
      const r = scheduleReview(card({ state: 'review', interval: 10, lapses: 4 }), rating, NOW);
      expect(r.lapses).toBe(4);
    }
  });
});

describe('SRS (§10) — relearning cards', () => {
  it('Again floors at 10m', () => {
    const r = scheduleReview(
      card({ state: 'relearning', interval: 3, repetitions: 0 }),
      RATING.AGAIN,
      NOW
    );
    expect(r).toMatchObject({ state: 'relearning', interval: 10, repetitions: 0 });
    expect(r.dueDate).toBe(NOW + 10 * MINUTE);
  });

  it('Hard -> 10m', () => {
    const r = scheduleReview(card({ state: 'relearning', interval: 10 }), RATING.HARD, NOW);
    expect(r).toMatchObject({ state: 'relearning', interval: 10 });
  });

  it('Good exits to review at 1d with reps 1', () => {
    const r = scheduleReview(
      card({ state: 'relearning', interval: 10, easeFactor: 2.1 }),
      RATING.GOOD,
      NOW
    );
    expect(r).toMatchObject({ state: 'review', interval: 1, repetitions: 1, easeFactor: 2.1 });
    expect(r.dueDate).toBe(NOW + 1 * DAY);
  });

  it('Easy exits to review at 4d with reps 1', () => {
    const r = scheduleReview(card({ state: 'relearning', interval: 10 }), RATING.EASY, NOW);
    expect(r).toMatchObject({ state: 'review', interval: 4, repetitions: 1 });
  });

  it('does not change ease or count lapses', () => {
    const r = scheduleReview(
      card({ state: 'relearning', easeFactor: 1.9, lapses: 2 }),
      RATING.AGAIN,
      NOW
    );
    expect(r.easeFactor).toBe(1.9);
    expect(r.lapses).toBe(2);
  });
});

describe('SRS (§10) — dueDate math', () => {
  it('is exact ms addition across the US spring-forward DST boundary', () => {
    // 2026-03-08 07:00Z is the US spring-forward instant; a review the day
    // before must still land exactly 86,400,000 ms later.
    const before = Date.UTC(2026, 2, 7, 12);
    const r = scheduleReview(
      card({ state: 'review', interval: 6, easeFactor: 2.5 }),
      RATING.GOOD,
      before
    );
    expect(r.dueDate).toBe(before + 15 * DAY);
    expect(new Date(r.dueDate).getUTCHours()).toBe(12); // wall clock may shift locally, ms don't
  });

  it('is exact ms addition across the US fall-back DST boundary', () => {
    const before = Date.UTC(2026, 9, 31, 12);
    const r = scheduleReview(
      card({ state: 'review', interval: 6, easeFactor: 2.5 }),
      RATING.GOOD,
      before
    );
    expect(r.dueDate).toBe(before + 15 * DAY);
  });

  it('rounds fractional-day intervals to the nearest minute', () => {
    // 11d x 2.6 ease x 1.3 easy = 37.18 days = 53,539.2 minutes -> 53,539.
    const r = scheduleReview(
      card({ state: 'review', interval: 11, easeFactor: 2.6 }),
      RATING.EASY,
      NOW
    );
    expect(r.interval).toBeCloseTo(37.18, 10);
    expect(r.dueDate).toBe(NOW + 53539 * MINUTE);
  });
});

describe('SRS (§10) — invariants', () => {
  it('keeps ease inside [1.3, 3.0] across a long mixed history', () => {
    let c = emptyCard();
    const ratings = [RATING.GOOD, RATING.GOOD, RATING.AGAIN, RATING.GOOD, RATING.EASY, RATING.HARD];
    for (let i = 0; i < 30; i++) {
      const r = scheduleReview(c, ratings[i % ratings.length], NOW);
      expect(r.easeFactor).toBeGreaterThanOrEqual(EASE.MIN);
      expect(r.easeFactor).toBeLessThanOrEqual(EASE.MAX);
      c = r;
    }
  });

  it('keeps reps/lapses bookkeeping consistent: Again resets reps and counts a lapse', () => {
    let c = card({ state: 'review', interval: 10, repetitions: 7, lapses: 0 });
    c = scheduleReview(c, RATING.GOOD, NOW);
    expect(c.repetitions).toBe(8);
    c = scheduleReview(c, RATING.AGAIN, NOW);
    expect(c.repetitions).toBe(0);
    expect(c.lapses).toBe(1);
    c = scheduleReview(c, RATING.GOOD, NOW); // relearning exit
    expect(c.repetitions).toBe(1);
    expect(c.lapses).toBe(1);
  });

  it('rejects invalid ratings and states loudly', () => {
    expect(() => scheduleReview(card(), 4, NOW)).toThrow(RangeError);
    expect(() => scheduleReview(card(), -1, NOW)).toThrow(RangeError);
    expect(() => scheduleReview(card({ state: 'dormant' }), RATING.GOOD, NOW)).toThrow(RangeError);
  });
});

describe('isMastered (§10)', () => {
  it('is review state with interval >= 180d, and nothing else', () => {
    expect(isMastered({ state: 'review', interval: 180 })).toBe(true);
    expect(isMastered({ state: 'review', interval: 179 })).toBe(false);
    expect(isMastered({ state: 'learning', interval: 400 })).toBe(false);
    expect(isMastered({ state: 'relearning', interval: 400 })).toBe(false);
  });
});
