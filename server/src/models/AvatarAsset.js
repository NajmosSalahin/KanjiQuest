import { Schema, model } from 'mongoose';

/**
 * avatarAssets — production storage for uploaded avatars (D17). Render's
 * free tier has an ephemeral disk, so the storage adapter's Mongo driver
 * keeps the bytes in Atlas and serves them from /api/v1/assets/:id.
 */
const avatarAssetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const AvatarAsset = model('AvatarAsset', avatarAssetSchema);
