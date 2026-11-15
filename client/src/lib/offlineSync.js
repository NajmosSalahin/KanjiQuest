import { api, ApiError } from './api.js';
import { listReviews, pendingCount, pruneExpired, removeReview } from './offlineQueue.js';
import { useOffline } from '../stores/offline.js';

/**
 * D24 flush: oldest first, idempotent via eventId, stops on connectivity or
 * auth failures, drops server-rejected entries and reports them. One flush
 * runs at a time so the review page and global banner can both ask for it.
 */

const KEEP_ENTRY_STATUSES = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);
let inflight = null;

export function flushOfflineReviews(userId) {
  if (!userId) {
    return Promise.resolve({ synced: 0, rejected: [], adjusted: 0, remaining: 0 });
  }
  if (inflight) return inflight;
  inflight = runFlush(userId).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runFlush(userId) {
  const store = useOffline.getState();
  store.setSyncing(true);
  const rejected = [];
  let synced = 0;
  let adjusted = 0;
  let stopped = false;

  try {
    const expired = await pruneExpired(userId);
    for (const entry of expired) {
      rejected.push({
        eventId: entry.eventId,
        cardId: entry.cardId,
        character: entry.character,
        reason: 'EXPIRED',
      });
    }

    const entries = await listReviews(userId);
    for (const entry of entries) {
      try {
        const result = await api('/progress/review', {
          method: 'POST',
          body: {
            cardId: entry.cardId,
            rating: entry.rating,
            eventId: entry.eventId,
            reviewedAt: entry.reviewedAt,
          },
        });
        await removeReview(entry.eventId);
        synced += 1;
        if (result?.timestampAdjusted) adjusted += 1;
      } catch (err) {
        const keep = !(err instanceof ApiError) || KEEP_ENTRY_STATUSES.has(err.status);
        if (keep) {
          stopped = true;
          break;
        }
        await removeReview(entry.eventId);
        rejected.push({
          eventId: entry.eventId,
          cardId: entry.cardId,
          character: entry.character,
          reason: err.code ?? 'REJECTED',
        });
      }
    }
  } finally {
    const remaining = await pendingCount(userId).catch(() => 0);
    store.setPending(remaining);
    store.setSyncing(false);
  }

  return { synced, rejected, adjusted, remaining: useOffline.getState().pending, stopped };
}

/** Short toast copy for a completed flush (used by the global sync hook). */
export function syncSummary(result) {
  if (!result) return null;
  if (result.synced > 0) {
    const adjusted =
      result.adjusted > 0
        ? ` - ${result.adjusted} counted from today to keep your streak honest`
        : '';
    const lost =
      result.rejected.length > 0
        ? ` ${result.rejected.length} older ${
            result.rejected.length === 1 ? 'review' : 'reviews'
          } could not be saved.`
        : '';
    return {
      message: `${result.synced} offline ${result.synced === 1 ? 'review' : 'reviews'} synced${adjusted}.${lost}`,
      tone: result.rejected.length > 0 ? 'info' : 'success',
    };
  }
  if (result.rejected.length > 0) {
    const cards = result.rejected
      .map((item) => item.character)
      .filter(Boolean)
      .slice(0, 3);
    const list = cards.length
      ? `: ${cards.join(', ')}${result.rejected.length > 3 ? '…' : ''}`
      : '';
    return {
      message: `${result.rejected.length} offline ${
        result.rejected.length === 1 ? 'review was' : 'reviews were'
      } too old to save${list}.`,
      tone: 'info',
    };
  }
  return null;
}
