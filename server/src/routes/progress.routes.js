import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Kanji } from '../models/Kanji.js';
import { UserProgress, publicProgress } from '../models/UserProgress.js';
import { scheduleReview } from '../services/srs.js';
import { awardXP, refundReviewXP } from '../services/xp.js';
import { ok, noContent, fail } from '../utils/envelope.js';

/** §6.5 undo: client window is 4s; the server backstop is wider to absorb
 *  latency but still kills replayed undos (DECISIONS.md). */
export const UNDO_WINDOW_MS = 10_000;
/** §6.5 suspend ("bury for 7 days"). */
export const SUSPEND_DAYS = 7;

const OID = /^[0-9a-fA-F]{24}$/;

function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return fields;
}

/** Card payload for the §7.2 session front/back (progress + kanji fields). */
function dueCard(progress, kanji) {
  return {
    id: String(progress._id),
    character: kanji.character,
    unicode: kanji.unicode,
    meanings: kanji.meanings,
    readingsOn: kanji.readingsOn,
    readingsKun: kanji.readingsKun,
    mnemonic: kanji.mnemonic,
    hasStrokeOrder: kanji.hasStrokeOrder,
    strokeCount: kanji.strokeCount,
    exampleWords: kanji.exampleWords ?? [],
    state: progress.state,
    interval: progress.interval,
    easeFactor: progress.easeFactor,
    repetitions: progress.repetitions,
    lapses: progress.lapses,
    dueDate: progress.dueDate,
  };
}

export const progressRouter = Router();
export const reviewRouter = Router();

// POST /api/v1/progress/add — start tracking a kanji (§7.4 "Add to review").
progressRouter.post('/add', async (req, res, next) => {
  try {
    const parsed = z.object({ character: z.string().trim().length(1) }).safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }
    const { character } = parsed.data;

    const kanji = await Kanji.findOne({ character }).select('_id').lean();
    if (!kanji) {
      return fail(res, 404, 'KANJI_NOT_FOUND', 'That kanji was not found.');
    }

    const existing = await UserProgress.findOne({ userId: req.userId, kanjiId: kanji._id })
      .select('_id suspendedUntil')
      .lean();
    if (existing) {
      const buried = existing.suspendedUntil && existing.suspendedUntil > new Date();
      return fail(
        res,
        409,
        'ALREADY_IN_REVIEW',
        buried ? 'That kanji is buried right now.' : 'That kanji is already in your review garden.'
      );
    }

    const progress = await UserProgress.create({
      userId: req.userId,
      kanjiId: kanji._id,
      state: 'new',
      dueDate: new Date(),
    });
    return ok(res, { progress: publicProgress(progress) }, 201);
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/progress/due — today's queue, capped by dailyReviewLimit (§6.5).
progressRouter.get('/due', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('preferences').lean();
    const limit = user?.preferences?.dailyReviewLimit ?? 20;
    const now = new Date();

    const dueFilter = {
      userId: req.userId,
      dueDate: { $lte: now },
      $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: now } }],
    };
    const [progressDocs, total] = await Promise.all([
      UserProgress.find(dueFilter).sort({ dueDate: 1 }).limit(limit).lean(),
      UserProgress.countDocuments(dueFilter),
    ]);

    const kanjiIds = progressDocs.map((p) => p.kanjiId);
    const kanjiDocs = kanjiIds.length
      ? await Kanji.find({ _id: { $in: kanjiIds } })
          .select(
            'character unicode meanings readingsOn readingsKun mnemonic hasStrokeOrder strokeCount exampleWords'
          )
          .lean()
      : [];
    const byId = new Map(kanjiDocs.map((k) => [String(k._id), k]));

    const items = progressDocs
      .map((p) => byId.get(String(p.kanjiId)) && dueCard(p, byId.get(String(p.kanjiId))))
      .filter(Boolean);

    // Empty state (§7.2): "Next review is scheduled for 14:30 today" — the
    // earliest unsuspended future due, null when nothing is tracked.
    let nextDueAt = null;
    if (items.length === 0) {
      const next = await UserProgress.findOne({
        userId: req.userId,
        dueDate: { $gt: now },
        $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: now } }],
      })
        .sort({ dueDate: 1 })
        .select('dueDate')
        .lean();
      nextDueAt = next?.dueDate ?? null;
    }

    return ok(res, { items, total, limit, nextDueAt });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/progress/review — submit a rating (§9): SRS update + XP.
