import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ok, fail } from '../utils/envelope.js';
import {
  accuracy30,
  bestWorstDays,
  forecast30,
  heatmap365,
  jlptMastery,
  statsOverview,
} from '../services/stats.js';

export const statsRouter = Router();

const rangeQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
const yearQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(365),
});
const heatmapQuery = z.object({
  range: z.coerce.number().int().min(1).max(365).default(365),
});
const forecastQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

function parse(schema, value, res) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'query';
      if (!fields[key]) fields[key] = [];
      fields[key].push(issue.message);
    }
    fail(res, 422, 'VALIDATION_ERROR', 'Invalid query parameters.', fields);
    return null;
  }
  return result.data;
}

async function timezoneFor(userId) {
  const user = await User.findById(userId).select('timezone').lean();
  return user?.timezone ?? 'UTC';
}

statsRouter.get('/', async (req, res, next) => {
  try {
    const tz = await timezoneFor(req.userId);
    return ok(res, await statsOverview(req.userId, { timezone: tz }));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/heatmap', async (req, res, next) => {
  try {
    const query = parse(heatmapQuery, req.query, res);
    if (!query) return;
    const tz = await timezoneFor(req.userId);
    return ok(res, await heatmap365(req.userId, { timezone: tz }, new Date(), query.range));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/forecast', async (req, res, next) => {
  try {
    const query = parse(forecastQuery, req.query, res);
    if (!query) return;
    const tz = await timezoneFor(req.userId);
    return ok(res, await forecast30(req.userId, { timezone: tz }, new Date(), query.days));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/accuracy', async (req, res, next) => {
  try {
    const query = parse(rangeQuery, req.query, res);
    if (!query) return;
    const tz = await timezoneFor(req.userId);
    return ok(res, await accuracy30(req.userId, { timezone: tz }, new Date(), query.days));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/jlpt', async (req, res, next) => {
  try {
    return ok(res, await jlptMastery(req.userId));
  } catch (err) {
    return next(err);
  }
});

statsRouter.get('/best-worst', async (req, res, next) => {
  try {
    const query = parse(yearQuery, req.query, res);
    if (!query) return;
    const tz = await timezoneFor(req.userId);
    return ok(res, await bestWorstDays(req.userId, { timezone: tz }, new Date(), query.days));
  } catch (err) {
    return next(err);
  }
});
