import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login.jsx';

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login screen (§7.11 + D2)', () => {
  it('renders the spec copy exactly', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeDefined();
    expect(screen.getByText('Continue your garden.')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Create an account.' })).toBeDefined();
  });

  it('has no Google button and no "or" divider (D2 — OAuth removed)', () => {
    renderLogin();
    expect(screen.queryByText(/google/i)).toBeNull();
    expect(screen.queryByText('or')).toBeNull();
  });

  it('shows crimson-field validation on empty submit', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeDefined();
    expect(screen.getByText('Enter your password.')).toBeDefined();
  });

  it('validates the email format', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeDefined();
  });
});
