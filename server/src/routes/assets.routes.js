import { Router } from 'express';
import { AvatarAsset } from '../models/AvatarAsset.js';
import { fail } from '../utils/envelope.js';

export const assetsRouter = Router();

const OID = /^[a-f\d]{24}$/i;

/** Public avatar bytes (D17). URLs are unguessable ObjectIds and immutable. */
assetsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!OID.test(req.params.id)) {
      return fail(res, 404, 'ASSET_NOT_FOUND', 'That image was not found.');
    }
    const asset = await AvatarAsset.findById(req.params.id).select('mimeType data').lean();
    if (!asset) return fail(res, 404, 'ASSET_NOT_FOUND', 'That image was not found.');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(asset.mimeType);
    return res.send(asset.data);
  } catch (err) {
    return next(err);
  }
});
