/**
 * Quiz modes — prompt.md §6.6/§7.5/§7.6/§11.1 (DECISIONS.md D13–D16).
 *
 * The server owns the questions, answer keys, drawing scoring, sprint clock,
 * and XP. Practice sessions return all public questions at start but answers
 * must arrive in array order; the sprint returns one question at a time from a
 * pre-generated bank and ends when the clock runs out (or the bank is empty).
 */
import {
  QUIZ_DRAWING,
  QUIZ_MODES,
  QUIZ_SESSION_LENGTH,
  QUIZ_SPRINT_SECONDS,
  QUIZ_XP,
} from '@kanjigarden/shared';
import { ApiError } from '../middleware/errors.js';
import { Kanji } from '../models/Kanji.js';
import { QuizSession, publicQuestion, publicSessionState } from '../models/QuizSession.js';
import { UserProgress } from '../models/UserProgress.js';
import { sampleTemplate, scoreDrawing } from './drawingScore.js';
import { awardXP } from './xp.js';
import { extractStrokes } from './strokes.js';
import { trackQuestEvent } from './quests.js';

const SPRINT_BANK_SIZE = 40;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SPRINT_TIME = Object.freeze({ CORRECT_MS: 3000, WRONG_MS: -5000 });
const MAX_WRONG_TAPS = 999;

const POOL_FIELDS =
  'character meanings readingsOn readingsKun jlptLevel strokeCount hasStrokeOrder strokeOrderSvg';

