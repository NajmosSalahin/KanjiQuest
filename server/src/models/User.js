import { Schema, model } from 'mongoose';
import { DAILY_GOAL_OPTIONS, DEFAULT_DAILY_GOAL_XP } from '@kanjigarden/shared';

/** users — prompt.md §8. */
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 32 },
    avatarUrl: { type: String, default: null },
    nativeLanguage: { type: String, default: 'en' },
    jlptLevel: { type: Number, default: null },
    timezone: { type: String, default: 'UTC' },
    preferences: {
      // §11.6 exact numbers: default 50, options 20/50/100/200 (Phase 4 fix).
      dailyGoalXP: { type: Number, enum: [...DAILY_GOAL_OPTIONS], default: DEFAULT_DAILY_GOAL_XP },
      dailyReviewLimit: { type: Number, default: 20 },
      theme: { type: String, enum: ['auto', 'light', 'dark'], default: 'auto' },
      // §6.13: always / on hover / never. migrate-090 converts old booleans.
      furigana: { type: String, enum: ['always', 'hover', 'never'], default: 'always' },
      soundEnabled: { type: Boolean, default: true },
      hapticsEnabled: { type: Boolean, default: false },
      reminderTime: { type: String, default: null },
      reminderEnabled: { type: Boolean, default: false },
      // D20: new accounts see the 3-step onboarding modal. No schema default:
      // legacy documents stay `undefined` so publicUser treats them as complete
      // without waiting for the migration. Registration sets `false` explicitly.
      onboardingCompleted: { type: Boolean },
    },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);

/** Safe projection for API responses — never leaks passwordHash. */
export function publicUser(user) {
  const preferences = user.preferences?.toObject
    ? user.preferences.toObject()
    : { ...user.preferences };
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    nativeLanguage: user.nativeLanguage,
    jlptLevel: user.jlptLevel,
    timezone: user.timezone,
    preferences: {
      ...preferences,
      // D20 legacy fallback: accounts created before Phase 8 (no field)
      // are already using the app and must not be interrupted by onboarding.
      onboardingCompleted: preferences.onboardingCompleted !== false,
    },
    createdAt: user.createdAt,
  };
}
