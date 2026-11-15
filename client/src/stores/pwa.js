import { create } from 'zustand';

/** Service-worker update state (D25: prompt only, never a silent reload). */
export const usePWA = create((set) => ({
  needRefresh: false,
  offlineReady: false,
  applyUpdate: null,

  setNeedRefresh(needRefresh) {
    set({ needRefresh });
  },
  setOfflineReady(offlineReady) {
    set({ offlineReady });
  },
  setApplyUpdate(applyUpdate) {
    set({ applyUpdate });
  },
  dismissUpdate() {
    set({ needRefresh: false });
  },
}));