/** Fisher–Yates on a copy. */
function shuffled(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick(items, rng = Math.random) {
  return items[Math.floor(rng() * items.length)];
}

function hasStrokes(kanji) {
  if (!kanji?.hasStrokeOrder) return false;
  // Overview projections omit the SVG; hasStrokeOrder is then the best signal.
  if (kanji.strokeOrderSvg === undefined) return true;
  return extractStrokes(kanji.strokeOrderSvg).length > 0;
}

/** Whether a kanji can produce a question for this mode. */
export function supportsMode(mode, kanji) {
  if (!kanji) return false;
  if (mode === 'meaning') return (kanji.meanings?.length ?? 0) > 0;
  if (mode === 'reading') {
    return (kanji.readingsOn?.length ?? 0) + (kanji.readingsKun?.length ?? 0) > 0;
  }
  if (mode === 'stroke' || mode === 'drawing') return hasStrokes(kanji);
  if (mode === 'sprint') {
    return (
      (kanji.meanings?.length ?? 0) > 0 &&
      (kanji.readingsOn?.length ?? 0) + (kanji.readingsKun?.length ?? 0) > 0 &&
      hasStrokes(kanji)
    );
  }
  return false;
}

async function trackedKanji(userId, fields = POOL_FIELDS) {
  const rows = await UserProgress.find({
    userId,
    state: { $in: ['learning', 'review', 'relearning'] },
  })
    .select('kanjiId')
    .lean();
  const ids = rows.map((row) => row.kanjiId);
  if (ids.length === 0) return [];
  return Kanji.find({ _id: { $in: ids } })
    .select(fields)
    .lean();
}

/**
 * Practice set (D15): tracked learning/review/relearning kanji, filled from
 * N5 stroke-capable kanji when the tracked pool is short.
 */
async function buildPool(userId, mode, size) {
  const tracked = await trackedKanji(userId);
  const matching = tracked.filter((kanji) => supportsMode(mode, kanji));
  let pool = shuffled(matching);
  const fallback = matching.length < size;

  if (pool.length < size) {
    const exclude = new Set(pool.map((kanji) => kanji.character));
    const candidates = await Kanji.find({
      jlptLevel: 5,
      hasStrokeOrder: true,
      character: { $nin: [...exclude] },
    })
      .select(POOL_FIELDS)
      .limit(300)
      .lean();
    const fill = shuffled(candidates.filter((kanji) => supportsMode(mode, kanji)));
    pool = pool.concat(fill);
  }

  return {
    pool: pool.slice(0, size),
    trackedCount: matching.length,
    fallback,
  };
}

/** Extra kanji used only for plausible distractor meanings/readings. */
async function distractorCandidates() {
  let docs = await Kanji.find({ jlptLevel: 5 })
    .select('character meanings readingsOn readingsKun')
    .limit(400)
    .lean();
  if (docs.length < 8) {
    docs = await Kanji.find().select('character meanings readingsOn readingsKun').limit(400).lean();
  }
  return docs;
}

function optionBase(index) {
  return `q${index + 1}-o`;
}

function buildMeaningQuestion(kanji, index, candidates, rng) {
  const correct = kanji.meanings?.[0];
  if (!correct) return null;

  const texts = new Set([correct]);
  const options = [{ text: correct, readingType: null, correct: true }];
  for (const candidate of shuffled(candidates, rng)) {
    const text = candidate.meanings?.[0];
    if (!text || texts.has(text)) continue;
    texts.add(text);
    options.push({ text, readingType: null, correct: false });
    if (options.length === 4) break;
  }
  if (options.length < 4) return null;

  const ordered = shuffled(options, rng).map((option, i) => ({
    id: `${optionBase(index)}${i + 1}`,
    text: option.text,
    readingType: null,
    correct: option.correct,
  }));
  const answer = ordered.find((option) => option.correct);

  return {
    id: `q${index + 1}`,
    mode: 'meaning',
    kanjiId: kanji._id,
    character: kanji.character,
    meaning: correct,
    readingsOn: kanji.readingsOn ?? [],
    readingsKun: kanji.readingsKun ?? [],
    question: 'What does this mean?',
    options: ordered.map(({ id, text, readingType }) => ({ id, text, readingType })),
    answer: { optionId: answer.id },
    strokeCount: kanji.strokeCount ?? 0,
  };
}

function buildReadingQuestion(kanji, index, candidates, rng) {
  const on = kanji.readingsOn ?? [];
  const kun = kanji.readingsKun ?? [];
  if (on.length === 0 && kun.length === 0) return null;

  const readingType =
    on.length > 0 && kun.length > 0 ? (rng() < 0.5 ? 'on' : 'kun') : on.length > 0 ? 'on' : 'kun';
  const source = readingType === 'on' ? on : kun;
  const correct = pick(source, rng);

  const seen = new Set([correct]);
  const options = [{ text: correct, readingType, correct: true }];
  for (const candidate of shuffled(candidates, rng)) {
    const pairs = [
      ...(candidate.readingsOn ?? []).map((text) => ({ text, readingType: 'on' })),
      ...(candidate.readingsKun ?? []).map((text) => ({ text, readingType: 'kun' })),
    ];
    for (const pair of shuffled(pairs, rng)) {
      if (!pair.text || seen.has(pair.text)) continue;
      seen.add(pair.text);
      options.push({ ...pair, correct: false });
      break;
    }
    if (options.length === 4) break;
  }
  if (options.length < 4) return null;

  const ordered = shuffled(options, rng).map((option, i) => ({
    id: `${optionBase(index)}${i + 1}`,
    text: option.text,
    readingType: option.readingType,
    correct: option.correct,
  }));
  const answer = ordered.find((option) => option.correct);

  return {
    id: `q${index + 1}`,
    mode: 'reading',
    kanjiId: kanji._id,
    character: kanji.character,
    meaning: kanji.meanings?.[0] ?? null,
    readingsOn: on,
    readingsKun: kun,
    question:
      readingType === 'on'
        ? 'What is the on-yomi of this kanji?'
        : 'What is the kun-yomi of this kanji?',
    readingType,
    options: ordered.map(({ id, text, readingType: type }) => ({ id, text, readingType: type })),
    answer: { optionId: answer.id, reading: correct },
    strokeCount: kanji.strokeCount ?? 0,
  };
}

function buildStrokeQuestion(kanji, index, _candidates, rng) {
  const extracted = extractStrokes(kanji.strokeOrderSvg);
  if (extracted.length === 0) return null;
  const strokes = extracted.map((stroke) => ({ id: `s${stroke.n}`, d: stroke.d }));

  return {
    id: `q${index + 1}`,
    mode: 'stroke',
    kanjiId: kanji._id,
    character: null,
    meaning: kanji.meanings?.[0] ?? null,
    readingsOn: kanji.readingsOn ?? [],
    readingsKun: kanji.readingsKun ?? [],
    question: 'Tap the strokes in the correct order.',
    strokeCount: strokes.length,
    strokes: shuffled(strokes, rng),
    answer: { order: strokes.map((stroke) => stroke.id) },
  };
}

function buildDrawingQuestion(kanji, index) {
  const extracted = extractStrokes(kanji.strokeOrderSvg);
  if (extracted.length === 0) return null;
  const template = extracted.map((stroke) => ({ id: String(stroke.n), d: stroke.d }));

  return {
    id: `q${index + 1}`,
    mode: 'drawing',
    kanjiId: kanji._id,
    character: null, // drawn from memory
    meaning: kanji.meanings?.[0] ?? '',
    readingsOn: kanji.readingsOn ?? [],
    readingsKun: kanji.readingsKun ?? [],
    question: 'Draw the kanji from memory.',
    strokeCount: template.length,
    template,
  };
}

function buildQuestion(mode, kanji, index, candidates, rng) {
  if (mode === 'meaning') return buildMeaningQuestion(kanji, index, candidates, rng);
  if (mode === 'reading') return buildReadingQuestion(kanji, index, candidates, rng);
  if (mode === 'stroke') return buildStrokeQuestion(kanji, index, candidates, rng);
  if (mode === 'drawing') return buildDrawingQuestion(kanji, index);
  return null;
}

function buildPracticeQuestions(mode, pool, candidates, rng) {
  const questions = [];
  for (const kanji of shuffled(pool, rng)) {
    if (questions.length === QUIZ_SESSION_LENGTH) break;
    const question = buildQuestion(mode, kanji, questions.length, candidates, rng);
    if (question) questions.push(question);
  }
  return questions;
}

function buildSprintQuestions(pool, candidates, rng) {
  const questions = [];
  const modes = ['meaning', 'reading', 'stroke'];
  let cycle = [];

  for (let i = 0; i < SPRINT_BANK_SIZE; i++) {
    if (cycle.length === 0) cycle = shuffled(modes, rng);
    const mode = cycle.pop();
    const kanji = pool[i % pool.length];
    const question = buildQuestion(mode, kanji, i, candidates, rng);
    if (question) questions.push(question);
  }

  // Ids are positional; skipping an unbuildable kanji must not leave a gap.
  return questions.map((question, i) => ({ ...question, id: `q${i + 1}` }));
}

/** GET /quiz/overview — hub counts + fallback label (D15). */
export async function getQuizOverview(userId) {
  const fields = 'character meanings readingsOn readingsKun jlptLevel hasStrokeOrder';
  const [tracked, n5] = await Promise.all([
    trackedKanji(userId, fields),
    Kanji.find({ jlptLevel: 5, hasStrokeOrder: true }).select(fields).limit(500).lean(),
  ]);

  const modes = {};
  for (const mode of QUIZ_MODES) {
    const trackedCount = tracked.filter((kanji) => supportsMode(mode, kanji)).length;
    const n5Count = n5.filter((kanji) => supportsMode(mode, kanji)).length;
    const target = mode === 'sprint' ? SPRINT_BANK_SIZE : QUIZ_SESSION_LENGTH;
    const available =
      trackedCount >= target ? trackedCount : Math.min(target, trackedCount + n5Count);
    modes[mode] = { available, fallback: trackedCount < target };
  }

  const fallback = ['meaning', 'reading', 'stroke', 'drawing'].some((mode) => modes[mode].fallback);
  return {
    trackedCount: tracked.length,
    fallback,
    label: fallback ? 'practice set' : 'review queue',
    modes,
  };
}

/** POST /quiz/start — create an active session + its server-side answers. */
export async function startQuiz(user, mode, now = new Date()) {
  if (!QUIZ_MODES.includes(mode)) {
    throw new ApiError(400, 'INVALID_QUIZ_MODE', 'Choose a quiz mode from the hub.');
  }
  const isSprint = mode === 'sprint';
  const size = isSprint ? SPRINT_BANK_SIZE : QUIZ_SESSION_LENGTH;
  const { pool, trackedCount, fallback } = await buildPool(user._id, mode, size);
  if (pool.length === 0) {
    throw new ApiError(
      422,
      'QUIZ_POOL_EMPTY',
      'Add a few kanji to your review queue before starting a quiz.'
    );
  }

  const candidates = await distractorCandidates();
  const rng = Math.random;
  const questions = isSprint
    ? buildSprintQuestions(pool, candidates, rng)
    : buildPracticeQuestions(mode, pool, candidates, rng);

  if (questions.length === 0) {
    throw new ApiError(
      422,
      'QUIZ_POOL_EMPTY',
      'None of your kanji can be used for this quiz mode yet.'
    );
  }

  const session = new QuizSession({
    userId: user._id,
    sessionType: mode,
    startedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    questions,
    sprint: isSprint
      ? {
          endsAt: new Date(now.getTime() + QUIZ_SPRINT_SECONDS * 1000),
          remainingMs: QUIZ_SPRINT_SECONDS * 1000,
          lastTickAt: now,
          durationSec: QUIZ_SPRINT_SECONDS,
          bestStreak: 0,
          currentStreak: 0,
        }
      : undefined,
  });
  session.questions[0].servedAt = now;
  await session.save();

  return {
    session: publicSessionState(session),
    question: publicQuestion(session.questions[0]),
    ...(isSprint ? {} : { questions: session.questions.map(publicQuestion) }),
    pool: { trackedCount, fallback },
  };
}

async function loadSession(userId, sessionId, now) {
  const session = await QuizSession.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new ApiError(404, 'QUIZ_NOT_FOUND', 'That quiz session was not found.');
  }
  if (session.status === 'completed') {
    throw new ApiError(409, 'QUIZ_COMPLETED', 'This quiz session is already complete.');
  }
  if (session.status === 'expired' || session.expiresAt <= now) {
    if (session.status !== 'expired') {
      session.status = 'expired';
      await session.save();
    }
    throw new ApiError(409, 'QUIZ_EXPIRED', 'This quiz session has expired. Start a new one.');
  }
  return session;
}

