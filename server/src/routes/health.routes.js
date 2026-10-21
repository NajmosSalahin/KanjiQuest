import { Router } from 'express';
import { ok } from '../utils/envelope.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  ok(res, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});
