import { Router } from 'express';
import { getInventory, getStore } from '../services/store.js';
import { ok } from '../utils/envelope.js';

export const storeRouter = Router();

// GET /api/v1/store/items — catalogue + live purchase/equip state (§9).
storeRouter.get('/items', async (req, res, next) => {
  try {
    return ok(res, await getStore(req.userId));
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/store/inventory — items the user owns (§9).
storeRouter.get('/inventory', async (req, res, next) => {
  try {
    return ok(res, await getInventory(req.userId));
  } catch (err) {
    return next(err);
  }
});
