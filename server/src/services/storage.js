/**
 * Storage adapter (D2/D17). Development writes avatars to `server/uploads/`
 * and serves them at `/uploads/...`; production uses the Mongo-backed driver
 * so uploads survive Render's ephemeral free-tier disk.
 *
 * The rest of the API only sees a URL, so swapping in S3/R2 later is a third
 * driver, not a route/UI change.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { AvatarAsset } from '../models/AvatarAsset.js';
import { IMAGE_EXTENSIONS } from '../utils/image.js';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const UPLOAD_ROOT = path.join(SERVER_ROOT, 'uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');

export const STORAGE_DRIVER =
  env.STORAGE_DRIVER ?? (env.NODE_ENV === 'production' ? 'mongo' : 'local');

export async function saveAvatar(userId, buffer, mimeType) {
  const extension = IMAGE_EXTENSIONS[mimeType];
  if (!extension) throw new Error(`Unsupported avatar type: ${mimeType}`);

  if (STORAGE_DRIVER === 'mongo') {
    const asset = await AvatarAsset.create({
      userId,
      mimeType,
      size: buffer.length,
      data: buffer,
    });
    return { url: `/api/v1/assets/${asset._id}`, driver: 'mongo' };
  }

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(AVATAR_DIR, filename), buffer);
  return { url: `/uploads/avatars/${filename}`, driver: 'local' };
}

/** Remove the previous avatar; unknown/foreign URLs are ignored. */
export async function deleteAvatar(userId, avatarUrl) {
  if (!avatarUrl) return;
  const assetMatch = /^\/api\/v1\/assets\/([a-f\d]{24})$/i.exec(avatarUrl);
  if (assetMatch) {
    await AvatarAsset.deleteOne({ _id: assetMatch[1], userId });
    return;
  }
  const localMatch = /^\/uploads\/avatars\/([A-Za-z0-9.-]+)$/.exec(avatarUrl);
  if (localMatch) {
    await fs.unlink(path.join(AVATAR_DIR, localMatch[1])).catch(() => {});
  }
}

export async function deleteUserAvatars(userId) {
  await AvatarAsset.deleteMany({ userId });
}
