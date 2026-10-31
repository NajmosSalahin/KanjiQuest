import { Router } from 'express';
import { User } from '../models/User.js';
import { getTodayQuests } from '../services/quests.js';
import { ok } from '../utils/envelope.js';

export const questRouter = Router();

questRouter.get('/today', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('timezone').lean();
    return ok(res, await getTodayQuests(req.userId, user?.timezone ?? 'UTC', new Date()));
  } catch (err) {
    return next(err);
  }
});
