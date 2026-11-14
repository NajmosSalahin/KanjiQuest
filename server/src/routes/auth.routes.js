import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User, publicUser } from '../models/User.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { env } from '../config/env.js';
import { RESET_TOKEN_TTL_MINUTES, sendPasswordResetEmail } from '../services/email.js';
import {
  createGamificationProfile,
  ensureGamificationProfile,
  gamificationSummary,
} from '../models/GamificationProfile.js';
import { ok, noContent, fail } from '../utils/envelope.js';
import {
  REFRESH_COOKIE,
  hashToken,
  newRefreshToken,
  setSessionCookies,
  clearSessionCookies,
  signAccessToken,
} from '../utils/tokens.js';

export const authRouter = Router();

const BCRYPT_COST = 12; // prompt.md §14

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters and include a number.')
  .regex(/\d/, 'Password must be at least 8 characters and include a number.')
  .max(128);

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Display name is required.').max(32),
  timezone: z.string().trim().max(64).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'This reset link is invalid or has expired.'),
  password: passwordSchema,
});

/** D21: identical response for known and unknown accounts (no enumeration). */
const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a reset link is on its way. Check your inbox in a minute.';

function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return fields;
}

async function issueSession(req, res, user, status) {
  const accessToken = signAccessToken(user._id);
  const refreshToken = newRefreshToken();
  await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: req.get('user-agent') ?? '',
    ip: req.ip ?? '',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  setSessionCookies(res, accessToken, refreshToken);
  const profile = await ensureGamificationProfile(user._id, user.preferences.dailyGoalXP);
  return ok(res, { user: publicUser(user), gamification: gamificationSummary(profile) }, status);
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }
    const { email, password, displayName, timezone } = parsed.data;

    const existing = await User.findOne({ email }).select('_id');
    if (existing) {
      return fail(res, 409, 'EMAIL_TAKEN', 'That email is already registered. Try signing in.', {
        email: ['That email is already registered. Try signing in.'],
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({
      email,
      passwordHash,
      displayName,
      timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      // D20: explicit false opts brand-new accounts into the onboarding modal;
      // legacy documents without the field remain `undefined` (complete).
      preferences: { onboardingCompleted: false },
    });
    await createGamificationProfile(user._id, user.preferences.dailyGoalXP);
    return issueSession(req, res, user, 201);
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email }).select('+passwordHash');
    // Same message + code whether the email exists or the password is wrong
    // (no user enumeration).
    const invalid = () =>
      fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.', {
        password: ['Email or password is incorrect.'],
      });
    if (!user) return invalid();

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return invalid();

    user.lastActiveAt = new Date();
    await user.save();
    return issueSession(req, res, user, 200);
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/auth/forgot-password — D21. Always returns the same message so
// callers cannot probe which emails exist. Old unused links are invalidated.
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    const user = await User.findOne({ email: parsed.data.email });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      await PasswordResetToken.deleteMany({ userId: user._id });
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      });

      const resetUrl = `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const delivery = await sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        resetUrl,
      });
      if (!delivery.delivered) {
        // Keep the API response generic; ops can inspect the server logs.
        process.stderr.write(`[auth] password reset email not delivered for user ${user._id}\n`);
      }
    }

    return ok(res, { message: FORGOT_PASSWORD_MESSAGE });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/auth/reset-password — D21. Consumes the token atomically,
// updates the password hash, then kills every refresh session for the user.
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    const invalidToken = () =>
      fail(
        res,
        400,
        'INVALID_RESET_TOKEN',
        'This reset link is invalid or has expired. Request a new one.'
      );

    const now = new Date();
    const resetToken = await PasswordResetToken.findOneAndUpdate(
      {
        tokenHash: hashToken(parsed.data.token),
        usedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { usedAt: now } }
    );
    if (!resetToken) return invalidToken();

    const user = await User.findById(resetToken.userId).select('+passwordHash');
    if (!user) return invalidToken();

    user.passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);
    await user.save();

    await Promise.all([
      Session.deleteMany({ userId: user._id }),
      PasswordResetToken.deleteMany({ userId: user._id }),
    ]);
    clearSessionCookies(res);

    return ok(res, {
      message: 'Password updated. Sign in with your new password.',
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    const unauthorized = (code) => {
      clearSessionCookies(res);
      return fail(res, 401, code, 'Your session expired. Sign in again.');
    };
    if (!token) return unauthorized('REFRESH_MISSING');

    const session = await Session.findOne({ refreshTokenHash: hashToken(token) });
    if (!session) return unauthorized('REFRESH_INVALID');

    if (session.revokedAt) {
      // A rotated-away token came back: assume theft, kill every session.
      await Session.updateMany(
        { userId: session.userId, revokedAt: null },
        { revokedAt: new Date() }
      );
      return unauthorized('REFRESH_REUSE_DETECTED');
    }
    if (session.expiresAt.getTime() <= Date.now()) return unauthorized('REFRESH_EXPIRED');

    session.revokedAt = new Date();
    await session.save();

    const user = await User.findById(session.userId);
    if (!user) return unauthorized('REFRESH_INVALID');
    return issueSession(req, res, user, 200);
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await Session.updateMany(
        { refreshTokenHash: hashToken(token), revokedAt: null },
        { revokedAt: new Date() }
      );
    }
    clearSessionCookies(res);
    return noContent(res);
  } catch (err) {
    return next(err);
  }
});
