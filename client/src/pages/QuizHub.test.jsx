import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import QuizHub from './QuizHub.jsx';

/** Quiz hub — prompt.md §7.5. */

function overview(overrides = {}) {
  return {
    trackedCount: 2,
    fallback: true,
    label: 'practice set',
    modes: {
      meaning: { available: 10, fallback: true },
      reading: { available: 10, fallback: true },
      stroke: { available: 10, fallback: true },
      drawing: { available: 10, fallback: true },
      sprint: { available: 2, fallback: true },
    },
    ...overrides,
  };
}

function PlayRoute() {
  const { mode } = useParams();
  return <div>Play {mode}</div>;
}

function renderHub() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/quiz']}>
        <Routes>
          <Route path="/quiz" element={<QuizHub />} />
          <Route path="/quiz/play/:mode" element={<PlayRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.mockReset();
});

describe('Quiz hub (§7.5)', () => {
  it('renders the five modes with practice-set counts', async () => {
    api.mockResolvedValue(overview());
    renderHub();

    expect(await screen.findByRole('heading', { name: 'Quiz', level: 1 })).toBeDefined();
    expect(screen.getByText('Practice without the pressure of scheduling.')).toBeDefined();

    for (const mode of ['meaning', 'reading', 'stroke', 'drawing', 'sprint']) {
      expect(screen.getByTestId(`quiz-mode-${mode}`)).toBeDefined();
    }
    expect(screen.getAllByText('From your practice set: 10 kanji')).toHaveLength(4);
    expect(screen.getByText('From your practice set: 2 kanji')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(5);
  });

  it('uses the review-queue label and starts the chosen mode', async () => {
    api.mockResolvedValue(overview({ fallback: false, label: 'review queue' }));
    const user = userEvent.setup();
    renderHub();

    expect(await screen.findAllByText('From your review queue: 10 kanji')).toHaveLength(4);

    const meaningCard = screen.getByTestId('quiz-mode-meaning');
    await user.click(within(meaningCard).getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Play meaning')).toBeDefined();
  });
});
