import { Schema, model } from 'mongoose';

/** quests — prompt.md §8/§6.7 seeded definitions. */
const questDefSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    /** Review quests ship in Phase 5; quiz quests are seeded now and become
     *  selectable when Phase 6 emits quiz events. */
    phase: { type: Number, default: 5, min: 5, max: 10 },
    type: { type: String, default: 'review' },
    target: { type: Number, required: true, min: 1 },
    xpReward: { type: Number, required: true, min: 20, max: 50 },
    coinReward: { type: Number, required: true, min: 5, max: 15 },
    order: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'quests' }
);

export const QuestDef = model('QuestDef', questDefSchema);
