import { Schema, model } from 'mongoose';
import { EASE } from '../services/srs.js';
import { MASTERED_INTERVAL_DAYS } from '@kanjigarden/shared';

/** history[] entry — §8 fields plus superset additions (DECISIONS.md):
 *  `previous` powers §6.5 undo ("compensating transaction"), `xpAwarded`
 *  makes that undo's XP refund exact, and `gami` snapshots the Phase 4
 *  gamification counters so an undo also restores those exactly. */
const historyEntrySchema = new Schema(
  {
    reviewedAt: { type: Date, required: true },
    rating: { type: Number, required: true, min: 0, max: 3 },
    previousInterval: { type: Number, required: true },
    newInterval: { type: Number, required: true },
    xpAwarded: { type: Number, default: 0 },
    previous: {
      state: { type: String, enum: ['new', 'learning', 'review', 'relearning'] },
      interval: { type: Number },
      easeFactor: { type: Number },
      repetitions: { type: Number },
      lapses: { type: Number },
      dueDate: { type: Date },
    },
    gami: {
      totalReviews: { type: Number },
      dailyReviewsCount: { type: Number },
      dailyAgainToday: { type: Boolean },
      currentPerfectRun: { type: Number },
      reviewsBefore8: { type: Number },
      reviewsAfter23: { type: Number },
      goalStreak: { type: Number },
      goalMetDate: { type: String },
      dailyCountersDate: { type: String },
    },
    questUndo: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { _id: false }
);

/** userProgress (one per user–kanji pair) — prompt.md §8. */
const userProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kanjiId: { type: Schema.Types.ObjectId, ref: 'Kanji', required: true },
    state: {
      type: String,
      enum: ['new', 'learning', 'review', 'relearning'],
      default: 'new',
    },
    dueDate: { type: Date, required: true },
    interval: { type: Number, default: 0 }, // minutes while learning/relearning, days in review (§10)
    easeFactor: { type: Number, default: EASE.START },
    repetitions: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
    history: { type: [historyEntrySchema], default: [] },
    suspendedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userProgressSchema.index({ userId: 1, dueDate: 1 });
userProgressSchema.index({ userId: 1, kanjiId: 1 }, { unique: true });

export const UserProgress = model('UserProgress', userProgressSchema);

/** Public projection — API responses (§9) and myProgress on kanji detail. */
export function publicProgress(progress) {
  if (!progress) return null;
  return {
    id: String(progress._id),
    kanjiId: String(progress.kanjiId),
    state: progress.state,
    dueDate: progress.dueDate,
    interval: progress.interval,
    easeFactor: progress.easeFactor,
    repetitions: progress.repetitions,
    lapses: progress.lapses,
    lastReviewedAt: progress.lastReviewedAt,
    suspendedUntil: progress.suspendedUntil,
    suspended: !!(progress.suspendedUntil && progress.suspendedUntil > new Date()),
    mastered: progress.state === 'review' && progress.interval >= MASTERED_INTERVAL_DAYS,
  };
}
