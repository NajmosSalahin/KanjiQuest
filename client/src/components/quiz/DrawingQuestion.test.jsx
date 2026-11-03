import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawingQuestion } from './DrawingQuestion.jsx';

/** Drawing canvas prompt + server-result bands — prompt.md §7.6. */

const QUESTION = {
  id: 'q1',
  mode: 'drawing',
  question: 'Draw the kanji from memory.',
  meaning: 'water',
  readingsOn: ['スイ'],
  readingsKun: ['みず'],
  strokeCount: 2,
};

function setup(overrides = {}) {
  const props = {
    question: QUESTION,
    strokes: [],
    onStrokesChange: vi.fn(),
    clearKey: 0,
    result: null,
    checking: false,
    onCheck: vi.fn(),
    onClear: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DrawingQuestion {...props} />) };
}

describe('DrawingQuestion (§7.6)', () => {
  it('shows meaning + readings and disables Check with an empty canvas', () => {
    const { props } = setup();

    expect(screen.getByText('water')).toBeDefined();
    expect(screen.getByText('スイ')).toBeDefined();
    expect(screen.getByText('みず')).toBeDefined();
    expect(screen.getByTestId('drawing-canvas')).toBeDefined();
    expect(screen.getByRole('button', { name: /Check drawing/ }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Clear' }).disabled).toBe(true);

    expect(props.onCheck).not.toHaveBeenCalled();
  });

  it('renders the close band without an overlay and allows a second check', () => {
    setup({
      strokes: [[{ x: 10, y: 10 }]],
      result: {
        score: 72,
        verdict: 'close',
        complete: false,
        attempts: 1,
        attemptsRemaining: 1,
        overlay: null,
      },
    });

    expect(screen.getByText('72')).toBeDefined();
    expect(screen.getByText('Close — try again')).toBeDefined();
    expect(screen.getByText('1 check left')).toBeDefined();
    expect(screen.queryByTestId('drawing-overlay')).toBeNull();
    expect(screen.getByRole('button', { name: /Check again/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear' }).disabled).toBe(false);
  });

  it('shows the crimson overlay and Continue after the final miss', async () => {
    const user = userEvent.setup();
    setup({
      strokes: [[{ x: 10, y: 10 }]],
      result: {
        score: 41,
        verdict: 'notQuite',
        complete: true,
        attempts: 2,
        attemptsRemaining: 0,
        overlay: [
          { id: 's1', d: 'M10 20 L90 20' },
          { id: 's2', d: 'M50 30 L50 90' },
        ],
      },
    });

    expect(screen.getByText('Not quite — see the strokes')).toBeDefined();
    expect(screen.getByTestId('drawing-overlay')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Check/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
  });
});
