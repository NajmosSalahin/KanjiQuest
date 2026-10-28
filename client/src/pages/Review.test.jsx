import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import Review from './Review.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { useAuth } from '../stores/auth.js';

/** Review session — prompt.md §7.2. */

const CARD = (overrides = {}) => ({
  id: '656f000000000000000000a1',
  character: '水',
  unicode: '6c34',
  meanings: ['water', 'liquid'],
  readingsOn: ['スイ'],
  readingsKun: ['みず'],
  mnemonic: 'A river through three streams.',
  hasStrokeOrder: true,
  strokeCount: 4,
  exampleWords: [
    { word: '水曜日', reading: 'すいようび', meaning: 'Wednesday', jlptLevel: null, common: true },
  ],
  state: 'new',
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
  lapses: 0,
  dueDate: new Date().toISOString(),
  ...overrides,
});

const SECOND = CARD({
  id: '656f000000000000000000a2',
  character: '火',
  unicode: '706b',
  meanings: ['fire'],
  readingsOn: ['カ'],
  readingsKun: ['ひ'],
  exampleWords: [],
  mnemonic: null,
});

function xpResult(overrides = {}) {
  return {
    awarded: 30,
    bonuses: ['firstReview'],
    totalXP: 30,
    dailyXPProgress: 30,
    dailyGoalXP: 100,
    currentStreak: 1,
    level: 1,
    xpToNextLevel: 100,
    ...overrides,
  };
}

/** Route the four review endpoints; anything else throws loudly. */
function mockApi({ due, review, undo }) {
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/progress/due') return due;
    if (path === '/progress/review')
      return review?.(options.body) ?? { progress: {}, xp: xpResult() };
    if (/^\/review\/[^/]+\/undo$/.test(path)) {
      return (
        undo ?? { progress: {}, xp: { refunded: 30, totalXP: 0, dailyXPProgress: 0, level: 1 } }
      );
    }
    if (/^\/review\/[^/]+\/suspend$/.test(path)) {
      return { progress: {} };
    }
    throw new Error(`unexpected api call: ${path}`);
  });
}

function renderReview() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/review']}>
        <Review />
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  api.mockReset();
  useAuth.setState({
    status: 'authed',
    user: { preferences: { furigana: true } },
    gamification: null,
  });
});

