import { Router } from 'express';
import { z } from 'zod';
import { QUIZ_DRAWING, QUIZ_MODES } from '@kanjigarden/shared';
import { User } from '../models/User.js';
import { getQuizOverview, startQuiz, answerQuiz, submitQuiz } from '../services/quiz.js';
import { ok, fail } from '../utils/envelope.js';

export const quizRouter = Router();

const OID = /^[a-f\d]{24}$/i;

function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return fields;
}

async function loadUser(userId) {
  return User.findById(userId).select('timezone preferences').lean();
}

function sessionIdOrFail(req, res) {
  if (!OID.test(req.params.sessionId)) {
    fail(res, 404, 'QUIZ_NOT_FOUND', 'That quiz session was not found.');
    return null;
  }
  return req.params.sessionId;
}

const pointSchema = z.object({
  x: z.number().finite().min(0).max(QUIZ_DRAWING.CANVAS_SIZE),
  y: z.number().finite().min(0).max(QUIZ_DRAWING.CANVAS_SIZE),
});

const answerSchema = z
  .object({
    optionId: z.string().min(1).max(40).optional(),
    strokeId: z.string().min(1).max(40).optional(),
    strokes: z.array(z.array(pointSchema).max(500)).max(60).optional(),
  })
  .refine((value) => value.optionId || value.strokeId || value.strokes, {
    message: 'Submit an answer.',
  });

// GET /api/v1/quiz/overview — hub counts + practice-set fallback (D15).
quizRouter.get('/overview', async (req, res, next) => {
  try {
    return ok(res, await getQuizOverview(req.userId));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/quiz/start — create a session (§9).
quizRouter.post('/start', async (req, res, next) => {
  try {
    const parsed = z.object({ mode: z.enum(QUIZ_MODES) }).safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Choose a quiz mode from the hub.',
        zodFields(parsed.error)
      );
    }
    const user = await loadUser(req.userId);
    return ok(res, await startQuiz(user, parsed.data.mode), 201);
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/quiz/:sessionId/answer — one choice, one stroke tap, or one drawing check.
quizRouter.post('/:sessionId/answer', async (req, res, next) => {
  try {
    const sessionId = sessionIdOrFail(req, res);
    if (!sessionId) return undefined;
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Check the answer you submitted.',
        zodFields(parsed.error)
      );
    }
    const user = await loadUser(req.userId);
    return ok(res, await answerQuiz(user, sessionId, parsed.data));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/quiz/:sessionId/submit — finalize, award XP, return the summary.
quizRouter.post('/:sessionId/submit', async (req, res, next) => {
  try {
    const sessionId = sessionIdOrFail(req, res);
    if (!sessionId) return undefined;
    const user = await loadUser(req.userId);
    return ok(res, await submitQuiz(user, sessionId));
  } catch (err) {
    return next(err);
  }
});
