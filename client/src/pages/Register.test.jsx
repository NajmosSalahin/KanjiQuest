import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register.jsx';

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

describe('Register screen (§7.11)', () => {
  it('renders the spec copy exactly', () => {
    renderRegister();
    expect(screen.getByRole('heading', { level: 1, name: 'Create an account' })).toBeDefined();
    expect(screen.getByText('Start your garden.')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByLabelText('Display name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign in.' })).toBeDefined();
  });

  it('enforces min 8 chars + one number', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Password'), 'shrt');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Password must be at least 8 characters and include a number.')
    ).toBeDefined();
  });

  it('requires a display name', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Display name is required.')).toBeDefined();
  });

  it('shows the strength indicator while typing a password', async () => {
    const user = userEvent.setup();
    renderRegister();
    expect(screen.queryByText(/password strength/i)).toBeNull();
    await user.type(screen.getByLabelText('Password'), 'garden');
    expect(screen.getByText('Password strength: 0 of 3')).toBeDefined();
    await user.type(screen.getByLabelText('Password'), '123');
    expect(screen.getByText('Password strength: 2 of 3')).toBeDefined();
    await user.type(screen.getByLabelText('Password'), '456');
    expect(screen.getByText('Password strength: 3 of 3')).toBeDefined();
  });
});
