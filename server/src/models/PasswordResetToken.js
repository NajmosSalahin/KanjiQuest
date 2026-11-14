import { Schema, model } from 'mongoose';

/**
 * D21: password-reset tokens. Only the sha256 hash is stored; the raw token
 * exists solely in the emailed link. Single-use + 30-minute expiry.
 * The TTL index lets Mongo reclaim expired rows automatically.
 */
const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = model('PasswordResetToken', passwordResetTokenSchema);
