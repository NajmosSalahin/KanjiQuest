import { Router } from 'express';
import { z } from 'zod';
import { getLeaderboard } from '../services/leaderboard.js';
import { ok, fail } from '../utils/envelope.js';

export const leaderboardRouter = Router();

const querySchema = z.object({
  period: z.enum(['weekly', 'allTime']).default('weekly'),
});

// GET /api/v1/leaderboard?period=weekly|allTime — top 100 + current row (§9).
leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Choose the weekly or all-time leaderboard.');
    }
    return ok(res, await getLeaderboard(req.userId, parsed.data.period));
  } catch (err) {
    return next(err);
  }
});
