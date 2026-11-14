import { env } from '../config/env.js';

/**
 * D21: transactional email adapter. Only password-reset mail is sent today.
 * `brevo` posts to Brevo's HTTPS API with the built-in fetch (no dependency);
 * `console` is the dev/test driver. Delivery failures are logged and return
 * `{ delivered: false }` so auth responses stay generic and non-enumerating.
 */

export const RESET_TOKEN_TTL_MINUTES = 30;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPasswordResetEmail({ displayName, resetUrl }) {
  const name = displayName?.trim();
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Reset your Kanji Garden password';

  const textContent = [
    greeting,
    '',
    'Someone asked to reset the password for your Kanji Garden account.',
    `Open this link to choose a new password (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):`,
    resetUrl,
    '',
    "If you didn't ask for this, you can ignore this email. Your current password still works.",
    '',
    '— Kanji Garden',
  ].join('\n');

  const htmlContent = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F7F3EC;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1A1713;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;">Kanji Garden <span style="color:#8A8178;font-size:13px;font-weight:400;">植物</span></p>
      <div style="background:#FFFFFF;border:1px solid #E5DDD1;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Reset your password</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Someone asked to reset the password for your Kanji Garden account. Choose a new password with the button below. The link is valid for ${RESET_TOKEN_TTL_MINUTES} minutes and can be used once.</p>
        <p style="margin:0 0 20px;">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#B4442C;color:#FFFFFF;text-decoration:none;font-weight:500;padding:12px 20px;border-radius:6px;">Choose a new password</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5C554D;">If the button doesn't work, paste this link into your browser:</p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(resetUrl)}" style="color:#B4442C;">${escapeHtml(resetUrl)}</a></p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#5C554D;">If you didn't ask for this, you can ignore this email. Your current password still works.</p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#8A8178;text-align:center;">Kanji Garden — a quieter way to learn kanji.</p>
    </div>
  </body>
</html>`;

  return { subject, textContent, htmlContent };
}

function logWarning(message) {
  process.stderr.write(`[email] ${message}\n`);
}

async function sendWithBrevo({ to, subject, htmlContent, textContent }) {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM) {
    logWarning('BREVO_API_KEY or EMAIL_FROM is missing; password-reset email not sent.');
    return { delivered: false, provider: 'brevo' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      // Never log response bodies or the API key; status is enough to debug.
      logWarning(`Brevo rejected password-reset email (HTTP ${response.status}).`);
      return { delivered: false, provider: 'brevo' };
    }
    return { delivered: true, provider: 'brevo' };
  } catch (err) {
    logWarning(`Brevo request failed: ${err.message}`);
    return { delivered: false, provider: 'brevo' };
  }
}

export async function sendPasswordResetEmail({ to, displayName, resetUrl }) {
  const message = buildPasswordResetEmail({ displayName, resetUrl });

  if (env.EMAIL_PROVIDER === 'brevo') {
    return sendWithBrevo({ to, ...message });
  }

  if (env.NODE_ENV === 'production') {
    logWarning('EMAIL_PROVIDER=console in production; password-reset email not delivered.');
  } else if (env.NODE_ENV === 'development') {
    process.stdout.write(`[email] password reset for ${to}: ${resetUrl}\n`);
  }
  return { delivered: true, provider: 'console' };
}
