import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));
vi.mock('recharts', () => {
  const Panel = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Panel,
    LineChart: Panel,
    BarChart: Panel,
    Line: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

import { api } from '../lib/api.js';
import Stats from './Stats.jsx';

function dateKey(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

const HEATMAP = Array.from({ length: 365 }, (_, i) => ({
  date: dateKey(364 - i),
  reviews: i === 364 ? 12 : 0,
}));

const DATA = {
  heatmap: HEATMAP,
  forecast: [
    { date: dateKey(0), count: 4 },
    { date: dateKey(1), count: 2 },
  ],
  accuracy: {
    days: 30,
    total: 25,
    good: 12,
    rate: 48,
    points: [
      { date: dateKey(1), total: 10, good: 8, rate: 80 },
      { date: dateKey(0), total: 15, good: 4, rate: 27 },
    ],
  },
  jlpt: [
    {
      level: 5,
      total: 100,
      new: 40,
      learning: 20,
      review: 20,
      mastered: 20,
      percentages: { new: 40, learning: 20, review: 20, mastered: 20 },
    },
    {
      level: 4,
      total: 50,
      new: 50,
      learning: 0,
      review: 0,
      mastered: 0,
      percentages: { new: 100, learning: 0, review: 0, mastered: 0 },
    },
    {
      level: 3,
      total: 20,
      new: 20,
      learning: 0,
      review: 0,
      mastered: 0,
      percentages: { new: 100, learning: 0, review: 0, mastered: 0 },
    },
  ],
  bestWorst: {
    best: [{ date: dateKey(1), total: 10, good: 8, rate: 80 }],
    worst: [{ date: dateKey(2), total: 12, good: 3, rate: 25 }],
  },
};

function renderStats() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Stats />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue(DATA);
});

describe('Statistics (§7.7)', () => {
  it('renders all five spec sections and the 30-day accuracy average', async () => {
    renderStats();

    expect(await screen.findByRole('heading', { name: 'Statistics' })).toBeTruthy();
    expect(screen.getByText('48% 30-day accuracy')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Review heatmap' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Accuracy' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Forecast' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'JLPT progress' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Best and worst days' })).toBeTruthy();
  });

  it('renders 365 heatmap cells and the N5–N3 stacked bars', async () => {
    const { container } = renderStats();
    await screen.findByRole('heading', { name: 'Review heatmap' });

    expect(screen.getByLabelText('Review heatmap for the last 365 days')).toBeTruthy();
    expect(container.querySelectorAll('[title*="review"]')).toHaveLength(365);
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByText('20 mastered · 20 review · 20 learning · 40 new')).toBeTruthy();
    expect(screen.getByText('N5')).toBeTruthy();
    expect(screen.getByText('N4')).toBeTruthy();
    expect(screen.getByText('N3')).toBeTruthy();
  });

  it('lists best and worst eligible days with accuracy', async () => {
    renderStats();
    await screen.findByText('Best days');

    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getAllByText('10 reviews').length).toBeGreaterThan(0);
    expect(screen.getByText('12 reviews')).toBeTruthy();
  });

  it('shows the error state without the banned loading copy', async () => {
    api.mockRejectedValueOnce(new Error('offline'));
    renderStats();
    expect(await screen.findByText('Statistics could not be loaded.')).toBeTruthy();
    expect(screen.queryByText(/Loading/)).toBeNull();
  });
});