function resultFor(question, score = null) {
  return {
    questionId: question.id,
    kanjiId: question.kanjiId,
    correct: !!question.correct,
    rating: null,
    score,
    responseTimeMs: question.responseTimeMs ?? null,
    wrongTaps: question.wrongTaps ?? 0,
  };
}

function answerResponse(session, question, extra = {}) {
  const next = session.questions[session.results.length] ?? null;
  return {
    session: publicSessionState(session),
    result: question.answeredAt ? resultFor(question, extra.score ?? question.bestScore) : null,
    nextQuestion: next ? publicQuestion(next) : null,
    ...extra,
  };
}

function idempotentChoice(question, optionId) {
  return question.answeredAt && question.taps?.[0] === optionId;
}

function validateOption(question, payload) {
  if (!payload.optionId || !question.options.some((option) => option.id === payload.optionId)) {
    throw new ApiError(400, 'INVALID_ANSWER', 'Choose one of the listed options.');
  }
}

function validateStroke(question, payload) {
  if (!payload.strokeId || !question.strokes.some((stroke) => stroke.id === payload.strokeId)) {
    throw new ApiError(400, 'INVALID_ANSWER', 'Tap one of the strokes shown.');
  }
}

function finishChoice(session, question, payload, now) {
  validateOption(question, payload);
  if (question.answeredAt) {
    if (idempotentChoice(question, payload.optionId)) {
      const correctOptionId = question.answer.optionId;
      return { resumed: true, correctOptionId };
    }
    throw new ApiError(409, 'QUESTION_ANSWERED', 'This question has already been answered.');
  }

  const correct = payload.optionId === question.answer.optionId;
  question.taps = [payload.optionId];
  question.wrongTaps = correct ? 0 : 1;
  question.correct = correct;
  question.answeredAt = now;
  question.responseTimeMs = Math.max(0, now - (question.servedAt ?? now));
  session.results.push(resultFor(question));

  const next = session.questions[session.results.length];
  if (next) next.servedAt = now;
  return { resumed: false, correct, correctOptionId: question.answer.optionId };
}

