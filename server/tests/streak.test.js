import { describe, it, expect } from 'vitest';
import { localDay, localHour, addDays, dayDiff } from '../src/services/time.js';
import {
  applyStreak,
  displayStreak,
  crossedMilestone,
  nextMilestone,
  repairStatus,
  applyRepair,
} from '../src/services/streak.js';

function profile(overrides = {}) {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    streakFreezes: 0,
    coins: 0,
    lastStreakRepairAt: null,
    ...overrides,
  };
}

describe('time helpers (§11.4 local-day boundaries)', () => {
  it('formats the local day in the user timezone, not the server one', () => {
    const moment = new Date('2026-03-11T23:30:00Z');
    expect(localDay(moment, 'UTC')).toBe('2026-03-11');
    expect(localDay(moment, 'Asia/Tokyo')).toBe('2026-03-12'); // JST is UTC+9
    expect(localDay(moment, 'America/New_York')).toBe('2026-03-11');
  });

  it('reads the local hour for time-of-day achievements', () => {
    const moment = new Date('2026-03-11T23:30:00Z');
    expect(localHour(moment, 'UTC')).toBe(23);
    expect(localHour(moment, 'Asia/Tokyo')).toBe(8); // next morning in JST
  });

  it('addDays/dayDiff survive month, year, and leap boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dayDiff('2026-02-28', '2026-03-02')).toBe(2);
    expect(dayDiff('2026-03-02', '2026-02-28')).toBe(-2);
  });
});

describe('applyStreak (§11.4)', () => {
  it('starts at 1 on the first ever activity', () => {
    const p = profile();
    expect(applyStreak(p, '2026-03-12')).toEqual({
      streak: 1,
      extended: false,
      reset: false,
      froze: 0,
    });
    expect(p.currentStreak).toBe(1);
  });

  it('is a no-op when already active today', () => {
    const p = profile({ currentStreak: 5, lastActivityDate: '2026-03-12' });
    expect(applyStreak(p, '2026-03-12').streak).toBe(5);
    expect(p.currentStreak).toBe(5);
  });

  it('extends by one when the last activity was yesterday', () => {
    const p = profile({ currentStreak: 5, lastActivityDate: '2026-03-11' });
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 6, extended: true, reset: false });
  });

  it('resets to 1 after a missed day (no freeze)', () => {
    const p = profile({ currentStreak: 12, lastActivityDate: '2026-03-10' });
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 1, reset: true, froze: 0 });
  });

  it('consumes one freeze per missed day and keeps the chain', () => {
    const p = profile({ currentStreak: 12, lastActivityDate: '2026-03-10', streakFreezes: 1 });
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 13, reset: false, froze: 1 });
    expect(p.streakFreezes).toBe(0);
  });

  it('needs one freeze per missed day — short on freezes resets', () => {
    const p = profile({ currentStreak: 12, lastActivityDate: '2026-03-09', streakFreezes: 1 });
    // Missed 10th AND 11th: one freeze cannot cover two days.
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 1, reset: true, froze: 0 });
    expect(p.streakFreezes).toBe(1); // not consumed on a failed save
  });

  it('freezes cover a long absence when enough are stocked', () => {
    const p = profile({ currentStreak: 3, lastActivityDate: '2026-03-09', streakFreezes: 2 });
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 4, froze: 2 });
  });
});

describe('displayStreak (dashboard, lazy-streak safe)', () => {
  it('shows the stored value while active or "yesterday" (grace)', () => {
    expect(
      displayStreak(profile({ currentStreak: 9, lastActivityDate: '2026-03-12' }), '2026-03-12')
    ).toBe(9);
    expect(
      displayStreak(profile({ currentStreak: 9, lastActivityDate: '2026-03-11' }), '2026-03-12')
    ).toBe(9);
  });

  it('hides a stale streak once a day was missed (until repair/freeze)', () => {
    expect(
      displayStreak(profile({ currentStreak: 9, lastActivityDate: '2026-03-10' }), '2026-03-12')
    ).toBe(0);
    const frozen = profile({ currentStreak: 9, lastActivityDate: '2026-03-10', streakFreezes: 1 });
    expect(displayStreak(frozen, '2026-03-12')).toBe(9);
  });

  it('is 0 with no activity ever', () => {
    expect(displayStreak(profile(), '2026-03-12')).toBe(0);
  });
});

