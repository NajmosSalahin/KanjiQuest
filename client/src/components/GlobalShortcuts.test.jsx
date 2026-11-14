import { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ShortcutsModal, useGlobalShortcuts } from './GlobalShortcuts.jsx';

function Harness() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useGlobalShortcuts({ onOpenHelp: () => setOpen(true) });
  return (
    <>
      <ShortcutsModal open={open} onOpenChange={setOpen} />
      <input aria-label="a text field" />
      <p data-testid="path">{location.pathname}</p>
      <p data-testid="search">{location.search}</p>
    </>
  );
}

function renderHarness() {
  return render(
    <MemoryRouter initialEntries={['/stats']}>
      <Harness />
    </MemoryRouter>
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('global keyboard shortcuts (§6.16)', () => {
  it('opens the ? overlay and lists global, review, and quiz keys', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.keyboard('?');

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
    expect(screen.getByText('Focus kanji search')).toBeTruthy();
    expect(screen.getByText('Undo the last rating (4s)')).toBeTruthy();
  });

  it('navigates with / and g-chords', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.keyboard('/');
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/learn'));
    expect(screen.getByTestId('search').textContent).toBe('?focus=search');

    await user.keyboard('g');
    await user.keyboard('p');
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/profile'));

    await user.keyboard('g');
    await user.keyboard('r');
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/review'));
  });

  it('ignores shortcuts while typing in a field', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('textbox', { name: 'a text field' }));
    await user.keyboard('?');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('path').textContent).toBe('/stats');
  });
});