function finishStrokeTap(session, question, payload, now, immediateFailure) {
  validateStroke(question, payload);
  if (question.answeredAt) {
    throw new ApiError(409, 'QUESTION_ANSWERED', 'This question has already been answered.');
  }

  const expected = question.answer.order[question.taps.length];
  const tapCorrect = payload.strokeId === expected;
  if (tapCorrect) {
    question.taps.push(payload.strokeId);
  } else {
    question.wrongTaps = Math.min(MAX_WRONG_TAPS, (question.wrongTaps ?? 0) + 1);
  }

  const complete =
    question.taps.length >= question.answer.order.length || (!tapCorrect && immediateFailure);
  if (complete) {
    question.correct =
      question.wrongTaps === 0 && question.taps.length === question.answer.order.length;
    question.answeredAt = now;
    question.responseTimeMs = Math.max(0, now - (question.servedAt ?? now));
    session.results.push(resultFor(question));
    const next = session.questions[session.results.length];
    if (next) next.servedAt = now;
  }

  return { tapCorrect, complete, correct: complete ? question.correct : undefined };
}

function finishDrawing(session, question, payload, now) {
  if (question.answeredAt) {
    throw new ApiError(
      409,
      'DRAWING_ATTEMPTS_EXHAUSTED',
      'This drawing has already been checked twice.'
    );
  }
  const template = sampleTemplate(question.template);
  const score = scoreDrawing(template, payload.strokes, { size: QUIZ_DRAWING.CANVAS_SIZE });

  question.attempts = (question.attempts ?? 0) + 1;
  question.bestScore = Math.max(question.bestScore ?? 0, score.score);
  const complete = score.verdict === 'correct' || question.attempts >= QUIZ_DRAWING.MAX_ATTEMPTS;

  if (complete) {
    question.correct = score.verdict === 'correct';
    question.answeredAt = now;
    question.responseTimeMs = Math.max(0, now - (question.servedAt ?? now));
    session.results.push(resultFor(question, question.bestScore));
    const next = session.questions[session.results.length];
    if (next) next.servedAt = now;
  }

  return {
    ...score,
    complete,
    correct: complete ? question.correct : undefined,
    attempts: question.attempts,
    attemptsRemaining: Math.max(0, QUIZ_DRAWING.MAX_ATTEMPTS - question.attempts),
    overlay:
      !question.correct && (score.verdict === 'notQuite' || complete) ? question.template : null,
  };
}

