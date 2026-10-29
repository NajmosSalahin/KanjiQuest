import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { weekDateKeys, formatClock } from '../lib/gamification.js';
import Dashboard from './Dashboard.jsx';

/** Navigation probes so empty-state/due CTAs can assert their destinations. */
function LearnProbe() {
  const location = useLocation();
  return <div>learn page {location.search}</div>;
}
function ReviewProbe() {
  return <div>review page</div>;
}

const REPAIR_RESULT = {
  repaired: true,
  currentStreak: 12,
  longestStreak: 14,
  coins: 50,
  totalXP: 440,
  level: 3,
  xpToNextLevel: 350,
  newlyUnlocked: [
    { id: 'kokoro', name: 'Kokoro', nameJa: '\u5fc3', rewardXP: 100, rewardCoins: 20 },
  ],
};

function makeProfile(overrides = {}) {
  const days = weekDateKeys();
  return {
    totalXP: 420,
    level: 3,
    currentLevel: 3,
    xpToNextLevel: 350,
    currentStreak: 0,
    longestStreak: 4,
    coins: 40,
    dailyGoalXP: 50,
    dailyXPProgress: 10,
    title: 'Leaf',
    week: days.map((date, i) => ({ date, reviews: i === 5 ? 3 : 0 })),
    nextMilestone: null,
    streakFreezes: 0,
    goalStreak: 0,
    achievements: { unlocked: 1, total: 41 },
    repair: {
      available: false,
      cost: 100,
      brokenDay: null,
      streakLost: 0,
      canAfford: false,
      monthUsed: false,
    },
    xpBoostActive: false,
    ...overrides,
  };
}

const DUE_POSITIVE = { items: [{ id: 'c1' }], total: 3, limit: 1, nextDueAt: null };
const DUE_EMPTY = {
  items: [],
  total: 0,
  limit: 1,
  nextDueAt: new Date('2026-03-12T14:30:00Z').toISOString(),
};

function mockApi({ profile = makeProfile(), due = DUE_POSITIVE, stats = { total: 40 } } = {}) {
  api.mockReset();
  api.mockImplementation(async (path, opts = {}) => {
    if (path === '/gamification/profile') return profile;
    if (path.startsWith('/progress/due')) return due;
    if (path === '/progress/stats') return stats;
    if (path === '/gamification/streak/repair' && opts.method === 'POST') return REPAIR_RESULT;
    throw new Error(`unexpected api path: ${path}`);
  });
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/learn" element={<LearnProbe />} />
            <Route path="/review" element={<ReviewProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockApi();
});

describe('Dashboard (§7.1)', () => {
  it('shows the exact empty-garden copy and deep-links to N5 kanji', async () => {
    mockApi({ stats: { total: 0 } });
    renderDashboard();

    expect(await screen.findByText('Your garden is empty')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Browse N5 kanji' }));
    expect(await screen.findByText('learn page ?jlpt=5')).toBeTruthy();
  });

  it('renders the header row, streak card, dot grid, goal, and due card', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    // Fresh streak: outlined leaf + invitation copy, no milestone bar.
    expect(screen.getByText('Start a streak today')).toBeTruthy();
    expect(screen.queryByText(/days to /)).toBeNull();

    // 7-dot grid, M T W T F S S labels; exactly one filled (fixture day 6).
    const grid = screen.getByLabelText('Reviews this week');
    expect(grid.querySelectorAll('span.rounded-full')).toHaveLength(7);
    expect(grid.querySelectorAll('span.bg-matcha')).toHaveLength(1);
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();

    // Daily goal ring copy.
    expect(screen.getByText('Daily goal')).toBeTruthy();
    expect(screen.getByText('10 / 50 XP')).toBeTruthy();
    expect(screen.queryByText('Goal met')).toBeNull();

    // Due card.
    expect(screen.getByText('due now')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows the milestone bar label once the streak reaches 7 (spec: "10 days to Sakura")', async () => {
    mockApi({
      profile: makeProfile({
        currentStreak: 20,
        lastActivityDate: '2026-03-12',
        nextMilestone: { days: 30, name: 'Sakura', remaining: 10 },
      }),
    });
    renderDashboard();

    expect(await screen.findByText('day streak')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('10 days to Sakura')).toBeTruthy();
  });

  it('turns the goal card matcha with "Goal met" when the goal is reached', async () => {
    mockApi({ profile: makeProfile({ dailyXPProgress: 50 }) });
    const { container } = renderDashboard();

    expect(await screen.findByText('50 / 50 XP')).toBeTruthy();
    expect(screen.getByText('Goal met')).toBeTruthy();
    const card = container.querySelector('[aria-label="Daily goal"]');
    expect(card.className).toContain('border-matcha');
  });

  it('navigates to the review session from the due card', async () => {
    renderDashboard();
    await screen.findByText('due now');
    await userEvent.click(screen.getByRole('button', { name: /Start review/ }));
    expect(await screen.findByText('review page')).toBeTruthy();
  });

  it('renders the caught-up line with the next review time (§7.1)', async () => {
    mockApi({ due: DUE_EMPTY });
    renderDashboard();

    const clock = formatClock(DUE_EMPTY.nextDueAt);
    expect(await screen.findByText(`All caught up — next review at ${clock}`)).toBeTruthy();
  });

  it('shows the §11.4 repair banner, repairs for 100 coins, and dismisses', async () => {
    mockApi({
      profile: makeProfile({
        currentStreak: 0,
        repair: {
          available: true,
          cost: 100,
          brokenDay: '2026-03-11',
          streakLost: 12,
          canAfford: true,
          monthUsed: false,
        },
      }),
    });
    renderDashboard();

    expect(
      await screen.findByText('Your 12-day streak ended yesterday. Repair for 100 coins?')
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Repair/ }));
    // Repair POST fires; success toasts the result + any achievement unlock.
    await waitFor(() =>
      expect(
        api.mock.calls.some(
          ([path, opts]) => path === '/gamification/streak/repair' && opts?.method === 'POST'
        )
      ).toBe(true)
    );
    expect(await screen.findByText(/Streak repaired — back to 12 days\./)).toBeTruthy();
    expect(screen.getByText(/Achievement unlocked: Kokoro/)).toBeTruthy();

    // Dismiss X hides the banner (scoped — toasts also carry close buttons).
    const copy = screen.getByText('Your 12-day streak ended yesterday. Repair for 100 coins?');
    const banner = copy.closest('.rounded-card');
    await userEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
    expect(
      screen.queryByText('Your 12-day streak ended yesterday. Repair for 100 coins?')
    ).toBeNull();
  });

  it('disables repair when the gardener cannot afford it', async () => {
    mockApi({
      profile: makeProfile({
        repair: {
          available: true,
          cost: 100,
          brokenDay: '2026-03-11',
          streakLost: 12,
          canAfford: false,
          monthUsed: false,
        },
      }),
    });
    renderDashboard();

    const button = await screen.findByRole('button', { name: /Need 100 coins/ });
    expect(button.disabled).toBe(true);
  });
});