progressRouter.post('/review', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        cardId: z.string().regex(OID, 'Unknown card.'),
        rating: z.number().int().min(0).max(3),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the highlighted fields.',
        zodFields(parsed.error)
      );
    }
    const { cardId, rating } = parsed.data;

    const progress = await UserProgress.findOne({ _id: cardId, userId: req.userId });
    if (!progress) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That card is not in your review garden.');
    }
    if (progress.suspendedUntil && progress.suspendedUntil > new Date()) {
      return fail(res, 409, 'CARD_SUSPENDED', 'That card is buried right now.');
    }

    const user = await User.findById(req.userId).select('timezone preferences').lean();
    const now = new Date();
    const previous = {
      state: progress.state,
      interval: progress.interval,
      easeFactor: progress.easeFactor,
      repetitions: progress.repetitions,
      lapses: progress.lapses,
      dueDate: progress.dueDate,
    };

    const nextCard = scheduleReview(
      {
        state: progress.state,
        interval: progress.interval,
        easeFactor: progress.easeFactor,
        repetitions: progress.repetitions,
        lapses: progress.lapses,
      },
      rating,
      now.getTime()
    );

    const xp = await awardXP(user, 'review', { rating }, now);

    progress.state = nextCard.state;
    progress.interval = nextCard.interval;
    progress.easeFactor = nextCard.easeFactor;
    progress.repetitions = nextCard.repetitions;
    progress.lapses = nextCard.lapses;
    progress.dueDate = new Date(nextCard.dueDate);
    progress.lastReviewedAt = now;
    progress.history.push({
      reviewedAt: now,
      rating,
      previousInterval: previous.interval,
      newInterval: nextCard.interval,
      xpAwarded: xp.awarded,
      previous,
      gami: xp.gami, // Phase 4 counters snapshot — exact undo restore
    });
    if (progress.history.length > 100) progress.history = progress.history.slice(-100);
    await progress.save();

    return ok(res, { progress: publicProgress(progress), xp });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/review/:cardId/undo — compensate the last review (§6.5).
reviewRouter.post('/:cardId/undo', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    if (!OID.test(cardId)) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That card is not in your review garden.');
    }

    const progress = await UserProgress.findOne({ _id: cardId, userId: req.userId });
    const last = progress?.history?.[progress.history.length - 1];
    if (!progress || !last) {
      return fail(res, 409, 'NOTHING_TO_UNDO', 'There is no review to undo.');
    }
    if (Date.now() - last.reviewedAt.getTime() > UNDO_WINDOW_MS) {
      return fail(res, 409, 'UNDO_WINDOW_CLOSED', 'The undo window has passed.');
    }

    const user = await User.findById(req.userId).select('timezone preferences').lean();
    const refund = await refundReviewXP(user, last.xpAwarded ?? 0, last.gami);

    progress.state = last.previous.state;
    progress.interval = last.previous.interval;
    progress.easeFactor = last.previous.easeFactor;
    progress.repetitions = last.previous.repetitions;
    progress.lapses = last.previous.lapses;
    progress.dueDate = last.previous.dueDate;
    progress.lastReviewedAt = null;
    progress.history.pop();
    await progress.save();

    return ok(res, { progress: publicProgress(progress), xp: refund });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/review/:cardId/suspend — bury for 7 days (§6.5).
reviewRouter.post('/:cardId/suspend', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    if (!OID.test(cardId)) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That card is not in your review garden.');
    }

    const progress = await UserProgress.findOne({ _id: cardId, userId: req.userId });
    if (!progress) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That card is not in your review garden.');
    }

    progress.suspendedUntil = new Date(Date.now() + SUSPEND_DAYS * 24 * 60 * 60 * 1000);
    await progress.save();

    return ok(res, { progress: publicProgress(progress) });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/progress/stats — review-garden numbers (§9).
progressRouter.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    // Aggregations need the real ObjectId — unlike find(), $match won't cast.
    const match = { userId: new Types.ObjectId(req.userId) };

    const [stateGroups, dueNow, suspended, mastered, reviews] = await Promise.all([
      UserProgress.aggregate([
        { $match: match },
        { $group: { _id: '$state', count: { $sum: 1 } } },
      ]),
      UserProgress.countDocuments({
        ...match,
        dueDate: { $lte: now },
        $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: now } }],
      }),
      UserProgress.countDocuments({ ...match, suspendedUntil: { $gt: now } }),
      UserProgress.countDocuments({ ...match, state: 'review', interval: { $gte: 180 } }),
      UserProgress.aggregate([
        { $match: match },
        { $unwind: '$history' },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            goodOrBetter: { $sum: { $cond: [{ $gte: ['$history.rating', 2] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
    let total = 0;
    for (const g of stateGroups) {
      byState[g._id] = g.count;
      total += g.count;
    }
    const totals = reviews[0] ?? { total: 0, goodOrBetter: 0 };

    return ok(res, {
      total,
      byState,
      dueNow,
      suspended,
      mastered,
      totalReviews: totals.total,
      accuracy: totals.total > 0 ? totals.goodOrBetter / totals.total : null,
    });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/progress/:character — D8 "Remove from review" (§7.4).
progressRouter.delete('/:character', async (req, res, next) => {
  try {
    const character = req.params.character;
    if ([...character].length !== 1) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Provide a single kanji character.');
    }
    const kanji = await Kanji.findOne({ character }).select('_id').lean();
    if (!kanji) {
      return fail(res, 404, 'KANJI_NOT_FOUND', 'That kanji was not found.');
    }
    const removed = await UserProgress.findOneAndDelete({ userId: req.userId, kanjiId: kanji._id });
    if (!removed) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That kanji is not in your review garden.');
    }
    return noContent(res);
  } catch (err) {
    return next(err);
  }
});