async function answerPractice(session, payload, now) {
  const index = session.results.length;
  const previous = index > 0 ? session.questions[index - 1] : null;

  // A retry can arrive after the server advanced to the next question. MCQ /
  // reading option ids embed the question, so a previous-question id is
  // unambiguous: match = replay, anything else = already answered.
  if (
    previous?.answeredAt &&
    (previous.mode === 'meaning' || previous.mode === 'reading') &&
    payload.optionId &&
    previous.options.some((option) => option.id === payload.optionId)
  ) {
    if (previous.taps?.[0] === payload.optionId) {
      return answerResponse(session, previous, {
        resumed: true,
        correct: previous.correct,
        correctOptionId: previous.answer.optionId,
      });
    }
    throw new ApiError(409, 'QUESTION_ANSWERED', 'This question has already been answered.');
  }

  const question = session.questions[index];
  if (!question) {
    throw new ApiError(409, 'QUIZ_COMPLETE', 'All questions are answered. Submit the session.');
  }

  if (question.mode === 'meaning' || question.mode === 'reading') {
    const outcome = finishChoice(session, question, payload, now);
    if (outcome.resumed) {
      return answerResponse(session, question, outcome);
    }
    await session.save();
    return answerResponse(session, question, outcome);
  }

  if (question.mode === 'stroke') {
    const outcome = finishStrokeTap(session, question, payload, now, false);
    await session.save();
    return answerResponse(session, question, {
      ...outcome,
      progress: question.taps.length,
      total: question.answer.order.length,
      correctOrder: outcome.complete ? question.answer.order : null,
    });
  }

  const outcome = finishDrawing(session, question, payload, now);
  await session.save();
  return answerResponse(session, question, outcome);
}

function sprintRemaining(session, now) {
  const sprint = session.sprint ?? {};
  const anchor = sprint.lastTickAt ?? session.startedAt;
  const elapsed = Math.max(0, now - anchor);
  return Math.max(0, (sprint.remainingMs ?? 0) - elapsed);
}

