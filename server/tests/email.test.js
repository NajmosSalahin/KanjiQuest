import { describe, it, expect } from 'vitest';
import { buildPasswordResetEmail, sendPasswordResetEmail } from '../src/services/email.js';

describe('password-reset email (D21)', () => {
  it('builds text and HTML with the reset link and expiry', () => {
    const message = buildPasswordResetEmail({
      displayName: 'Rina <script>',
      resetUrl: 'https://kanjiquest.vercel.app/reset-password?token=abc123',
    });

    expect(message.subject).toMatch(/Reset/i);
    expect(message.textContent).toContain(
      'https://kanjiquest.vercel.app/reset-password?token=abc123'
    );
    expect(message.textContent).toContain('30 minutes');
    expect(message.htmlContent).toContain('Rina &lt;script&gt;');
    expect(message.htmlContent).not.toContain('Rina <script>');
    expect(message.htmlContent).toContain('reset-password?token=abc123');
  });

  it('uses the console driver in test and reports delivery', async () => {
    const result = await sendPasswordResetEmail({
      to: 'rina@example.com',
      displayName: 'Rina',
      resetUrl: 'http://localhost:5173/reset-password?token=abc',
    });
    expect(result).toEqual({ delivered: true, provider: 'console' });
  });
});
