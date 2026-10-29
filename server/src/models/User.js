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
      furigana: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      hapticsEnabled: { type: Boolean, default: false },
      reminderTime: { type: String, default: null },
      reminderEnabled: { type: Boolean, default: false },
    },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = model('User', userSchema);

/** Safe projection for API responses — never leaks passwordHash. */
export function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    nativeLanguage: user.nativeLanguage,
    jlptLevel: user.jlptLevel,
    timezone: user.timezone,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}
