/**
 * Offline review queue (D24) - IndexedDB with an in-memory fallback for
 * environments without IndexedDB (private modes, jsdom). Entries are scoped
 * by `userId` so one account can never sync another account's reviews.
 */

const DB_NAME = 'kanjiquest-offline';
const STORE = 'reviews';
const DB_VERSION = 1;
export const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;

const memory = new Map();
let dbPromise = null;

const hasIndexedDB = () => typeof indexedDB !== 'undefined';

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'eventId' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('reviewedAt', 'reviewedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function newEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Queue one rating. `reviewedAt` is the local moment the learner rated. */
export async function enqueueReview({
  userId,
  cardId,
  character,
  rating,
  reviewedAt = new Date().toISOString(),
  eventId = newEventId(),
}) {
  if (!userId) throw new Error('offline queue: userId is required');
  if (typeof reviewedAt !== 'string' || Number.isNaN(Date.parse(reviewedAt))) {
    throw new Error('offline queue: reviewedAt must be an ISO timestamp');
  }
  const entry = {
    eventId,
    userId,
    cardId,
    character: character ?? null,
    rating,
    reviewedAt,
    queuedAt: new Date().toISOString(),
  };

  if (!hasIndexedDB()) {
    memory.set(eventId, entry);
    return entry;
  }

  const db = await openDb();
  await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry));
  return entry;
}

/** All queued ratings for one user, oldest first (chronological flush). */
export async function listReviews(userId) {
  if (!userId) return [];
  let entries;
  if (!hasIndexedDB()) {
    entries = [...memory.values()].filter((entry) => entry.userId === userId);
  } else {
    const db = await openDb();
    const index = db.transaction(STORE, 'readonly').objectStore(STORE).index('userId');
    entries = await requestResult(index.getAll(userId));
  }
  return entries.sort(
    (a, b) =>
      Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.eventId.localeCompare(b.eventId)
  );
}

export async function pendingCount(userId) {
  if (!userId) return 0;
  if (!hasIndexedDB()) {
    return [...memory.values()].filter((entry) => entry.userId === userId).length;
  }
  const db = await openDb();
  const index = db.transaction(STORE, 'readonly').objectStore(STORE).index('userId');
  return requestResult(index.count(userId));
}

export async function removeReview(eventId) {
  if (!hasIndexedDB()) {
    memory.delete(eventId);
    return;
  }
  const db = await openDb();
  await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(eventId));
}

/** Drop entries older than the server's 24-hour acceptance window. */
export async function pruneExpired(userId, now = Date.now(), maxAgeMs = MAX_QUEUE_AGE_MS) {
  const entries = await listReviews(userId);
  const expired = entries.filter((entry) => {
    const timestamp = Date.parse(entry.reviewedAt);
    return !Number.isFinite(timestamp) || timestamp < now - maxAgeMs;
  });
  for (const entry of expired) await removeReview(entry.eventId);
  return expired;
}

export async function clearReviews(userId) {
  const entries = await listReviews(userId);
  for (const entry of entries) await removeReview(entry.eventId);
}

/** Test hook: forget the in-memory fallback and the cached IndexedDB handle. */
export function __resetOfflineQueueForTests() {
  memory.clear();
  dbPromise = null;
}
