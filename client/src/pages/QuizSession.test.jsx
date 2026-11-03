import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import QuizSession from './QuizSession.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { useAuth } from '../stores/auth.js';

/** Quiz sessions — prompt.md §7.6. */

const MEANING_Q1 = {
  id: 'q1',
  mode: 'meaning',
  question: 'What does this mean?',
  character: '水',
  strokeCount: 4,
  options: [
    { id: 'q1-o1', text: 'water', readingType: null },
    { id: 'q1-o2', text: 'fire', readingType: null },
    { id: 'q1-o3', text: 'moon', readingType: null },
    { id: 'q1-o4', text: 'tree', readingType: null },
  ],
};

const MEANING_Q2 = {
  id: 'q2',
  mode: 'meaning',
  question: 'What does this mean?',
  character: '火',
  strokeCount: 4,
  options: [
    { id: 'q2-o1', text: 'water', readingType: null },
    { id: 'q2-o2', text: 'fire', readingType: null },
    { id: 'q2-o3', text: 'moon', readingType: null },
    { id: 'q2-o4', text: 'tree', readingType: null },
  ],
};

const STROKE_Q1 = {
  id: 'q1',
  mode: 'stroke',
  question: 'Tap the strokes in the correct order.',
  strokeCount: 2,
  strokes: [
    { id: 's1', d: 'M10 20 L90 20' },
    { id: 's2', d: 'M50 30 L50 90' },
  ],
};

function session(mode = 'meaning', overrides = {}) {
  return {
    id: 'sess-1',
    mode,
    status: 'active',
    totalQuestions: mode === 'sprint' ? null : 2,
    answeredCount: 0,
    correctCount: 0,
    remainingMs: mode === 'sprint' ? 60_000 : null,
    bestStreak: 0,
    ...overrides,
  };
}

function startPayload(mode = 'meaning') {
  const questions = mode === 'stroke' ? [STROKE_Q1] : [MEANING_Q1, MEANING_Q2];
  return {
    session: session(mode),
    question: questions[0],
    ...(mode === 'sprint' ? {} : { questions }),
    pool: { trackedCount: 2, fallback: true },
  };
}

const SUMMARY = {
  session: session('meaning', {
    status: 'completed',
    answeredCount: 2,
    correctCount: 2,
  }),
  mode: 'meaning',
  answeredCount: 2,
  correctCount: 2,
  accuracy: 100,
  xpEarned: 120,
  xp: {
    totalXP: 120,
    level: 1,
    xpToNextLevel: 100,
    coins: 0,
    currentStreak: 0,
    bonuses: ['goalMet'],
    leveledUp: false,
    newlyUnlocked: [],
  },
  bestStreak: 0,
  results: [],
  questCompletions: [],
};

