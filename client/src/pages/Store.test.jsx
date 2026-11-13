import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn(), apiUpload: vi.fn() }));

import { api } from '../lib/api.js';
import { useAuth } from '../stores/auth.js';
import { ToastProvider } from '../components/ui/Toast.jsx';
import Store from './Store.jsx';

const ITEMS = [
  {
    id: 'streak-freeze',
    type: 'freeze',
    name: 'Streak freeze',
    description: 'Protects your streak for one missed day.',
    price: 50,
    maxActive: 2,
    icon: 'freeze',
    owned: false,
    quantity: 0,
    equipped: false,
    active: false,
    atMax: false,
    affordable: true,
    remainingCoins: 0,
    disabledReason: null,
    canBuy: true,
  },
  {
    id: 'xp-boost',
    type: 'boost',
    name: 'XP boost',
    description: 'Earn 1.5× XP for the next 24 hours.',
    price: 100,
    icon: 'boost',
    owned: false,
    quantity: 0,
    equipped: false,
    active: false,
    atMax: false,
    affordable: true,
    remainingCoins: 0,
    disabledReason: null,
    canBuy: true,
  },
  {
    id: 'title-diligent',
    type: 'title',
    name: 'The Diligent',
    description: 'A title for those who show up every day.',
    price: 25,
    icon: 'title',
    owned: true,
    quantity: 1,
    equipped: false,
    active: false,
    atMax: false,
    affordable: true,
    remainingCoins: 0,
    disabledReason: 'ALREADY_OWNED',
    canBuy: false,
  },
  {
    id: 'frame-sakura',
    type: 'frame',
    name: 'Sakura',
    nameJa: '桜',
    description: 'A frame of falling cherry blossoms.',
    price: 100,
    icon: 'frame-sakura',
    owned: true,
    quantity: 1,
    equipped: true,
    active: false,
    atMax: false,
    affordable: true,
    remainingCoins: 0,
    disabledReason: 'ALREADY_OWNED',
    canBuy: false,
  },
];

const STORE = {
  items: ITEMS,
  coins: 150,
  weeklyXP: 40,
  equippedTitle: null,
  equippedFrame: 'frame-sakura',
  xpBoostExpiresAt: null,
  streakFreezes: 0,
};

function mockApi() {
  api.mockReset();
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/store/items') return STORE;
    if (path === '/gamification/store/purchase' && options.method === 'POST') {
      return {
        item: { ...ITEMS[0], owned: true, quantity: 1 },
        coins: 100,
        streakFreezes: 1,
        xpBoostExpiresAt: null,
        inventory: { itemId: 'streak-freeze', quantity: 1, type: 'freeze' },
      };
    }
    if (path === '/gamification/store/equip' && options.method === 'POST') {
      return { equippedTitle: options.body.itemId, equippedFrame: 'frame-sakura' };
    }
    throw new Error(`unexpected api path: ${path}`);
  });
}

function renderStore() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Store />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockApi();
  useAuth.setState({
    status: 'authed',
    user: { id: 'u1', displayName: 'Rina Kobayashi' },
    gamification: {
      totalXP: 1240,
      currentStreak: 12,
      coins: 150,
      currentLevel: 2,
      streakFreezes: 0,
      equippedTitle: null,
      equippedFrame: 'frame-sakura',
    },
  });
});

describe('Store (§7.10)', () => {
  it('renders the catalogue with live coin balance and ownership states', async () => {
    renderStore();

    expect(await screen.findByRole('heading', { name: 'Store' })).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('Streak freeze')).toBeTruthy();
    expect(screen.getByText('0 of 2 held')).toBeTruthy();
    expect(screen.getByText('Owned')).toBeTruthy();
    expect(screen.getAllByText('Equipped').length).toBeGreaterThanOrEqual(2);

    const sakura = screen.getByText('Sakura').closest('article');
    expect(within(sakura).getByText('桜')).toBeTruthy();
    expect(within(sakura).getByRole('button', { name: /Equipped/ })).toBeTruthy();
  });

  it('confirms a purchase, deducts coins, and toasts the result', async () => {
    const user = userEvent.setup();
    renderStore();

    await screen.findByRole('heading', { name: 'Store' });
    await user.click(screen.getByRole('button', { name: 'Buy Streak freeze for 50 coins' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Confirm purchase' })).toBeTruthy();
    expect(within(dialog).getByText(/100 coins left/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm purchase' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/gamification/store/purchase', {
        method: 'POST',
        body: { itemId: 'streak-freeze' },
      })
    );
    expect(await screen.findByText('Purchased Streak freeze.')).toBeTruthy();
    expect(useAuth.getState().gamification.coins).toBe(100);
    expect(useAuth.getState().gamification.streakFreezes).toBe(1);
  });

  it('equips an owned title from the catalogue', async () => {
    const user = userEvent.setup();
    renderStore();

    await screen.findByRole('heading', { name: 'Store' });
    const card = screen.getByText('The Diligent').closest('article');
    await user.click(within(card).getByRole('button', { name: 'Equip' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/gamification/store/equip', {
        method: 'POST',
        body: { slot: 'title', itemId: 'title-diligent' },
      })
    );
    expect(useAuth.getState().gamification.equippedTitle).toBe('title-diligent');
    expect(await screen.findByText('Cosmetic updated.')).toBeTruthy();
  });
});
