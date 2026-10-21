import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell.jsx';
import { useAuth } from '../stores/auth.js';

function renderShell() {
  return render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuth.setState({
    status: 'authed',
    user: { id: 'u1', displayName: 'Rina Kobayashi', avatarUrl: null },
    gamification: { totalXP: 1240, currentStreak: 12, coins: 50, currentLevel: 2 },
  });
});

describe('AppShell chrome (§7)', () => {
  it('renders wordmark, section links, streak, and XP', () => {
    renderShell();
    expect(screen.getByText('Kanji Garden')).toBeDefined();
    expect(screen.getByText('植物')).toBeDefined();
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    for (const label of ['Dashboard', 'Learn', 'Review', 'Quiz', 'Stats']) {
      expect(sections.textContent).toContain(label);
    }
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('1,240')).toBeDefined();
  });

  it('renders the mobile bottom tab bar (§7 chrome)', () => {
    renderShell();
    const tabs = screen.getByRole('navigation', { name: 'Primary' });
    expect(tabs.textContent).toContain('Home');
    expect(tabs.textContent).toContain('Learn');
    expect(tabs.textContent).toContain('Review');
    expect(tabs.textContent).toContain('Stats');
    expect(tabs.textContent).toContain('Profile');
  });

  it('profile menu signs out via the store', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Profile menu' }));
    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('Profile');
    expect(menu.textContent).toContain('Settings');
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    // logout() hits the API; the store flips to guest regardless (finally block).
    await waitFor(() => expect(useAuth.getState().status).toBe('guest'));
  });
});
