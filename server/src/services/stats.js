/**
 * Statistics — prompt.md §7.7 / §9.
 *
 * All day buckets are local to the user's timezone. Rates are returned as
 * whole percentages (0–100) so every chart renders the same scale.
 */
import { Types } from 'mongoose';
import { MASTERED_INTERVAL_DAYS } from '@kanjigarden/shared';
import { Kanji } from '../models/Kanji.js';
import { UserProgress } from '../models/UserProgress.js';
import { addDays, localDay } from './time.js';

const DAY_MS = 86_400_000;
const oid = (id) => new Types.ObjectId(String(id));

function dayExpr(field, tz) {
  return { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } };
}

function rate(good, total) {
  return total > 0 ? Math.round((good / total) * 100) : null;
}

async function historyByDay(userId, tz, since) {
  return UserProgress.aggregate([
    { $match: { userId: oid(userId), 'history.reviewedAt': { $gte: since } } },
    { $unwind: '$history' },
    { $match: { 'history.reviewedAt': { $gte: since } } },
    {
      $group: {
        _id: dayExpr('history.reviewedAt', tz),
        total: { $sum: 1 },
        good: { $sum: { $cond: [{ $gte: ['$history.rating', 2] }, 1, 0] } },
      },
    },
  ]);
}

function daysBack(today, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

function daysForward(today, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(addDays(today, i));
  return out;
}

/** 365-day review heatmap, oldest first. */
export async function heatmap365(userId, user, now = new Date(), days = 365) {
  const tz = user?.timezone ?? 'UTC';
  const today = localDay(now, tz);
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  const rows = await historyByDay(userId, tz, since);
  const byDay = new Map(rows.map((row) => [row._id, row.total]));
  return daysBack(today, days).map((date) => ({ date, reviews: byDay.get(date) ?? 0 }));
}

/** Upcoming due-load, overdue cards folded into today. */
export async function forecast30(userId, user, now = new Date(), days = 30) {
  const tz = user?.timezone ?? 'UTC';
  const today = localDay(now, tz);
  const until = new Date(now.getTime() + days * DAY_MS);
  const rows = await UserProgress.aggregate([
    {
      $match: {
        userId: oid(userId),
        dueDate: { $lte: until },
        $or: [
          { suspendedUntil: null },
          { suspendedUntil: { $exists: false } },
          { suspendedUntil: { $lte: now } },
        ],
      },
    },
    { $group: { _id: dayExpr('dueDate', tz), count: { $sum: 1 } } },
  ]);
  const byDay = new Map();
  for (const row of rows) {
    const key = row._id < today ? today : row._id;
    byDay.set(key, (byDay.get(key) ?? 0) + row.count);
  }
  return daysForward(today, days).map((date) => ({ date, count: byDay.get(date) ?? 0 }));
}

/** Daily accuracy series for the line chart. */
export async function accuracy30(userId, user, now = new Date(), days = 30) {
  const tz = user?.timezone ?? 'UTC';
  const today = localDay(now, tz);
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  const rows = await historyByDay(userId, tz, since);
  const byDay = new Map(rows.map((row) => [row._id, row]));
  let total = 0;
  let good = 0;
  const points = daysBack(today, days).map((date) => {
    const row = byDay.get(date);
    total += row?.total ?? 0;
    good += row?.good ?? 0;
    return {
      date,
      total: row?.total ?? 0,
      good: row?.good ?? 0,
      rate: rate(row?.good ?? 0, row?.total ?? 0),
    };
  });
  return { days, points, total, good, rate: rate(good, total) };
}

/** Best and worst days over a year, counting only days with ≥10 reviews. */
export async function bestWorstDays(userId, user, now = new Date(), days = 365, minReviews = 10) {
  const tz = user?.timezone ?? 'UTC';
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  const rows = await historyByDay(userId, tz, since);
  const eligible = rows
    .filter((row) => row.total >= minReviews)
    .map((row) => ({
      date: row._id,
      total: row.total,
      good: row.good,
      rate: rate(row.good, row.total),
    }));
  const best = [...eligible].sort((a, b) => b.rate - a.rate || b.total - a.total).slice(0, 5);
  const worst = [...eligible].sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, 5);
  return { days, minReviews, best, worst };
}

/** N5/N4/N3 stacked status bars. Untracked kanji count as "new" so the bar
 *  represents progress through the full JLPT deck (D12). */
export async function jlptMastery(userId) {
  const levels = [5, 4, 3];
  const collection = Kanji.collection.collectionName;
  const [totals, statuses] = await Promise.all([
    Kanji.aggregate([
      { $match: { jlptLevel: { $in: levels } } },
      { $group: { _id: '$jlptLevel', total: { $sum: 1 } } },
    ]),
    UserProgress.aggregate([
      { $match: { userId: oid(userId) } },
      {
        $lookup: {
          from: collection,
          localField: 'kanjiId',
          foreignField: '_id',
          as: 'kanji',
        },
      },
      { $unwind: '$kanji' },
      { $match: { 'kanji.jlptLevel': { $in: levels } } },
      {
        $group: {
          _id: {
            level: '$kanji.jlptLevel',
            status: {
              $cond: [
                { $eq: ['$state', 'review'] },
                {
                  $cond: [{ $gte: ['$interval', MASTERED_INTERVAL_DAYS] }, 'mastered', 'review'],
                },
                {
                  $cond: [{ $in: ['$state', ['learning', 'relearning']] }, 'learning', 'new'],
                },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalByLevel = new Map(totals.map((row) => [row._id, row.total]));
  const counts = new Map();
  for (const row of statuses) {
    const key = `${row._id.level}:${row._id.status}`;
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }

  return levels.map((level) => {
    const total = totalByLevel.get(level) ?? 0;
    const tracked = ['new', 'learning', 'review', 'mastered'].reduce(
      (sum, status) => sum + (counts.get(`${level}:${status}`) ?? 0),
      0
    );
    const newCount = (counts.get(`${level}:new`) ?? 0) + Math.max(0, total - tracked);
    const learning = counts.get(`${level}:learning`) ?? 0;
    const review = counts.get(`${level}:review`) ?? 0;
    const mastered = counts.get(`${level}:mastered`) ?? 0;
    const pct = (count) => (total ? Math.round((count / total) * 100) : 0);
    return {
      level,
      total,
      new: newCount,
      learning,
      review,
      mastered,
      percentages: {
        new: pct(newCount),
        learning: pct(learning),
        review: pct(review),
        mastered: pct(mastered),
      },
    };
  });
}

/** Combined payload for GET /stats. */
export async function statsOverview(userId, user, now = new Date()) {
  const [heatmap, forecast, accuracy, jlpt, bestWorst] = await Promise.all([
    heatmap365(userId, user, now),
    forecast30(userId, user, now),
    accuracy30(userId, user, now),
    jlptMastery(userId),
    bestWorstDays(userId, user, now),
  ]);
  return { heatmap, forecast, accuracy, jlpt, bestWorst };
}
