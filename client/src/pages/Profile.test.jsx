import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn(), apiUpload: vi.fn() }));

import { api, apiUpload } from '../lib/api.js';
import { useAuth } from '../stores/auth.js';
import { ToastProvider } from '../components/ui/Toast.jsx';
import Profile from './Profile.jsx';

const USER = {
  id: 'u1',
  email: 'rina@example.com',
  displayName: 'Rina Kobayashi',
  avatarUrl: null,
  nativeLanguage: 'en',
  jlptLevel: 5,
  timezone: 'Asia/Tokyo',
  createdAt: '2026-01-15T10:00:00.000Z',
  preferences: {
    dailyGoalXP: 50,
    dailyReviewLimit: 20,
    theme: 'auto',
    furigana: true,
    soundEnabled: true,
    hapticsEnabled: false,
    reminderTime: null,
    reminderEnabled: false,
  },
};

const GAMIFICATION = {
  totalXP: 1240,
  currentLevel: 2,
  xpToNextLevel: 300,
  currentStreak: 12,
  longestStreak: 14,
  coins: 150,
  dailyGoalXP: 50,
  weeklyXP: 120,
  streakFreezes: 1,
  equippedTitle: 'title-diligent',
  equippedFrame: 'frame-sakura',
};

const ACHIEVEMENTS = {
  items: [
    {
      id: 'hajimemashite',
      name: 'Hajimemashite',
      nameJa: 'はじめまして',
      description: 'Complete your first review.',
      icon: 'hajimemashite',
      category: 'learning',
      rewardXP: 10,
      rewardCoins: 5,
      unlocked: true,
      unlockedAt: '2026-01-20T10:00:00.000Z',
      progress: null,
    },
    {
      id: 'fukkatsu',
      name: 'Fukkatsu',
      nameJa: '復活',
      description: 'Repair a broken streak.',
      icon: 'fukkatsu',
      category: 'special',
      rewardXP: 60,
      rewardCoins: 15,
      unlocked: false,
      unlockedAt: null,
      progress: { current: 0, target: 1 },
    },
  ],
  unlockedCount: 1,
};

const INVENTORY = {
  items: [
    {
      id: 'title-diligent',
      type: 'title',
      name: 'The Diligent',
      description: 'A title for those who show up every day.',
      price: 25,
      owned: true,
      quantity: 1,
      equipped: true,
    },
    {
      id: 'title-yama',
      type: 'title',
      name: 'Yama no Ue',
      description: 'Above the mountain.',
      price: 75,
      owned: true,
      quantity: 1,
      equipped: false,
    },
  ],
};

function mockApi() {
  api.mockReset();
  apiUpload.mockReset();
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/progress/stats') return { mastered: 12, total: 40 };
    if (path === '/gamification/achievements') return ACHIEVEMENTS;
    if (path === '/store/inventory') return INVENTORY;
    if (path === '/users/me' && options.method === 'PATCH') {
      return { user: { ...USER, ...options.body } };
    }
    if (path === '/users/me/preferences' && options.method === 'PATCH') {
      return { preferences: { ...USER.preferences, ...options.body } };
    }
    if (path === '/gamification/store/equip' && options.method === 'POST') {
      return {
        equippedTitle: options.body.itemId,
        equippedFrame: GAMIFICATION.equippedFrame,
      };
    }
    if (path === '/users/me' && options.method === 'DELETE') {
      return { deleted: true };
    }
    throw new Error(`unexpected api path: ${path}`);
  });
  apiUpload.mockResolvedValue({ avatarUrl: '/api/v1/assets/abc123abc123abc123abc123' });
}

function renderProfile(path = '/profile') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockApi();
  delete document.documentElement.dataset.theme;
  useAuth.setState({
    status: 'authed',
    user: USER,
    gamification: GAMIFICATION,
  });
});

