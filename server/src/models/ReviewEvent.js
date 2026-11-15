import { Schema, model } from 'mongoose';

/**
 * One row per accepted review event with a client-generated id (D24).
 * The unique (userId, eventId) pair makes a retried offline submission
 * idempotent, and the TTL keeps the collection tiny.
 */
const reviewEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: String, required: true },
  cardId: { type: Schema.Types.ObjectId, ref: 'UserProgress', required: true },
  rating: { type: Number, required: true, min: 0, max: 3 },
  reviewedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },
});

reviewEventSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export const ReviewEvent = model('ReviewEvent', reviewEventSchema);