function renderQuiz(mode = 'meaning') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/quiz/play/${mode}`]}>
          <Routes>
            <Route path="/quiz" element={<div>Quiz hub</div>} />
            <Route path="/quiz/play/:mode" element={<QuizSession />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
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

describe('Quiz session (§7.6) — meaning', () => {
  it('answers in order, advances on Space, and submits once', async () => {
    const user = userEvent.setup();
    const bodies = [];
    api.mockImplementation(async (path, options = {}) => {
      if (path === '/quiz/start') return startPayload('meaning');
      if (path === '/quiz/sess-1/answer') {
        bodies.push(options.body);
        const second = bodies.length === 2;
        return {
          session: session('meaning', {
            answeredCount: bodies.length,
            correctCount: bodies.length,
          }),
          result: {
            questionId: second ? 'q2' : 'q1',
            correct: true,
            rating: null,
            score: null,
            responseTimeMs: 120,
            wrongTaps: 0,
          },
          nextQuestion: second ? null : MEANING_Q2,
          correct: true,
          correctOptionId: second ? 'q2-o2' : 'q1-o1',
        };
      }
      if (path === '/quiz/sess-1/submit') return SUMMARY;
      throw new Error(`unexpected api call: ${path}`);
    });

    renderQuiz('meaning');

    expect((await screen.findByTestId('quiz-kanji')).textContent).toBe('水');
    expect(screen.getByText('What does this mean?')).toBeDefined();
    expect(screen.getByText('Question 1 of 2')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /water/ }));
    expect(await screen.findByText('Correct')).toBeDefined();
    expect(screen.getByRole('button', { name: /water/ }).disabled).toBe(true);

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    await waitFor(() => {
      expect(screen.getByTestId('quiz-kanji').textContent).toBe('火');
    });

    await user.click(screen.getByRole('button', { name: /fire/ }));
    expect(await screen.findByText('Correct')).toBeDefined();

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(await screen.findByTestId('quiz-summary')).toBeDefined();
    expect(screen.getByText('2 of 2 correct')).toBeDefined();
    expect(screen.getByText(/Accuracy 100%/)).toBeDefined();
    expect(screen.getByText(/\+120 XP/)).toBeDefined();
    expect(screen.getByText('Daily goal met')).toBeDefined();

    expect(bodies).toEqual([{ optionId: 'q1-o1' }, { optionId: 'q2-o2' }]);
  });
});

describe('Quiz session (§7.6) — stroke order', () => {
  it('posts each tap and completes only after the server says so', async () => {
    const user = userEvent.setup();
    const bodies = [];
    api.mockImplementation(async (path, options = {}) => {
      if (path === '/quiz/start') return startPayload('stroke');
      if (path === '/quiz/sess-1/answer') {
        bodies.push(options.body);
        const second = bodies.length === 2;
        return {
          session: session('stroke', {
            answeredCount: second ? 1 : 0,
            correctCount: second ? 1 : 0,
          }),
          result: second
            ? {
                questionId: 'q1',
                correct: true,
                rating: null,
                score: null,
                responseTimeMs: 500,
                wrongTaps: 0,
              }
            : null,
          nextQuestion: second ? null : STROKE_Q1,
          tapCorrect: true,
          complete: second,
          correct: second,
          progress: bodies.length,
          total: 2,
          correctOrder: second ? ['s1', 's2'] : null,
        };
      }
      if (path === '/quiz/sess-1/submit') return { ...SUMMARY, mode: 'stroke' };
      throw new Error(`unexpected api call: ${path}`);
    });

    renderQuiz('stroke');

    expect(await screen.findByTestId('quiz-stroke')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Stroke 1' }));
    expect(screen.getByText('1 of 2 strokes · tap in order')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stroke 2' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Stroke 2' }));
    expect(await screen.findByText('Correct')).toBeDefined();

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(await screen.findByTestId('quiz-summary')).toBeDefined();
    expect(bodies).toEqual([{ strokeId: 's1' }, { strokeId: 's2' }]);
  });
});

describe('Quiz session (§7.6) — sprint clock', () => {
  it('adopts the server remaining time after a correct answer', async () => {
    const user = userEvent.setup();
    api.mockImplementation(async (path) => {
      if (path === '/quiz/start') return startPayload('sprint');
      if (path === '/quiz/sess-1/answer') {
        return {
          session: session('sprint', {
            answeredCount: 1,
            correctCount: 1,
            remainingMs: 63_000,
            bestStreak: 1,
          }),
          result: {
            questionId: 'q1',
            correct: true,
            rating: null,
            score: null,
            responseTimeMs: 400,
            wrongTaps: 0,
          },
          nextQuestion: MEANING_Q2,
          correct: true,
          correctOptionId: 'q1-o1',
          complete: true,
          timeDeltaMs: 3000,
          ended: false,
        };
      }
      throw new Error(`unexpected api call: ${path}`);
    });

    renderQuiz('sprint');

    expect(await screen.findByText('60s')).toBeDefined();
    await user.click(screen.getByRole('button', { name: /water/ }));
    expect(await screen.findByText('63s')).toBeDefined();
  });
});

describe('Quiz session (§7.6) — leave guard', () => {
  it('confirms before leaving an active session', async () => {
    const user = userEvent.setup();
    api.mockImplementation(async (path) => {
      if (path === '/quiz/start') return startPayload('meaning');
      throw new Error(`unexpected api call: ${path}`);
    });

    renderQuiz('meaning');
    expect(await screen.findByTestId('quiz-choice')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Leave this quiz?')).toBeDefined();
    expect(screen.getByText("Your progress in this session won't be saved.")).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Stay' }));
    await waitFor(() => {
      expect(screen.queryByText('Leave this quiz?')).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Leave quiz' }));
    expect(await screen.findByText('Quiz hub')).toBeDefined();
  });
});