async function answerSprint(session, payload, now) {
  const index = session.results.length;
  const question = session.questions[index];
  if (!question) {
    throw new ApiError(409, 'SPRINT_EXHAUSTED', 'The sprint bank is empty. Submit the session.');
  }

  const remainingBefore = sprintRemaining(session, now);
  if (remainingBefore <= 0) {
    session.sprint.remainingMs = 0;
    session.sprint.lastTickAt = now;
    session.sprint.endsAt = now;
    await session.save();
    throw new ApiError(409, 'SPRINT_ENDED', 'Time is up. Submit the sprint to see your score.');
  }

  let outcome;
  if (question.mode === 'meaning' || question.mode === 'reading') {
    validateOption(question, payload);
    const correct = payload.optionId === question.answer.optionId;
    question.taps = [payload.optionId];
    question.wrongTaps = correct ? 0 : 1;
    question.correct = correct;
    question.answeredAt = now;
    question.responseTimeMs = Math.max(0, now - (question.servedAt ?? now));
    session.results.push(resultFor(question));
    outcome = {
      correct,
      complete: true,
      tapCorrect: correct,
      correctOptionId: question.answer.optionId,
    };
  } else {
    outcome = finishStrokeTap(session, question, payload, now, true);
  }

  if (!outcome.complete) {
    // Intermediate stroke tap: account for the elapsed time, keep the clock.
    session.sprint.remainingMs = remainingBefore;
    session.sprint.lastTickAt = now;
    session.sprint.endsAt = new Date(now.getTime() + remainingBefore);
    await session.save();
    return answerResponse(session, question, {
      ...outcome,
      timeDeltaMs: 0,
      progress: question.taps.length,
      total: question.answer.order.length,
      correctOrder: null,
    });
  }

  const delta = outcome.correct ? SPRINT_TIME.CORRECT_MS : SPRINT_TIME.WRONG_MS;
  const remaining = Math.max(0, remainingBefore + delta);
  session.sprint.remainingMs = remaining;
  session.sprint.lastTickAt = now;
  session.sprint.endsAt = new Date(now.getTime() + remaining);
  session.sprint.currentStreak = outcome.correct ? session.sprint.currentStreak + 1 : 0;
  session.sprint.bestStreak = Math.max(
    session.sprint.bestStreak ?? 0,
    session.sprint.currentStreak
  );

  const next = session.questions[session.results.length];
  if (next) next.servedAt = now;
  await session.save();

  return answerResponse(session, question, {
    ...outcome,
    timeDeltaMs: delta,
    progress: question.taps.length || undefined,
    total: question.answer.order.length || undefined,
    correctOrder: question.mode === 'stroke' ? question.answer.order : null,
    ended: remaining <= 0 || !next,
  });
}

/** POST /quiz/:sessionId/answer — validate one answer (or one stroke tap). */
export async function answerQuiz(user, sessionId, payload, now = new Date()) {
  const session = await loadSession(user._id, sessionId, now);
  if (session.sessionType === 'sprint') return answerSprint(session, payload, now);
  return answerPractice(session, payload, now);
}

function countQuizResults(session) {
  const answeredCount = session.results.length;
  const correctCount = session.results.filter((result) => result.correct).length;
  const accuracy = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);

  const byId = new Map(session.questions.map((question) => [question.id, question]));
  let perfectStrokeQuestions = 0;
  let highDrawingQuestions = 0;
  for (const result of session.results) {
    const question = byId.get(result.questionId);
    if (!question || !result.correct) continue;
    if (question.mode === 'stroke' && result.wrongTaps === 0) perfectStrokeQuestions += 1;
    if (question.mode === 'drawing' && (result.score ?? 0) >= QUIZ_DRAWING.CORRECT) {
      highDrawingQuestions += 1;
    }
  }

  return { answeredCount, correctCount, accuracy, perfectStrokeQuestions, highDrawingQuestions };
}

function baseQuizXP(sessionType, correctCount, answeredCount) {
  if (sessionType === 'sprint') {
    return answeredCount > 0 ? QUIZ_XP.SPRINT_BASE + QUIZ_XP.SPRINT_PER_CORRECT * correctCount : 0;
  }
  return (
    QUIZ_XP.CORRECT * correctCount +
    (answeredCount >= QUIZ_XP.SESSION_MIN_ANSWERS ? QUIZ_XP.SESSION_COMPLETE : 0)
  );
}

