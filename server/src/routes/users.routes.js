import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { DAILY_GOAL_OPTIONS } from '@kanjigarden/shared';
import { User, publicUser } from '../models/User.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { Kanji } from '../models/Kanji.js';
import { UserProgress } from '../models/UserProgress.js';
import { EASE } from '../services/srs.js';
import {
  GamificationProfile,
  ensureGamificationProfile,
  gamificationSummary,
} from '../models/GamificationProfile.js';
import { UserQuest } from '../models/UserQuest.js';
import { QuizSession } from '../models/QuizSession.js';
import { UserInventory } from '../models/UserInventory.js';
import { requireAuth } from '../middleware/auth.js';
import { detectImageType } from '../utils/image.js';
import { clearSessionCookies } from '../utils/tokens.js';
import { deleteAvatar, deleteUserAvatars, saveAvatar } from '../services/storage.js';
import { ok, fail } from '../utils/envelope.js';

export const usersRouter = Router();

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const preferencesSchema = z
  .object({
    // §11.6: 20/50/100/200 (Phase 4 correction — 20 was missing, default was 100).
    dailyGoalXP: z.union(DAILY_GOAL_OPTIONS.map((v) => z.literal(v))).optional(),
    dailyReviewLimit: z.number().int().min(1).max(200).optional(),
    theme: z.enum(['auto', 'light', 'dark']).optional(),
    furigana: z.enum(['always', 'hover', 'never']).optional(),
    soundEnabled: z.boolean().optional(),
    hapticsEnabled: z.boolean().optional(),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 19:30.')
      .nullable()
      .optional(),
    reminderEnabled: z.boolean().optional(),
  })
  .strict();

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required.').max(32).optional(),
    jlptLevel: z
      .union([z.literal(5), z.literal(4), z.literal(3)])
      .nullable()
      .optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid timezone.')
      .optional(),
  })
  .strict();

/** D20: the 3-step modal sends one payload on finish or skip. */
const onboardingSchema = z
  .object({
    level: z
      .union([z.literal(5), z.literal(4), z.literal(3)])
      .nullable()
      .optional(),
    dailyReviewLimit: z.union([z.literal(10), z.literal(20), z.literal(40)]).optional(),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 19:30.')
      .nullable()
      .optional(),
    reminderEnabled: z.boolean().optional(),
    skipped: z.boolean().optional(),
  })
  .strict();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return fields;
}

usersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    const profile = await ensureGamificationProfile(user._id, user.preferences.dailyGoalXP);
    return ok(res, { user: publicUser(user), gamification: gamificationSummary(profile) });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/v1/users/me — display name, JLPT level, timezone (§6.13).
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }
    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    Object.assign(user, parsed.data);
    await user.save();
    return ok(res, { user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

usersRouter.patch('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (!fields[key]) fields[key] = [];
        fields[key].push(issue.message);
      }
      return fail(res, 400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
    }
    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    Object.assign(user.preferences, parsed.data);
    await user.save();
    // The profile mirrors the goal setting (reviews read the mirror).
    if (parsed.data.dailyGoalXP !== undefined) {
      const profile = await ensureGamificationProfile(user._id, user.preferences.dailyGoalXP);
      profile.dailyGoalXP = user.preferences.dailyGoalXP;
      await profile.save();
    }
    return ok(res, { preferences: user.preferences });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/users/me/onboarding — D20. Idempotent: finishing or skipping
// marks the account complete and bulk-preloads the chosen JLPT level (skip =
// N5) as `state:new`, due now. The daily limit caps each review session.
usersRouter.post('/me/onboarding', requireAuth, async (req, res, next) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }

    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');

    // Legacy/missing field = complete; only an explicit `false` shows the modal.
    if (user.preferences.onboardingCompleted !== false) {
      if (user.preferences.onboardingCompleted === undefined) {
        user.preferences.onboardingCompleted = true;
        await user.save();
      }
      return ok(res, { user: publicUser(user), preloadedCount: 0, alreadyCompleted: true });
    }

    const level = parsed.data.level ?? 5;
    const dailyReviewLimit = parsed.data.dailyReviewLimit ?? 20;
    const reminderTime = parsed.data.reminderTime ?? null;
    const reminderEnabled = reminderTime ? (parsed.data.reminderEnabled ?? true) : false;

    // Preload first, then mark complete: a failed bulk write leaves the modal
    // retryable instead of locking the account out of its starter deck.
    const kanji = await Kanji.find({ jlptLevel: level }).select('_id').sort({ frequencyRank: 1 });
    const dueDate = new Date();
    let preloadedCount = 0;
    if (kanji.length > 0) {
      const result = await UserProgress.bulkWrite(
        kanji.map((entry) => ({
          updateOne: {
            filter: { userId: user._id, kanjiId: entry._id },
            update: {
              $setOnInsert: {
                state: 'new',
                dueDate,
                interval: 0,
                easeFactor: EASE.START,
                repetitions: 0,
                lapses: 0,
                lastReviewedAt: null,
                history: [],
                suspendedUntil: null,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      preloadedCount = result.upsertedCount;
    }

    user.jlptLevel = level;
    user.preferences.dailyReviewLimit = dailyReviewLimit;
    user.preferences.reminderTime = reminderTime;
    user.preferences.reminderEnabled = reminderEnabled;
    user.preferences.onboardingCompleted = true;
    await user.save();

    return ok(res, { user: publicUser(user), preloadedCount, alreadyCompleted: false });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/users/me/avatar — multipart upload through the storage adapter.
usersRouter.post('/me/avatar', requireAuth, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 400, 'AVATAR_TOO_LARGE', 'Choose an image smaller than 2 MB.');
      }
      return next(uploadError);
    }
    try {
      if (!req.file) {
        return fail(res, 400, 'AVATAR_REQUIRED', 'Choose an image to upload.');
      }
      const mimeType = detectImageType(req.file.buffer);
      if (!mimeType) {
        return fail(res, 400, 'AVATAR_TYPE', 'Use a JPEG, PNG, or WebP image.');
      }
      const user = await User.findById(req.userId);
      if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');

      const previous = user.avatarUrl;
      const saved = await saveAvatar(user._id, req.file.buffer, mimeType);
      user.avatarUrl = saved.url;
      try {
        await user.save();
      } catch (err) {
        await deleteAvatar(user._id, saved.url);
        throw err;
      }
      await deleteAvatar(user._id, previous);
      return ok(res, { avatarUrl: user.avatarUrl, driver: saved.driver });
    } catch (err) {
      return next(err);
    }
  });
});

// DELETE /api/v1/users/me/avatar — back to initials.
usersRouter.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    const previous = user.avatarUrl;
    user.avatarUrl = null;
    await user.save();
    await deleteAvatar(user._id, previous);
    return ok(res, { avatarUrl: null });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/users/me — §6.13 "type name to confirm". Hard cascade.
usersRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const parsed = z
      .object({ confirmName: z.string().trim().min(1, 'Type your display name to confirm.') })
      .safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Type your display name to confirm.',
        zodFields(parsed.error)
      );
    }
    const user = await User.findById(req.userId);
    if (!user) return fail(res, 401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    if (parsed.data.confirmName !== user.displayName) {
      return fail(
        res,
        400,
        'CONFIRM_NAME_MISMATCH',
        'The name you typed does not match your display name.'
      );
    }

    await deleteAvatar(user._id, user.avatarUrl);
    await Promise.all([
      Session.deleteMany({ userId: user._id }),
      PasswordResetToken.deleteMany({ userId: user._id }),
      UserProgress.deleteMany({ userId: user._id }),
      GamificationProfile.deleteOne({ userId: user._id }),
      UserQuest.deleteMany({ userId: user._id }),
      QuizSession.deleteMany({ userId: user._id }),
      UserInventory.deleteMany({ userId: user._id }),
      deleteUserAvatars(user._id),
    ]);
    await User.deleteOne({ _id: user._id });
    clearSessionCookies(res);
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});
