import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { kanjiRouter } from './kanji.routes.js';
import { radicalsRouter } from './radicals.routes.js';
import { licensesRouter } from './licenses.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/kanji', kanjiRouter);
apiRouter.use('/radicals', radicalsRouter);
apiRouter.use('/licenses', licensesRouter);

// Phase 3+ mounts: progress, review, gamification, store, leaderboard,
// quiz, quests, stats (prompt.md §9).