describe('Profile (§7.8)', () => {
  it('renders the identity block, level badge, joined date, and three stat cards', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Rina Kobayashi')).toBeTruthy();
    expect(screen.getByText('The Diligent')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Level 2' })).toBeTruthy();
    expect(screen.getByText('Joined January 2026')).toBeTruthy();
    expect(screen.getByText('1,240')).toBeTruthy();
    expect(screen.getByText('Longest streak')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();

    await screen.findByText('Kanji mastered');
    const masteredCard = screen.getByText('Kanji mastered').closest('div');
    expect(within(masteredCard).getByText('12')).toBeTruthy();
  });

  it('edits the display name inline and updates the auth store', async () => {
    const user = userEvent.setup();
    renderProfile();

    await screen.findByText('Rina Kobayashi');
    await user.click(screen.getByRole('button', { name: 'Edit display name' }));
    const input = screen.getByLabelText('Display name');
    await user.clear(input);
    await user.type(input, 'Rina K.');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/users/me', {
        method: 'PATCH',
        body: { displayName: 'Rina K.' },
      })
    );
    await waitFor(() => expect(useAuth.getState().user.displayName).toBe('Rina K.'));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('opens the title picker and equips an owned title', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('button', { name: /The Diligent/ }));
    const dialog = await screen.findByRole('dialog');
    const titleButton = await within(dialog).findByRole('button', { name: /Yama no Ue/ });
    await user.click(titleButton);

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/gamification/store/equip', {
        method: 'POST',
        body: { slot: 'title', itemId: 'title-yama' },
      })
    );
    await waitFor(() => expect(useAuth.getState().gamification.equippedTitle).toBe('title-yama'));
    expect(await screen.findByText('Title updated.')).toBeTruthy();
  });

  it('lists all achievements and opens a locked achievement with progress', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('tab', { name: 'Achievements' }));
    expect(await screen.findByText('1 of 2 unlocked')).toBeTruthy();
    expect(screen.getByText('Hajimemashite')).toBeTruthy();
    expect(screen.getByText('はじめまして')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Fukkatsu/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Repair a broken streak.')).toBeTruthy();
    expect(within(dialog).getByText('Locked — keep going')).toBeTruthy();
    expect(within(dialog).getByText('0/1')).toBeTruthy();
  });

  it('auto-saves settings and applies the theme immediately', async () => {
    const user = userEvent.setup();
    renderProfile('/profile?tab=settings');

    const theme = await screen.findByLabelText('Theme');
    await user.selectOptions(theme, 'dark');

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/users/me/preferences', {
        method: 'PATCH',
        body: { theme: 'dark' },
      })
    );
    await waitFor(() => expect(useAuth.getState().user.preferences.theme).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((await screen.findAllByText('Saved')).length).toBeGreaterThanOrEqual(1);

    await user.selectOptions(screen.getByLabelText('Daily goal'), '100');
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/users/me/preferences', {
        method: 'PATCH',
        body: { dailyGoalXP: 100 },
      })
    );
    expect(useAuth.getState().gamification.dailyGoalXP).toBe(100);
  });

  it('uploads an avatar through the multipart API and updates the profile', async () => {
    const user = userEvent.setup();
    renderProfile();

    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Choose avatar image'), file);

    await waitFor(() => expect(apiUpload).toHaveBeenCalled());
    expect(apiUpload.mock.calls[0][0]).toBe('/users/me/avatar');
    expect(apiUpload.mock.calls[0][1]).toBe(file);
    await waitFor(() =>
      expect(useAuth.getState().user.avatarUrl).toBe('/api/v1/assets/abc123abc123abc123abc123')
    );
    expect(await screen.findByText('Avatar updated.')).toBeTruthy();
  });

  it('requires the exact display name before deleting the account', async () => {
    const user = userEvent.setup();
    renderProfile('/profile?tab=settings');

    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByLabelText('Type "Rina Kobayashi" to confirm');
    await user.type(confirm, 'Rina Kobayashi');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/users/me', {
        method: 'DELETE',
        body: { confirmName: 'Rina Kobayashi' },
      })
    );
    expect(await screen.findByText('login page')).toBeTruthy();
    expect(useAuth.getState().status).toBe('guest');
  });
});
