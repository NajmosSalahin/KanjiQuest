import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import KanjiDetail from './KanjiDetail.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';

/** Bare kanji — hasStrokeOrder:false, no words/sentences/radicals (§7.4
 *  missing-data states). */
const BARE = {
  kanji: {
    character: '龍',
    unicode: '9f8d',
    meanings: ['dragon'],
    readingsOn: ['リョウ'],
    readingsKun: ['たつ'],
    nameReadings: [],
    jlptLevel: null,
    grade: null,
    strokeCount: 16,
    radical: '龍',
    radicals: [],
    components: [],
    hasStrokeOrder: false,
    frequencyRank: null,
    isJoyo: false,
    isJinmeiyo: true,
    exampleWords: [],
    exampleSentences: [],
    mnemonic: null,
  },
  strokes: [],
  radicals: [],
  components: [],
  related: [],
};

/** Fully populated kanji (日) — words, sentence tokens, mnemonic, cards. */
const FULL = {
  kanji: {
    ...BARE.kanji,
    character: '日',
    unicode: '65e5',
    meanings: ['day', 'sun'],
    readingsOn: ['ニチ', 'ジツ'],
    readingsKun: ['ひ'],
    jlptLevel: 4,
    grade: 1,
    strokeCount: 4,
    radical: '日',
    radicals: ['日'],
    components: ['日'],
    hasStrokeOrder: true,
    frequencyRank: 13,
    isJoyo: true,
    isJinmeiyo: false,
    exampleWords: [
      { word: '日本', reading: 'にほん', meaning: 'Japan', jlptLevel: null, common: true },
    ],
    exampleSentences: [
      {
        japanese: '今日は晴れです。',
        english: 'It is sunny today.',
        audioUrl: null,
        tokens: [{ text: '今日は晴れです。' }],
      },
    ],
    mnemonic: 'Sun above the horizon — the day begins.',
  },
  strokes: [
    { n: 1, d: 'M19.5,29.5c9,7.5,22.5,27,26,39.5', x: '13.5', y: '24.5' },
    { n: 2, d: 'M33.5,17c0,14,1,30,1,46.5', x: '28.5', y: '12.5' },
  ],
  radicals: [
    {
      character: '日',
      meaning: 'sun',
      mnemonic: 'The sun in a window — day after day.',
      strokeCount: 4,
      variants: [],
    },
  ],
  components: [],
  related: [
    { character: '明', meanings: ['bright'], strokeCount: 8, hasStrokeOrder: true },
    { character: '時', meanings: ['time'], strokeCount: 10, hasStrokeOrder: false },
  ],
};

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/kanji/x']}>
          <KanjiDetail />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.mockReset();
});

describe('Kanji detail (§7.4) — missing data states', () => {
  beforeEach(() => {
    api.mockResolvedValue(BARE);
  });

  it('uses the exact spec copy for missing stroke order, words, sentences', async () => {
    renderDetail();

    expect(await screen.findByTestId('big-kanji')).toBeDefined();
    expect(screen.getByText('16 strokes')).toBeDefined();
    expect(screen.getByText('Radical: 龍')).toBeDefined();

    expect(screen.getByRole('heading', { name: 'Stroke order' })).toBeDefined();
    expect(screen.getByText("Stroke-order data isn't available for this kanji.")).toBeDefined();

    expect(screen.getByRole('heading', { name: 'Words' })).toBeDefined();
    expect(screen.getByText('No example words for this kanji.')).toBeDefined();

    expect(screen.getByRole('heading', { name: 'In context' })).toBeDefined();
    expect(screen.getByText('No example sentence available.')).toBeDefined();
  });

  it('shows chrome: back link, speed toggle, stroke controls, Add to review', async () => {
    renderDetail();
    await screen.findByTestId('big-kanji');

    expect(screen.getByRole('link', { name: '← Back to Learn' })).toBeDefined();
    expect(screen.getByText('1× / 0.5×')).toBeDefined();
    expect(screen.getByLabelText('Play stroke animation')).toBeDefined();
    expect(screen.getByLabelText('Pause stroke animation')).toBeDefined();
    expect(screen.getByLabelText('Reset stroke animation')).toBeDefined();
    expect(screen.getByLabelText('Toggle animation speed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add to review' })).toBeDefined();
  });

  it('omits empty sections (no Remember it, no radical/related cards)', async () => {
    renderDetail();
    await screen.findByTestId('big-kanji');

    expect(screen.queryByRole('heading', { name: 'Remember it' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Radicals' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Related kanji' })).toBeNull();
    expect(screen.queryByText(/available for this kanji/)).not.toBeNull();
  });

  it('404s render the API message with a way back', async () => {
    api.mockRejectedValue(new Error('That kanji was not found.'));
    renderDetail();

    expect(await screen.findByText('That kanji was not found.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to Learn' })).toBeDefined();
  });
});

describe('Kanji detail (§7.4) — populated kanji', () => {
  beforeEach(() => {
    api.mockResolvedValue(FULL);
  });

  it('renders words, sentence, mnemonic, radicals, and related kanji', async () => {
    renderDetail();
    expect(await screen.findByText('日本')).toBeDefined();

    // Words card: word, reading, meaning
    expect(screen.getByText('にほん')).toBeDefined();
    expect(screen.getByText('Japan')).toBeDefined();

    // In context: sentence + translation
    expect(screen.getByText('今日は晴れです。')).toBeDefined();
    expect(screen.getByText('It is sunny today.')).toBeDefined();

    // Mnemonic block (kanji's own mnemonic, distinct from the radical card's)
    expect(screen.getByRole('heading', { name: 'Remember it' })).toBeDefined();
    expect(screen.getByText('Sun above the horizon — the day begins.')).toBeDefined();
    expect(screen.getByText('The sun in a window — day after day.')).toBeDefined(); // radical card copy

    // Side cards
    expect(screen.getByRole('heading', { name: 'Radicals' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Related kanji' })).toBeDefined();
    expect(screen.getByRole('link', { name: /明/ })).toBeDefined();

    // Readings with per-reading audio
    expect(screen.getByText('On-yomi')).toBeDefined();
    expect(screen.getByText('Kun-yomi')).toBeDefined();
    expect(screen.getByLabelText('Play reading ニチ')).toBeDefined();
    expect(screen.getByLabelText('Play reading ひ')).toBeDefined();
    expect(screen.getByLabelText('Play sentence audio')).toBeDefined();

    // Stroke paths rendered from server-extracted data
    expect(
      screen.getByRole('img', { name: /Stroke order animation for 日, 2 strokes/ })
    ).toBeDefined();
  });

  it('audio buttons no-op safely where speech synthesis is unavailable', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('日本');
    await user.click(screen.getByLabelText('Play reading ニチ'));
    await user.click(screen.getByLabelText('Play sentence audio'));
    expect(screen.getByText('日本')).toBeDefined(); // page still intact
  });
});
