import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { LEVEL_TITLES } from '@kanjigarden/shared';
import { User } from '../models/User.js';
import { Kanji } from '../models/Kanji.js';
import { UserProgress, publicProgress } from '../models/UserProgress.js';
import { UserQuest } from '../models/UserQuest.js';
import { ReviewEvent } from '../models/ReviewEvent.js';
import { ensureGamificationProfile } from '../models/GamificationProfile.js';
import { scheduleReview } from '../services/srs.js';
import { awardXP, refundReviewXP } from '../services/xp.js';
import { trackQuestEvent } from '../services/quests.js';
import { localDay } from '../services/time.js';
import { ok, noContent, fail } from '../utils/envelope.js';

/** §6.5 undo: client window is 4s; the server backstop is wider to absorb
 *  latency but still kills replayed undos (DECISIONS.md). */
export const UNDO_WINDOW_MS = 10_000;
/** §6.5 suspend ("bury for 7 days"). */
export const SUSPEND_DAYS = 7;
/** D24: offline reviews are accepted up to 24 hours after the local rating. */
export const OFFLINE_REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Small clock-skew allowance for reviewedAt values from the client. */
export const REVIEW_FUTURE_SKEW_MS = 2 * 60 * 1000;

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

/** D24 duplicate reply - the review was already applied; never award twice. */
async function duplicateReviewResponse(req, res, user, event) {
  if (!event) return null;
  if (String(event.cardId) !== String(req.body.cardId) || event.rating !== req.body.rating) {
    return fail(
      res,
      409,
      'REVIEW_EVENT_CONFLICT',
      'That review id was already used for a different rating.'
    );
  }
  const progress = await UserProgress.findOne({ _id: event.cardId, userId: req.userId });
  if (!progress) {
    return fail(res, 409, 'REVIEW_EVENT_CONFLICT', 'That review is no longer in your garden.');
  }
  const profile = await ensureGamificationProfile(req.userId, user?.preferences?.dailyGoalXP ?? 50);
  return ok(res, {
    progress: publicProgress(progress),
    xp: {
      awarded: 0,
      bonuses: [],
      totalXP: profile.totalXP,
      dailyXPProgress: profile.dailyXPProgress,
      dailyGoalXP: profile.dailyGoalXP,
      currentStreak: profile.currentStreak,
      level: profile.currentLevel,
      xpToNextLevel: profile.xpToNextLevel,
      title: LEVEL_TITLES[profile.currentLevel - 1],
      previousLevel: profile.currentLevel,
      leveledUp: false,
      coins: profile.coins,
      currentPerfectRun: profile.currentPerfectRun,
      streakMilestone: null,
      newlyUnlocked: [],
    },
    quests: null,
    questCompletions: [],
    questSweep: null,
    duplicate: true,
    timestampAdjusted: false,
  });
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
    if (progress?._id) {
      // Creating the rows here means the dashboard's quest card is populated
      // before the first review. No progress is applied for an add event.
      try {
        const user = await User.findById(req.userId).select('timezone preferences').lean();
        await trackQuestEvent(user, { type: 'add' }, new Date());
      } catch (err) {
        console.error('quest tracking failed after add', err);
      }
    }
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
        eventId: z
          .string()
          .min(8)
          .max(64)
          .regex(/^[A-Za-z0-9_-]+$/)
          .optional(),
        reviewedAt: z.string().datetime({ offset: true }).optional(),
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
    const { cardId, rating, eventId } = parsed.data;
    const requestNow = new Date();
    const user = await User.findById(req.userId).select('timezone preferences').lean();

    // D24 idempotency: a retried event returns the current state without
    // applying XP, quests, history, or streak a second time. Checked before
    // the age window so a lost response can still be re-acknowledged later.
    if (eventId) {
      const existing = await ReviewEvent.findOne({ userId: req.userId, eventId }).lean();
      if (existing) {
        const duplicate = await duplicateReviewResponse(req, res, user, existing);
        return duplicate ?? fail(res, 409, 'REVIEW_EVENT_CONFLICT', 'That review id is in use.');
      }
    }

    let reviewedAt = requestNow;
    if (parsed.data.reviewedAt) {
      const candidate = new Date(parsed.data.reviewedAt);
      if (candidate.getTime() > requestNow.getTime() + REVIEW_FUTURE_SKEW_MS) {
        return fail(res, 422, 'INVALID_REVIEW_TIME', 'That review time is in the future.');
      }
      if (candidate.getTime() < requestNow.getTime() - OFFLINE_REVIEW_MAX_AGE_MS) {
        return fail(
          res,
          422,
          'REVIEW_TOO_OLD',
          'Offline reviews can only be saved within 24 hours.'
        );
      }
      reviewedAt = candidate > requestNow ? requestNow : candidate;
    }

    const progress = await UserProgress.findOne({ _id: cardId, userId: req.userId });
    if (!progress) {
      return fail(res, 404, 'PROGRESS_NOT_FOUND', 'That card is not in your review garden.');
    }
    if (progress.suspendedUntil && progress.suspendedUntil > requestNow) {
      return fail(res, 409, 'CARD_SUSPENDED', 'That card is buried right now.');
    }

    // D24: SRS/history use when the learner actually rated. Gamification uses
    // that moment too, unless it would move backwards past the profile's
    // current activity day (which would rewind the daily bucket/streak).
    const profile = await ensureGamificationProfile(
      req.userId,
      user?.preferences?.dailyGoalXP ?? 50
    );
    const activityDay = [
      profile.lastActivityDate,
      profile.lastReviewDate,
      profile.dailyXPDate,
      profile.dailyCountersDate,
    ]
      .filter(Boolean)
      .sort()
      .at(-1);
    const reviewDay = localDay(reviewedAt, user.timezone ?? 'UTC');
    const timestampAdjusted = Boolean(activityDay && reviewDay < activityDay);
    const gamificationNow = timestampAdjusted ? requestNow : reviewedAt;

    let eventDoc = null;
    if (eventId) {
      try {
        eventDoc = await ReviewEvent.create({
          userId: req.userId,
          eventId,
          cardId,
          rating,
          reviewedAt,
        });
      } catch (err) {
        if (err?.code === 11000) {
          const existing = await ReviewEvent.findOne({ userId: req.userId, eventId }).lean();
          const duplicate = await duplicateReviewResponse(req, res, user, existing);
          return duplicate ?? fail(res, 409, 'REVIEW_EVENT_CONFLICT', 'That review id is in use.');
        }
        throw err;
      }
    }

    try {
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
        reviewedAt.getTime()
      );

      const wasNew = !(Array.isArray(progress.history) && progress.history.length > 0);
      const xp = await awardXP(user, 'review', { rating }, gamificationNow);

      progress.state = nextCard.state;
      progress.interval = nextCard.interval;
      progress.easeFactor = nextCard.easeFactor;
      progress.repetitions = nextCard.repetitions;
      progress.lapses = nextCard.lapses;
      progress.dueDate = new Date(nextCard.dueDate);
      progress.lastReviewedAt = reviewedAt;
      progress.history.push({
        reviewedAt,
        rating,
        previousInterval: previous.interval,
        newInterval: nextCard.interval,
        xpAwarded: xp.awarded,
        previous,
        gami: xp.gami, // Phase 4 counters snapshot — exact undo restore
      });
      if (progress.history.length > 100) progress.history = progress.history.slice(-100);
      await progress.save();

      // Quest tracking happens after the SRS write so "clear the queue" can see
      // the post-review due count. A quest failure must never lose the review.
      const dueAfter = await UserProgress.countDocuments({
        userId: req.userId,
        dueDate: { $lte: requestNow },
        $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: requestNow } }],
      });
      let questResult = null;
      try {
        questResult = await trackQuestEvent(
          user,
          {
            type: 'review',
            rating,
            wasNew,
            dueCleared: dueAfter === 0,
            dailyXPProgress: xp.dailyXPProgress,
          },
          gamificationNow
        );
      } catch (err) {
        console.error('quest tracking failed after review', err);
      }

      // Snapshot today's quest rows + the direct XP/coin rewards from this
      // review so undo can restore quest state without touching achievement
      // unlocks (which are permanent, §6.5/§11.3).
      if (questResult) {
        const entry = progress.history[progress.history.length - 1];
        entry.questUndo = {
          date: questResult.quests[0]?.date ?? null,
          rows: (questResult.beforeQuests ?? []).map((row) => ({
            _id: String(row._id),
            progress: row.progress,
            completed: row.completed,
            completedAt: row.completedAt,
            rewardClaimed: row.rewardClaimed,
            xpAwarded: row.xpAwarded,
            coinsAwarded: row.coinsAwarded,
            sweepAwarded: row.sweepAwarded,
          })),
          questXP: questResult.questXP ?? 0,
          questCoins: questResult.questCoins ?? 0,
          sweepXP: questResult.sweep?.awarded ?? 0,
        };
        await progress.save();
      }

      const responseXp = { ...xp };
      if (questResult?.profile) {
        responseXp.totalXP = questResult.profile.totalXP;
        responseXp.level = questResult.profile.level;
        responseXp.xpToNextLevel = questResult.profile.xpToNextLevel;
        responseXp.title = questResult.profile.title;
        responseXp.coins = questResult.profile.coins;
        responseXp.leveledUp = questResult.profile.level > xp.previousLevel;
        const seen = new Set((responseXp.newlyUnlocked ?? []).map((a) => a.id));
        responseXp.newlyUnlocked = [
          ...(responseXp.newlyUnlocked ?? []),
          ...(questResult.profile.newlyUnlocked ?? []).filter((a) => !seen.has(a.id)),
        ];
      }

      return ok(res, {
        progress: publicProgress(progress),
        xp: responseXp,
        quests: questResult?.quests ?? null,
        questCompletions: questResult?.completed ?? [],
        questSweep: questResult?.sweep ?? null,
        duplicate: false,
        timestampAdjusted,
        reviewedAt: reviewedAt.toISOString(),
      });
    } catch (err) {
      // Do not leave a reservation that would turn a failed review into a
      // silent duplicate on retry.
      if (eventDoc) await ReviewEvent.deleteOne({ _id: eventDoc._id }).catch(() => {});
      throw err;
    }
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
    const questUndo = last.questUndo;
    if (questUndo?.rows?.length) {
      await UserQuest.bulkWrite(
        questUndo.rows.map((row) => ({
          updateOne: {
            filter: { _id: row._id, userId: req.userId },
            update: {
              $set: {
                progress: row.progress ?? 0,
                completed: !!row.completed,
                completedAt: row.completedAt ?? null,
                rewardClaimed: !!row.rewardClaimed,
                xpAwarded: row.xpAwarded ?? 0,
                coinsAwarded: row.coinsAwarded ?? 0,
                sweepAwarded: !!row.sweepAwarded,
              },
            },
          },
        }))
      );
    }
    const refund = await refundReviewXP(user, last.xpAwarded ?? 0, last.gami, {
      xp: (questUndo?.questXP ?? 0) + (questUndo?.sweepXP ?? 0),
      coins: questUndo?.questCoins ?? 0,
    });

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
