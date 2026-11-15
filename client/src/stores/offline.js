import { create } from 'zustand';

/** Online/offline + IndexedDB queue mirror for the global banner and sync. */
export const useOffline = create((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  syncing: false,

  setOnline(online) {
    set({ online });
  },
  setPending(pending) {
    set({ pending });
  },
  setSyncing(syncing) {
    set({ syncing });
  },
}));
