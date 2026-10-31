import { Schema, model } from 'mongoose';

/** userQuests — prompt.md §8. One document per quest per user per local day. */
const userQuestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD (local)
    questId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    target: { type: Number, default: 1 },
    xpReward: { type: Number, default: 0 },
    coinReward: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    /** Idempotency guard: only one request may claim a quest's rewards. */
    rewardClaimed: { type: Boolean, default: false },
    xpAwarded: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    sweepAwarded: { type: Boolean, default: false },
    order: { type: Number, default: 1 },
  },
  { timestamps: true }
);

userQuestSchema.index({ userId: 1, date: 1 });
userQuestSchema.index({ userId: 1, date: 1, questId: 1 }, { unique: true });

export const UserQuest = model('UserQuest', userQuestSchema);