describe('milestones (§11.4 / §7.1)', () => {
  it('reports the first 7/30/100 crossing', () => {
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(29, 30)).toBe(30);
    expect(crossedMilestone(99, 100)).toBe(100);
    expect(crossedMilestone(7, 8)).toBeNull();
    expect(crossedMilestone(65, 70)).toBeNull();
  });

  it('names the next bar milestone (spec: "10 days to Sakura" at streak 20)', () => {
    expect(nextMilestone(6)).toBeNull(); // bar shows only at streak >= 7
    expect(nextMilestone(7)).toEqual({ days: 14, name: 'Wakaba', remaining: 7 });
    expect(nextMilestone(20)).toEqual({ days: 30, name: 'Sakura', remaining: 10 });
    expect(nextMilestone(45)).toEqual({ days: 60, name: 'Hanami', remaining: 15 });
    expect(nextMilestone(80)).toEqual({ days: 100, name: 'Momiji', remaining: 20 });
    expect(nextMilestone(100)).toBeNull(); // top milestone reached
  });
});

describe('streak repair (§11.4 banner + D10)', () => {
  it('is available only when the previous day was the missed one', () => {
    // Last active two days ago => the missed day was "yesterday".
    const broken = profile({ currentStreak: 12, lastActivityDate: '2026-03-10', coins: 150 });
    const status = repairStatus(broken, '2026-03-12', 'UTC');
    expect(status).toMatchObject({
      available: true,
      cost: 100,
      streakLost: 12,
      brokenDay: '2026-03-11',
    });

    // Still only a grace gap — nothing broken yet.
    expect(
      repairStatus(
        profile({ currentStreak: 12, lastActivityDate: '2026-03-11' }),
        '2026-03-12',
        'UTC'
      ).available
    ).toBe(false);
    // Too old.
    expect(
      repairStatus(
        profile({ currentStreak: 12, lastActivityDate: '2026-03-08' }),
        '2026-03-12',
        'UTC'
      ).available
    ).toBe(false);
    // No streak to lose.
    expect(
      repairStatus(
        profile({ currentStreak: 0, lastActivityDate: '2026-03-10' }),
        '2026-03-12',
        'UTC'
      ).available
    ).toBe(false);
  });

  it('caps repair at once per calendar month', () => {
    const p = profile({
      currentStreak: 12,
      lastActivityDate: '2026-03-10',
      coins: 150,
      lastStreakRepairAt: new Date('2026-03-05T10:00:00Z'),
    });
    expect(repairStatus(p, '2026-03-12', 'UTC')).toMatchObject({
      available: false,
      monthUsed: true,
    });
    // A repair last month does not block this month's.
    const lastMonth = profile({
      currentStreak: 12,
      lastActivityDate: '2026-03-10',
      coins: 150,
      lastStreakRepairAt: new Date('2026-02-20T10:00:00Z'),
    });
    expect(repairStatus(lastMonth, '2026-03-12', 'UTC').available).toBe(true);
  });

  it('applyRepair charges 100 coins and lets the next review chain (streak + 1)', () => {
    const p = profile({ currentStreak: 12, lastActivityDate: '2026-03-10', coins: 150 });
    applyRepair(p, '2026-03-12', new Date('2026-03-12T09:00:00Z'));
    expect(p.coins).toBe(50);
    expect(p.lastActivityDate).toBe('2026-03-11'); // the missed day counts as shown-up
    expect(p.lastStreakRepairAt).toBeInstanceOf(Date);
    // Reviewing "today" now reads as yesterday-gap => extends, not resets.
    expect(applyStreak(p, '2026-03-12')).toMatchObject({ streak: 13, extended: true });
  });
});
