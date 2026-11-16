import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }
  return { mockApi: vi.fn(), MockApiError };
});

vi.mock('./api.js', () => ({ api: mockApi, ApiError: MockApiError }));

import { api, ApiError } from './api.js';
import { flushOfflineReviews, syncSummary } from './offlineSync.js';
import {
  __resetOfflineQueueForTests,
  enqueueReview,
  listReviews,
  pendingCount,
} from './offlineQueue.js';
import { useOffline } from '../stores/offline.js';

/** D24 flush — chronological, idempotent, keep-on-network/auth-server errors. */

// Relative timestamps keep the 24-hour prune window from expiring the fixtures.
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const entry = (overrides = {}) => ({
  userId: 'user-a',
  cardId: '656f000000000000000000a1',
  character: '水',
  rating: 2,
  reviewedAt: minutesAgo(30),
  eventId: 'event-one',
  ...overrides,
});

beforeEach(() => {
  __resetOfflineQueueForTests();
  api.mockReset();
  useOffline.setState({ online: true, pending: 0, syncing: false });
});

describe('flushOfflineReviews (D24)', () => {
  it('posts oldest first, removes synced entries, and counts timestamp adjustments', async () => {
    const olderAt = minutesAgo(120);
    await enqueueReview(entry({ eventId: 'older', reviewedAt: olderAt }));
    await enqueueReview(entry({ eventId: 'newer', reviewedAt: minutesAgo(60) }));
    api.mockImplementation(async (path, options) => ({
      timestampAdjusted: options.body.eventId === 'older',
    }));

    const result = await flushOfflineReviews('user-a');

    expect(api.mock.calls.map(([, options]) => options.body.eventId)).toEqual(['older', 'newer']);
    expect(api).toHaveBeenCalledWith('/progress/review', {
      method: 'POST',
      body: {
        cardId: entry().cardId,
        rating: 2,
        eventId: 'older',
        reviewedAt: olderAt,
      },
    });
    expect(result).toMatchObject({ synced: 2, adjusted: 1, remaining: 0, stopped: false });
    expect(await pendingCount('user-a')).toBe(0);
    expect(useOffline.getState()).toMatchObject({ pending: 0, syncing: false });
  });

  it('keeps the queue and stops on a network failure', async () => {
    await enqueueReview(entry({ eventId: 'one' }));
    await enqueueReview(entry({ eventId: 'two', reviewedAt: minutesAgo(20) }));
    api.mockRejectedValue(new Error('offline'));

    const result = await flushOfflineReviews('user-a');

    expect(api).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ synced: 0, remaining: 2, stopped: true });
    expect((await listReviews('user-a')).map((item) => item.eventId)).toEqual(['one', 'two']);
  });

  it('keeps entries when the server is down or the session expired', async () => {
    await enqueueReview(entry({ eventId: 'one' }));
    api.mockRejectedValue(new ApiError('Service unavailable.', 503, 'SERVICE_UNAVAILABLE'));

    const result = await flushOfflineReviews('user-a');
    expect(result).toMatchObject({ synced: 0, remaining: 1, stopped: true });

    api.mockRejectedValue(new ApiError('Sign in again.', 401, 'UNAUTHORIZED'));
    const auth = await flushOfflineReviews('user-a');
    expect(auth).toMatchObject({ synced: 0, remaining: 1, stopped: true });
  });

  it('drops server-rejected entries and continues with the next one', async () => {
    await enqueueReview(entry({ eventId: 'expired', character: '水' }));
    await enqueueReview(entry({ eventId: 'valid', character: '火', reviewedAt: minutesAgo(20) }));
    api
      .mockRejectedValueOnce(new ApiError('Too old.', 422, 'REVIEW_TOO_OLD'))
      .mockResolvedValueOnce({});

    const result = await flushOfflineReviews('user-a');

    expect(result).toMatchObject({ synced: 1, remaining: 0 });
    expect(result.rejected).toEqual([
      { eventId: 'expired', cardId: entry().cardId, character: '水', reason: 'REVIEW_TOO_OLD' },
    ]);
    expect(await pendingCount('user-a')).toBe(0);
  });

  it('summarizes synced and rejected batches for the toast', () => {
    expect(syncSummary(null)).toBeNull();
    expect(syncSummary({ synced: 1, adjusted: 0, rejected: [], remaining: 0 })).toMatchObject({
      message: '1 offline review synced.',
    });
    expect(syncSummary({ synced: 2, adjusted: 1, rejected: [], remaining: 0 }).message).toContain(
      '1 counted from today'
    );
    expect(
      syncSummary({
        synced: 1,
        adjusted: 0,
        rejected: [{ character: '水' }],
        remaining: 0,
      })
    ).toMatchObject({
      message: '1 offline review synced. 1 older review could not be saved.',
      tone: 'info',
    });
    expect(
      syncSummary({
        synced: 0,
        adjusted: 0,
        rejected: [
          { character: '水' },
          { character: '火' },
          { character: '日' },
          { character: '月' },
        ],
        remaining: 0,
      }).message
    ).toBe('4 offline reviews were too old to save: 水, 火, 日….');
    expect(syncSummary({ synced: 0, adjusted: 0, rejected: [], remaining: 1 })).toBeNull();
  });
});