/** POST /quiz/:sessionId/submit — validate, award XP once, persist a replayable summary. */
export async function submitQuiz(user, sessionId, now = new Date()) {
  const session = await QuizSession.findOne({ _id: sessionId, userId: user._id });
  if (!session) {
    throw new ApiError(404, 'QUIZ_NOT_FOUND', 'That quiz session was not found.');
  }
  if (session.submitSummary) return session.submitSummary;
  if (session.status === 'expired') {
    throw new ApiError(409, 'QUIZ_EXPIRED', 'This quiz session has expired. Start a new one.');
  }
  if (session.status === 'completed') {
    throw new ApiError(409, 'QUIZ_COMPLETED', 'This quiz session is already complete.');
  }

  const isSprint = session.sessionType === 'sprint';
  if (isSprint) {
    const remaining = sprintRemaining(session, now);
    const exhausted = session.results.length >= session.questions.length;
    if (remaining > 0 && !exhausted) {
      throw new ApiError(409, 'SPRINT_ACTIVE', 'The sprint timer has not run out yet.');
    }
    if (session.results.length === 0) {
      throw new ApiError(422, 'SPRINT_EMPTY', 'Answer at least one question to earn sprint XP.');
    }
    session.sprint.remainingMs = remaining;
    session.sprint.lastTickAt = now;
    if (remaining <= 0) session.sprint.endsAt = now;
  } else if (session.results.length === 0) {
    throw new ApiError(422, 'QUIZ_EMPTY', 'Answer at least one question before submitting.');
  }

  const counts = countQuizResults(session);
  const sessionCompleted = isSprint
    ? counts.answeredCount >= 1
    : counts.answeredCount >= QUIZ_XP.SESSION_MIN_ANSWERS;
  const baseXP = baseQuizXP(session.sessionType, counts.correctCount, counts.answeredCount);

  // Claim the session exactly once; a concurrent replay sees the stored summary.
  const claimed = await QuizSession.findOneAndUpdate(
    { _id: session._id, status: 'active', submitSummary: null },
    { $set: { status: 'completed', completedAt: now } },
    { new: true }
  );
  if (!claimed) {
    const fresh = await QuizSession.findById(session._id);
    if (fresh?.submitSummary) return fresh.submitSummary;
    throw new ApiError(409, 'QUIZ_COMPLETED', 'This quiz session is already complete.');
  }

  const xp = await awardXP(
    user,
    'quiz',
    {
      sessionType: session.sessionType,
      answeredCount: counts.answeredCount,
      correctCount: counts.correctCount,
      accuracy: counts.accuracy,
      sessionCompleted,
      perfectStrokeQuestions: counts.perfectStrokeQuestions,
      highDrawingQuestions: counts.highDrawingQuestions,
      sprintDurationSec: QUIZ_SPRINT_SECONDS,
      baseXP,
    },
    now
  );

  let questResult = null;
  try {
    questResult = await trackQuestEvent(
      user,
      {
        type: 'quiz',
        quizCompleted: sessionCompleted,
        quizPerfect:
          !isSprint && sessionCompleted && counts.accuracy === 100 && counts.answeredCount >= 10,
        quizMode: session.sessionType,
        dailyXPProgress: xp.dailyXPProgress,
      },
      now
    );
  } catch (err) {
    console.error('quest tracking failed after quiz', err);
  }

  const responseXp = { ...xp };
  if (questResult?.profile) {
    responseXp.totalXP = questResult.profile.totalXP;
    responseXp.level = questResult.profile.level;
    responseXp.xpToNextLevel = questResult.profile.xpToNextLevel;
    responseXp.title = questResult.profile.title;
    responseXp.coins = questResult.profile.coins;
    responseXp.leveledUp = questResult.profile.level > xp.previousLevel;
    const seen = new Set((responseXp.newlyUnlocked ?? []).map((achievement) => achievement.id));
    responseXp.newlyUnlocked = [
      ...(responseXp.newlyUnlocked ?? []),
      ...(questResult.profile.newlyUnlocked ?? []).filter(
        (achievement) => !seen.has(achievement.id)
      ),
    ];
  }

  session.status = 'completed';
  session.completedAt = now;
  session.xpEarned = xp.awarded;
  session.accuracy = counts.accuracy;
  session.correctCount = counts.correctCount;
  session.answeredCount = counts.answeredCount;
  const summary = {
    session: publicSessionState(session),
    mode: session.sessionType,
    answeredCount: counts.answeredCount,
    correctCount: counts.correctCount,
    accuracy: counts.accuracy,
    xpEarned: xp.awarded,
    xp: responseXp,
    bestStreak: session.sprint?.bestStreak ?? 0,
    durationSec: isSprint ? QUIZ_SPRINT_SECONDS : null,
    results: session.results.map((result) => ({
      questionId: result.questionId,
      kanjiId: result.kanjiId,
      correct: result.correct,
      score: result.score,
      responseTimeMs: result.responseTimeMs,
      wrongTaps: result.wrongTaps,
    })),
    quests: questResult?.quests ?? null,
    questCompletions: questResult?.completed ?? [],
    questSweep: questResult?.sweep ?? null,
  };
  session.submitSummary = summary;
  await session.save();
  return summary;
}
