import { create } from 'zustand';
import { api } from '../lib/api.js';

/** Auth session state. Tokens live in httpOnly cookies — the store only
 *  mirrors the server's view (GET /users/me on hydrate). `kg_session` is a
 *  readable hint cookie set with the real session so first-time visitors can
 *  go straight to /login without an anonymous 401 round trip. */
const SESSION_HINT_COOKIE = 'kg_session';

function hasSessionHint() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${SESSION_HINT_COOKIE}=1`);
}

export const useAuth = create((set) => ({
  status: hasSessionHint() ? 'loading' : 'guest', // 'loading' | 'authed' | 'guest'
  user: null,
  gamification: null,

  applySession(data) {
    set({ status: 'authed', user: data.user, gamification: data.gamification });
  },

  /** Partial gamification refresh after awarding XP (reviews, Phase 3). */
  mergeGamification(partial) {
    set((state) => ({ gamification: { ...state.gamification, ...partial } }));
  },

  /** Partial user refresh after profile/settings/avatar updates. */
  mergeUser(partial) {
    set((state) => ({ user: { ...state.user, ...partial } }));
  },

  async hydrate() {
    if (!hasSessionHint()) {
      set({ status: 'guest', user: null, gamification: null });
      return;
    }
    try {
      const data = await api('/users/me');
      set({ status: 'authed', user: data.user, gamification: data.gamification });
    } catch {
      set({ status: 'guest', user: null, gamification: null });
    }
  },

  async login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    set({ status: 'authed', user: data.user, gamification: data.gamification });
    return data;
  },

  async register(payload) {
    const body = {
      ...payload,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const data = await api('/auth/register', { method: 'POST', body });
    set({ status: 'authed', user: data.user, gamification: data.gamification });
    return data;
  },

  async logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Best effort: even if the request fails (offline, server down), the
      // local session state always drops to guest.
    }
    set({ status: 'guest', user: null, gamification: null });
  },
}));
