import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetOfflineQueueForTests,
  clearReviews,
  enqueueReview,
  listReviews,
  MAX_QUEUE_AGE_MS,
  newEventId,
  pendingCount,
  pruneExpired,
  removeReview,
} from './offlineQueue.js';

/** D24 review queue — jsdom has no IndexedDB, so this exercises the fallback. */

beforeEach(() => {
  __resetOfflineQueueForTests();
});

const entry = (overrides = {}) => ({
  userId: 'user-a',
  cardId: '656f000000000000000000a1',
  character: '水',
  rating: 2,
  reviewedAt: new Date().toISOString(),
  ...overrides,
});

describe('offline review queue (D24)', () => {
  it('scopes entries by user and lists them oldest first', async () => {
    await enqueueReview(entry({ reviewedAt: '2026-11-15T08:00:00.000Z', eventId: 'later' }));
    await enqueueReview(entry({ reviewedAt: '2026-11-15T06:00:00.000Z', eventId: 'earlier' }));
    await enqueueReview(
      entry({ userId: 'user-b', reviewedAt: '2026-11-15T05:00:00.000Z', eventId: 'other' })
    );

    const mine = await listReviews('user-a');
    expect(mine.map((item) => item.eventId)).toEqual(['earlier', 'later']);
    expect(await pendingCount('user-a')).toBe(2);
    expect(await pendingCount('user-b')).toBe(1);
    expect(await pendingCount(undefined)).toBe(0);
  });

  it('removes a single event and clears a user without touching another', async () => {
    await enqueueReview(entry({ eventId: 'one' }));
    await enqueueReview(entry({ eventId: 'two' }));
    await enqueueReview(entry({ userId: 'user-b', eventId: 'three' }));

    await removeReview('one');
    expect((await listReviews('user-a')).map((item) => item.eventId)).toEqual(['two']);

    await clearReviews('user-a');
    expect(await pendingCount('user-a')).toBe(0);
    expect(await pendingCount('user-b')).toBe(1);
  });

  it('prunes entries past the 24-hour window and reports them', async () => {
    const now = Date.parse('2026-11-15T12:00:00.000Z');
    await enqueueReview(
      entry({ eventId: 'stale', reviewedAt: new Date(now - MAX_QUEUE_AGE_MS - 1).toISOString() })
    );
    await enqueueReview(
      entry({
        eventId: 'fresh',
        reviewedAt: new Date(now - MAX_QUEUE_AGE_MS + 60_000).toISOString(),
      })
    );

    const expired = await pruneExpired('user-a', now);
    expect(expired.map((item) => item.eventId)).toEqual(['stale']);
    expect((await listReviews('user-a')).map((item) => item.eventId)).toEqual(['fresh']);
  });

  it('validates the userId and reviewedAt, and always makes an event id', async () => {
    await expect(enqueueReview(entry({ userId: null }))).rejects.toThrow(/userId/);
    await expect(enqueueReview(entry({ reviewedAt: 'not-a-date' }))).rejects.toThrow(/ISO/);

    const first = await enqueueReview(entry());
    const second = await enqueueReview(entry({ cardId: '656f000000000000000000a2' }));
    expect(first.eventId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(second.eventId).not.toBe(first.eventId);
    expect(newEventId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
