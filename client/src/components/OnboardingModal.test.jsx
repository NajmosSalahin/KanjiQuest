import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import { OnboardingModal } from './OnboardingModal.jsx';
import { useAuth } from '../stores/auth.js';

const USER = {
  id: 'u1',
  email: 'rina@example.com',
  displayName: 'Rina',
  preferences: { onboardingCompleted: false, dailyReviewLimit: 20 },
};

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingModal open />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.mockReset();
  useAuth.setState({ status: 'authed', user: USER, gamification: null });
  api.mockResolvedValue({
    user: {
      ...USER,
      jlptLevel: 4,
      preferences: { ...USER.preferences, onboardingCompleted: true },
    },
    preloadedCount: 166,
    alreadyCompleted: false,
  });
});

describe('Onboarding modal (§6.1 / D20)', () => {
  it('walks the three steps and posts level, pace, and reminder choices', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByText('Step 1 of 3 · Level')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /N4/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Step 2 of 3 · Pace')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /40 reviews/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Step 3 of 3 · Reminders')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /8:00 PM/ }));
    await user.click(screen.getByRole('button', { name: 'Start my garden' }));

    expect(api).toHaveBeenCalledWith('/users/me/onboarding', {
      method: 'POST',
      body: {
        level: 4,
        dailyReviewLimit: 40,
        reminderTime: '20:00',
        reminderEnabled: true,
      },
    });
    expect(useAuth.getState().user.preferences.onboardingCompleted).toBe(true);
  });

  it('can go back a step without losing the choice', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('radio', { name: /N3/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('radio', { name: /N3/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('skip uses server defaults', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Skip for now/ }));

    expect(api).toHaveBeenCalledWith('/users/me/onboarding', {
      method: 'POST',
      body: { skipped: true },
    });
  });

  it('shows an error and stays open when the request fails', async () => {
    const user = userEvent.setup();
    api.mockRejectedValueOnce(new Error('The garden is closed for a moment.'));
    renderModal();

    await user.click(screen.getByRole('button', { name: /Skip for now/ }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The garden is closed for a moment.'
    );
    expect(screen.getByText('Step 1 of 3 · Level')).toBeTruthy();
  });
});
