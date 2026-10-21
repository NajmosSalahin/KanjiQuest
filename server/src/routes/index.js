import { Router } from 'express';
import { healthRouter } from './health.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// Phase 1+ mounts: auth, users, kanji, progress, review, gamification,
// store, leaderboard, quiz, quests, stats (prompt.md §9).
