import { Router } from 'express';
import { z } from 'zod';
import { DAILY_GOAL_OPTIONS } from '@kanjigarden/shared';
import { User, publicUser } from '../models/User.js';
import { ensureGamificationProfile, gamificationSummary } from '../models/GamificationProfile.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../utils/envelope.js';

export const usersRouter = Router();

const preferencesSchema = z
  .object({
    // §11.6: 20/50/100/200 (Phase 4 correction — 20 was missing, default was 100).
    dailyGoalXP: z.union(DAILY_GOAL_OPTIONS.map((v) => z.literal(v))).optional(),
    dailyReviewLimit: z.number().int().min(1).max(200).optional(),
    theme: z.enum(['auto', 'light', 'dark']).optional(),
    furigana: z.boolean().optional(),
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
