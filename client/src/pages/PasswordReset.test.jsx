import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/api.js', () => ({ api: vi.fn() }));

import { api } from '../lib/api.js';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';

function renderPage(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.split('?')[0]} element={element} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.mockReset();
});

describe('forgot password screen (D21)', () => {
  it('posts the email and shows the generic success copy', async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ message: 'generic' });
    renderPage('/forgot-password', <ForgotPassword />);

    await user.type(screen.getByLabelText('Email'), 'rina@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(api).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'rina@example.com' },
    });
    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(screen.getByText(/If an account exists/)).toBeTruthy();
  });

  it('shows a validation error for an invalid address', async () => {
    const user = userEvent.setup();
    renderPage('/forgot-password', <ForgotPassword />);

    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });
});

describe('reset password screen (D21)', () => {
  it('posts the token and new password, then confirms', async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ message: 'Password updated.' });
    renderPage('/reset-password?token=abc123', <ResetPassword />);

    await user.type(screen.getByLabelText('New password'), 'newgarden456');
    await user.type(screen.getByLabelText('Confirm new password'), 'newgarden456');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(api).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: { token: 'abc123', password: 'newgarden456' },
    });
    expect(await screen.findByText('Password updated')).toBeTruthy();
  });

  it('requires matching passwords', async () => {
    const user = userEvent.setup();
    renderPage('/reset-password?token=abc123', <ResetPassword />);

    await user.type(screen.getByLabelText('New password'), 'newgarden456');
    await user.type(screen.getByLabelText('Confirm new password'), 'different123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
  });

  it('shows a clear state when the link has no token', () => {
    renderPage('/reset-password', <ResetPassword />);
    expect(screen.getByText('This link is incomplete')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeTruthy();
  });
});
