import { Schema, model } from 'mongoose';

/** sessions — prompt.md §8: one row per active refresh token. */
const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true, unique: true },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null },
});

export const Session = model('Session', sessionSchema);
