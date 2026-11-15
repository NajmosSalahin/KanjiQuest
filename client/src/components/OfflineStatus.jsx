import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../stores/auth.js';
import { useOffline } from '../stores/offline.js';
import { usePWA } from '../stores/pwa.js';
import { useToast } from './ui/Toast.jsx';
import { flushOfflineReviews, syncSummary } from '../lib/offlineSync.js';
import { pendingCount } from '../lib/offlineQueue.js';

/** Subtle global offline strip (§6.14), always visible while disconnected. */
export function OfflineBanner() {
  const online = useOffline((state) => state.online);
  const pending = useOffline((state) => state.pending);
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-line-subtle bg-subtle px-4 py-2 text-center text-xs text-ink-secondary"
    >
      <WifiOff size={14} aria-hidden="true" className="shrink-0" />
      <span>Offline — reviews will sync when you reconnect</span>
      {pending > 0 ? (
        <span className="font-mono text-ink-secondary">({pending} waiting)</span>
      ) : null}
    </div>
  );
}

/** Tracks browser connectivity in the shared store. */
export function useConnectivity() {
  const setOnline = useOffline((state) => state.setOnline);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline]);
}

/**
 * Tracks connectivity, refreshes the pending count, and flushes the D24 queue
 * on reconnect. Toasts summarize saved/adjusted/rejected entries.
 */
export function useOfflineSync() {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.user?.id);
  const online = useOffline((state) => state.online);
  const setPending = useOffline((state) => state.setPending);
  const setSyncing = useOffline((state) => state.setSyncing);

  useConnectivity();

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    async function sync() {
      const fresh = await pendingCount(userId).catch(() => 0);
      if (cancelled) return;
      setPending(fresh);
      if (!online || fresh === 0) return;

      const result = await flushOfflineReviews(userId);
      if (cancelled) return;
      setSyncing(false);
      const summary = syncSummary(result);
      if (summary) push(summary);
      if (result.synced > 0) {
        await useAuth.getState().hydrate();
        queryClient.invalidateQueries({ queryKey: ['quests', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['progress', 'stats'] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [online, userId, push, queryClient, setPending, setSyncing]);
}

/**
 * D25 update action: appears only after the page has settled, never offline,
 * never while queued reviews are waiting, and never on the full-screen routes
 * (AppShell renders it).
 */
export function UpdatePrompt() {
  const needRefresh = usePWA((state) => state.needRefresh);
  const applyUpdate = usePWA((state) => state.applyUpdate);
  const dismissUpdate = usePWA((state) => state.dismissUpdate);
  const online = useOffline((state) => state.online);
  const pending = useOffline((state) => state.pending);
  const syncing = useOffline((state) => state.syncing);
  const [settled, setSettled] = useState(false);

  const suppressed = !needRefresh || !online || pending > 0 || syncing;

  useEffect(() => {
    setSettled(false);
    if (suppressed) return undefined;
    const timer = setTimeout(() => setSettled(true), 4000);
    return () => clearTimeout(timer);
  }, [suppressed]);

  if (suppressed || !settled) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-card border border-line-subtle bg-surface px-3 py-2 text-sm text-ink-primary shadow-md md:bottom-4"
    >
      <span>Update available</span>
      <button
        type="button"
        onClick={applyUpdate ?? undefined}
        className="inline-flex items-center gap-1 rounded-control bg-vermillion px-2.5 py-1 text-xs font-medium text-white transition-colors duration-fast ease-out hover:bg-vermillion-hover"
      >
        <RefreshCw size={12} aria-hidden="true" />
        Refresh
      </button>
      <button
        type="button"
        aria-label="Dismiss update"
        onClick={dismissUpdate}
        className="p-1 text-ink-secondary transition-colors duration-fast ease-out hover:text-ink-primary"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