describe('Review session (§7.2) — card flow', () => {
  it('shows the front, then the full back content on reveal', async () => {
    const user = userEvent.setup();
    mockApi({ due: { items: [CARD()], total: 1, limit: 20, nextDueAt: null } });
    renderReview();

    // Front: kanji + counter + show answer (§7.2)
    expect(await screen.findByTestId('review-kanji')).toBeDefined();
    expect(screen.getByText('Card 1 of 1')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show answer' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Show answer' }));

    // Back: meanings joined, readings with labels + audio, example word, mnemonic
    expect(screen.getByText('water · liquid')).toBeDefined();
    expect(screen.getByText('On')).toBeDefined();
    expect(screen.getByText('Kun')).toBeDefined();
    expect(screen.getByLabelText('Play reading スイ')).toBeDefined();
    expect(screen.getByText('水曜日')).toBeDefined();
    expect(screen.getByText('Wednesday')).toBeDefined();
    expect(screen.getByText(/Remember:/)).toBeDefined();

    // Rating buttons with 1–4 shortcuts below the labels
    for (const name of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeDefined();
    }
  });

  it('rates via click, posts to the server, shows the 4s undo banner, advances', async () => {
    const user = userEvent.setup();
    mockApi({
      due: { items: [CARD(), SECOND], total: 2, limit: 20, nextDueAt: null },
      review: (body) => ({ progress: { id: body.cardId }, xp: xpResult() }),
    });
    renderReview();
    await screen.findByTestId('review-kanji');

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Good/ }));

    // Server call (220ms fill, then advance)
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/progress/review', {
        method: 'POST',
        body: { cardId: CARD().id, rating: 2 },
      })
    );
    expect(await screen.findByText('Card 2 of 2')).toBeDefined();

    // Undo banner bottom-left with the previous rating (§7.2)
    expect(screen.getByText(/Rated/)).toBeDefined();
    expect(screen.getByText('Good')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDefined();

    // XP merged into the nav store
    expect(useAuth.getState().gamification.totalXP).toBe(30);
    expect(useAuth.getState().gamification.currentStreak).toBe(1);
  });

  it('undo restores the pre-rating state and refunds via the server', async () => {
    const user = userEvent.setup();
    mockApi({
      due: { items: [CARD()], total: 1, limit: 20, nextDueAt: null },
      review: () => ({ progress: {}, xp: xpResult() }),
      undo: { progress: {}, xp: { refunded: 30, totalXP: 0, dailyXPProgress: 0, level: 1 } },
    });
    renderReview();
    await screen.findByTestId('review-kanji');

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    await screen.findByRole('button', { name: 'Undo' });

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(`/review/${CARD().id}/undo`, { method: 'POST' })
    );
    // Back to the front of the same card, unrevealed, XP refunded
    expect(await screen.findByRole('button', { name: 'Show answer' })).toBeDefined();
    expect(useAuth.getState().gamification.totalXP).toBe(0);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('keyboard: Space reveals, 1–4 rate, S skips to the back of the queue', async () => {
    const user = userEvent.setup();
    mockApi({
      due: { items: [CARD(), SECOND], total: 2, limit: 20, nextDueAt: null },
      review: () => ({ progress: {}, xp: xpResult() }),
    });
    renderReview();
    await screen.findByTestId('review-kanji');

    await user.keyboard(' '); // Space reveals
    await waitFor(() => expect(screen.getByRole('button', { name: /^Good/ })).toBeDefined());

    // S skips: same position, next card rotates in (client-side only)
    await user.keyboard('s');
    expect(await screen.findByText('Card 1 of 2')).toBeDefined();
    expect(screen.getByTestId('review-kanji').textContent).toContain('火'); // ruby includes reading

    // Reveal the rotated-in card, then 1 rates it (Again)
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Again/ })).toBeDefined());
    await user.keyboard('1');
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/progress/review', {
        method: 'POST',
        body: { cardId: SECOND.id, rating: 0 },
      })
    );
    // 1 rated + 水 still pending -> "Card 2 of 2", 水 back on top
    expect(await screen.findByText('Card 2 of 2')).toBeDefined();
    expect(screen.getByTestId('review-kanji').textContent).toContain('水');
  });

  it('X suspends the current card for 7 days', async () => {
    const user = userEvent.setup();
    mockApi({ due: { items: [CARD(), SECOND], total: 2, limit: 20, nextDueAt: null } });
    renderReview();
    await screen.findByTestId('review-kanji');

    await user.keyboard('x');

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(`/review/${CARD().id}/suspend`, { method: 'POST' })
    );
    expect(await screen.findByText('Buried for 7 days.')).toBeDefined();
    expect(screen.getByText('Card 1 of 1')).toBeDefined();
    expect(screen.getByTestId('review-kanji').textContent).toContain('火'); // 水 gone, 火 remains
  });

  it('reaching the last rating shows the session summary (§7.2)', async () => {
    const user = userEvent.setup();
    let call = 0;
    mockApi({
      due: { items: [CARD(), SECOND], total: 2, limit: 20, nextDueAt: null },
      review: () => {
        call += 1;
        return call === 1
          ? { progress: {}, xp: xpResult({ awarded: 30 }) }
          : { progress: {}, xp: xpResult({ awarded: 15, bonuses: [], totalXP: 45 }) };
      },
    });
    renderReview();
    await screen.findByTestId('review-kanji');

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Good/ }));
    await screen.findByText('Card 2 of 2');

    await user.click(screen.getByRole('button', { name: 'Show answer' }));
    await user.click(screen.getByRole('button', { name: /^Easy/ }));

    expect(await screen.findByRole('heading', { name: '2 reviews' })).toBeDefined();
    expect(screen.getByText('completed')).toBeDefined();
    expect(screen.getByText(/Accuracy 100%/)).toBeDefined();
    expect(screen.getByText(/\+45 XP/)).toBeDefined();
    expect(screen.getByText(/Streak 1 days/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Review again' })).toBeDefined();
  });
});

describe('Review session (§7.2) — empty & error states', () => {
  it('empty: "Nothing due" with the scheduled next review time', async () => {
    const next = new Date(Date.now() + 3600_000).toISOString();
    mockApi({ due: { items: [], total: 0, limit: 20, nextDueAt: next } });
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Nothing due' })).toBeDefined();
    expect(screen.getByText(/Next review is scheduled for \d{2}:\d{2}/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Browse kanji' })).toBeDefined();
  });

  it('empty without a next due falls back to the add-more copy', async () => {
    mockApi({ due: { items: [], total: 0, limit: 20, nextDueAt: null } });
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Nothing due' })).toBeDefined();
    expect(screen.getByText(/Browse kanji to add more/)).toBeDefined();
  });

  it('errors render the message with a retry', async () => {
    api.mockRejectedValue(new Error('Network down.'));
    renderReview();

    expect(
      await screen.findByRole('heading', { name: "Couldn't load your reviews" })
    ).toBeDefined();
    expect(screen.getByText('Network down.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });
});
