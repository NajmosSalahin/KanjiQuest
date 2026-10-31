import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { kanjiRouter } from './kanji.routes.js';
import { radicalsRouter } from './radicals.routes.js';
import { licensesRouter } from './licenses.routes.js';
import { progressRouter, reviewRouter } from './progress.routes.js';
import { gamificationRouter } from './gamification.routes.js';
import { questRouter } from './quests.routes.js';
import { statsRouter } from './stats.routes.js';
import { requireAuth } from '../middleware/auth.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/kanji', kanjiRouter);
apiRouter.use('/radicals', radicalsRouter);
apiRouter.use('/licenses', licensesRouter);
apiRouter.use('/progress', requireAuth, progressRouter); // Phase 3
apiRouter.use('/review', requireAuth, reviewRouter); // Phase 3
apiRouter.use('/gamification', requireAuth, gamificationRouter); // Phase 4
apiRouter.use('/quests', requireAuth, questRouter); // Phase 5
apiRouter.use('/stats', requireAuth, statsRouter); // Phase 5

// Phase 5+ mounts: store, leaderboard, quiz, quests, stats (prompt.md §9).
