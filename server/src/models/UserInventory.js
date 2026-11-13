import { Schema, model } from 'mongoose';

/**
 * userInventory — prompt.md §8 (`userId`, `itemId`, `acquiredAt`) extended
 * with quantity so consumables (streak freezes) can stack. Cosmetics stay at
 * quantity 1 forever; title/frame ownership is permanent.
 */
const userInventorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemId: { type: String, required: true },
    type: { type: String, enum: ['freeze', 'boost', 'title', 'frame'], required: true },
    quantity: { type: Number, default: 1, min: 0 },
    firstPurchasedAt: { type: Date, default: Date.now },
    lastPurchasedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userInventorySchema.index({ userId: 1, itemId: 1 }, { unique: true });

export const UserInventory = model('UserInventory', userInventorySchema);

/** Public inventory row for GET /store/inventory. */
export function publicInventoryItem(row) {
  return {
    itemId: row.itemId,
    type: row.type,
    quantity: row.quantity,
    firstPurchasedAt: row.firstPurchasedAt,
    lastPurchasedAt: row.lastPurchasedAt,
  };
}
