import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));
// jsdom has no layout/ResizeObserver; virtualization isn't under test here.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({ getVirtualItems: () => [], getTotalSize: () => 0 }),
}));

import { api } from '../lib/api.js';
import Learn from './Learn.jsx';

const RADICALS = {
  radicals: [
    {
      character: '水',
      meaning: 'water',
      mnemonic: 'Water flows in three drops.',
      strokeCount: 4,
      variants: ['氵'],
      count: 12,
    },
  ],
};

const EMPTY_PAGE = { items: [], total: 0, page: 1, limit: 50, hasMore: false };

const ONE_PAGE = {
  items: [
    {
      character: '日',
      unicode: '65e5',
      meanings: ['day', 'sun'],
      jlptLevel: 4,
      grade: 1,
      strokeCount: 4,
      radical: '日',
      frequencyRank: 13,
      hasStrokeOrder: true,
      isJoyo: true,
      isJinmeiyo: false,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasMore: false,
};

function renderLearn() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Learn />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockApi({ list = EMPTY_PAGE } = {}) {
  api.mockReset();
  api.mockImplementation(async (path) => {
    if (path.startsWith('/radicals')) return RADICALS;
    if (path.startsWith('/kanji?')) return list;
    throw new Error(`unexpected api path: ${path}`);
  });
}

beforeEach(() => {
  mockApi();
});

describe('Learn browser (§7.3)', () => {
  it('renders the spec structure and exact copy', async () => {
    renderLearn();
    expect(screen.getByRole('heading', { level: 1, name: 'Learn' })).toBeDefined();
    expect(screen.getByPlaceholderText('Search kanji, meaning, or reading')).toBeDefined();
    for (const tab of ['N5', 'N4', 'N3', 'All']) {
      expect(screen.getByRole('tab', { name: tab })).toBeDefined();
    }
    expect(screen.getByLabelText('Sort by')).toBeDefined();
    expect(screen.getByLabelText('Status')).toBeDefined();
    const sort = screen.getByLabelText('Sort by');
    expect([...sort.options].map((o) => o.label)).toEqual(['Frequency', 'Stroke count', 'JLPT']);
    const status = screen.getByLabelText('Status');
    expect([...status.options].map((o) => o.label)).toEqual(['All', 'Learning', 'Mastered']);
    // Radical pills: character + count + accessible title
    expect(await screen.findByTitle('water radical — 12 kanji')).toBeDefined();
  });

  it('shows the exact no-results empty state with Clear filters', async () => {
    renderLearn();
    expect(await screen.findByText('No kanji match those filters')).toBeDefined();
    expect(screen.getByText('Try removing a filter or searching for a meaning.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDefined();
  });

  it('debounces search input to the server after 250ms', async () => {
    const user = userEvent.setup();
    renderLearn();
    await screen.findByTitle('water radical — 12 kanji');

    await user.type(screen.getByPlaceholderText('Search kanji, meaning, or reading'), 'sun');

    await waitFor(
      () => {
        expect(api.mock.calls.some(([path]) => path.includes('q=sun'))).toBe(true);
      },
      { timeout: 2000 }
    );
    // The query hits the server, not a filtered local array.
    expect(api.mock.calls.some(([path]) => path.startsWith('/kanji?'))).toBe(true);
  });

  it('sends jlpt when an N5 tab is selected', async () => {
    const user = userEvent.setup();
    renderLearn();
    await screen.findByTitle('water radical — 12 kanji');

    await user.click(screen.getByRole('tab', { name: 'N5' }));
    await waitFor(() => {
      expect(api.mock.calls.some(([path]) => path.includes('jlpt=5'))).toBe(true);
    });
  });

  it('opens the N5 tab from the dashboard deep link ?jlpt=5 (§7.1)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/learn?jlpt=5']}>
          <Learn />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const n5 = await screen.findByRole('tab', { name: 'N5' });
    expect(n5.getAttribute('aria-selected')).toBe('true');
    await waitFor(() => {
      expect(api.mock.calls.some(([path]) => path.includes('jlpt=5'))).toBe(true);
    });
  });

  it('toggles a radical pill filter', async () => {
    const user = userEvent.setup();
    renderLearn();
    const pill = await screen.findByTitle('water radical — 12 kanji');

    await user.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(api.mock.calls.some(([path]) => decodeURIComponent(path).includes('radical=水'))).toBe(
        true
      );
    });

    await user.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('false');
  });

  it('appends the next server page via Load more', async () => {
    const user = userEvent.setup();
    mockApi({
      list: { ...ONE_PAGE, total: 2, hasMore: true },
    });
    api.mockImplementation(async (path) => {
      if (path.startsWith('/radicals')) return RADICALS;
      if (path.startsWith('/kanji?')) {
        if (path.includes('page=2')) return { ...EMPTY_PAGE, page: 2 };
        return { ...ONE_PAGE, total: 2, hasMore: true };
      }
      throw new Error(`unexpected api path: ${path}`);
    });

    renderLearn();
    expect(await screen.findByRole('link', { name: /日/ })).toBeDefined();

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    await user.click(loadMore);

    await waitFor(() => {
      expect(api.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true);
    });
    // Server said page 2 has nothing more — the button retires.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });
  });

  it('links cells to the kanji detail route', async () => {
    mockApi({ list: ONE_PAGE });
    renderLearn();
    const cell = await screen.findByRole('link', { name: /日/ });
    expect(cell.getAttribute('href')).toContain('/kanji/');
  });
});
