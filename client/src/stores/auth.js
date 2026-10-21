import { create } from 'zustand';
import { api } from '../lib/api.js';

/** Auth session state. Tokens live in httpOnly cookies — the store only
 *  mirrors the server's view (GET /users/me on hydrate). */
export const useAuth = create((set) => ({
  status: 'loading', // 'loading' | 'authed' | 'guest'
  user: null,
  gamification: null,

  applySession(data) {
    set({ status: 'authed', user: data.user, gamification: data.gamification });
  },

  async hydrate() {
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
