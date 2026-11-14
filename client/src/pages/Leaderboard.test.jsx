import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import { useAuth } from '../stores/auth.js';
import { ToastProvider } from '../components/ui/Toast.jsx';
import Leaderboard from './Leaderboard.jsx';

const ME = {
  rank: 2,
  userId: 'u1',
  displayName: 'Rina Kobayashi',
  avatarUrl: null,
  title: 'The Diligent',
  equippedTitle: 'title-diligent',
  equippedFrame: 'frame-sakura',
  xp: 120,
  isYou: true,
};

const WEEKLY = {
  period: 'weekly',
  weekStart: '2026-03-09',
  entries: [
    {
      rank: 1,
      userId: 'u2',
      displayName: 'Aiko Tanaka',
      avatarUrl: null,
      title: 'Yama no Ue',
      equippedTitle: 'title-yama',
      equippedFrame: null,
      xp: 320,
      isYou: false,
    },
    ME,
    {
      rank: 3,
      userId: 'u3',
      displayName: 'Kenji Sato',
      avatarUrl: null,
      title: null,
      equippedTitle: null,
      equippedFrame: 'frame-take',
      xp: 90,
      isYou: false,
    },
  ],
  me: ME,
};

const ALL_TIME = {
  period: 'allTime',
  weekStart: null,
  entries: [
    { ...WEEKLY.entries[0], rank: 1, xp: 5400 },
    { ...ME, rank: 2, xp: 1240 },
  ],
  me: { ...ME, rank: 2, xp: 1240 },
};

function mockApi() {
  api.mockReset();
  api.mockImplementation(async (path) => {
    if (path === '/leaderboard?period=weekly') return WEEKLY;
    if (path === '/leaderboard?period=allTime') return ALL_TIME;
    throw new Error(`unexpected api path: ${path}`);
  });
}

function renderLeaderboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Leaderboard />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockApi();
  useAuth.setState({
    status: 'authed',
    user: { id: 'u1', displayName: 'Rina Kobayashi' },
    gamification: { weeklyXP: 120, totalXP: 1240, currentLevel: 2 },
  });
});

describe('Leaderboard (§7.9)', () => {
  it('renders weekly ranks, titles, XP, and a visible current-user row', async () => {
    renderLeaderboard();

    expect(await screen.findByRole('heading', { name: 'Leaderboard' })).toBeTruthy();
    expect(await screen.findByText('Aiko Tanaka')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
    expect(screen.getByText('Yama no Ue')).toBeTruthy();
    expect(screen.getByText('120 XP this week')).toBeTruthy();

    // Current user appears in the table and in the sticky footer row.
    expect(screen.getAllByText('Rina Kobayashi')).toHaveLength(2);
    expect(screen.getAllByText('You').length).toBeGreaterThanOrEqual(2);
  });

  it('switches to the all-time board', async () => {
    const user = userEvent.setup();
    renderLeaderboard();

    await screen.findByText('Aiko Tanaka');
    await user.click(screen.getByRole('tab', { name: 'All-time' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/leaderboard?period=allTime'));
    expect(await screen.findByText('5,400')).toBeTruthy();
    expect(screen.getByText('All-time XP since the garden opened')).toBeTruthy();
  });

  it('shows a specific empty state when nobody has earned weekly XP', async () => {
    api.mockImplementation(async () => ({
      period: 'weekly',
      weekStart: '2026-03-09',
      entries: [],
      me: { ...ME, rank: null, xp: 0 },
    }));
    renderLeaderboard();

    expect(await screen.findByText('No one has earned XP this week yet')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Rina Kobayashi')).toBeTruthy();
  });
});
