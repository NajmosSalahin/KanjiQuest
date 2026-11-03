import { Schema, model } from 'mongoose';

/**
 * quizSessions — prompt.md §8 (`userId`, `sessionType`, `startedAt`,
 * `completedAt`, `results[]`, `xpEarned`, `accuracy`). Additive Phase 6
 * fields keep the answer keys server-side and make submit idempotent.
 */

const optionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    /** Reading-match options render `<ruby>text<rt>On/Kun</rt></ruby>`. */
    readingType: { type: String, enum: ['on', 'kun', null], default: null },
  },
  { _id: false }
);

const pathSchema = new Schema(
  {
    id: { type: String, required: true },
    d: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    mode: {
      type: String,
      enum: ['meaning', 'reading', 'stroke', 'drawing'],
      required: true,
    },
    kanjiId: { type: Schema.Types.ObjectId, ref: 'Kanji', required: true },

    // Public prompt material (the drawing mode omits `character`).
    character: { type: String, default: null },
    meaning: { type: String, default: null },
    readingsOn: { type: [String], default: [] },
    readingsKun: { type: [String], default: [] },
    question: { type: String, required: true },
    readingType: { type: String, enum: ['on', 'kun', null], default: null },
    options: { type: [optionSchema], default: [] },
    strokes: { type: [pathSchema], default: [] }, // stroke mode, shuffled
    strokeCount: { type: Number, default: 0 },

    // Server-only answer material.
    answer: {
      optionId: { type: String, default: null },
      reading: { type: String, default: null },
      order: { type: [String], default: [] }, // stroke ids in KanjiVG order
    },
    template: { type: [pathSchema], default: [] }, // drawing overlay

    // Progress/result state.
    servedAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
    taps: { type: [String], default: [] },
    wrongTaps: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    bestScore: { type: Number, default: null },
    correct: { type: Boolean, default: null },
    responseTimeMs: { type: Number, default: null },
  },
  { _id: false }
);

const resultSchema = new Schema(
  {
    questionId: { type: String, required: true },
    kanjiId: { type: Schema.Types.ObjectId, ref: 'Kanji', required: true },
    correct: { type: Boolean, required: true },
    rating: { type: Number, default: null }, // §8 field; quizzes have no SRS rating
    score: { type: Number, default: null },
    responseTimeMs: { type: Number, default: null },
    wrongTaps: { type: Number, default: 0 },
  },
  { _id: false }
);

const quizSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionType: {
      type: String,
      enum: ['meaning', 'reading', 'stroke', 'drawing', 'sprint'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired'],
      default: 'active',
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    questions: { type: [questionSchema], default: [] },
    results: { type: [resultSchema], default: [] },
    xpEarned: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },
    sprint: {
      endsAt: { type: Date, default: null },
      remainingMs: { type: Number, default: null },
      /** Anchor for `remainingMs`; the server subtracts (now - lastTickAt). */
      lastTickAt: { type: Date, default: null },
      durationSec: { type: Number, default: null },
      bestStreak: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
    },
    /** Serialized submit response — makes a replay return the same payload. */
    submitSummary: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

quizSessionSchema.index({ userId: 1, startedAt: -1 });
quizSessionSchema.index({ status: 1, expiresAt: 1 });

export const QuizSession = model('QuizSession', quizSessionSchema);

/** Public prompt question — never includes answer keys or the template. */
export function publicQuestion(question) {
  const base = {
    id: question.id,
    mode: question.mode,
    question: question.question,
    strokeCount: question.strokeCount,
  };
  if (question.mode === 'meaning' || question.mode === 'reading') {
    return {
      ...base,
      character: question.character,
      readingType: question.readingType,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        readingType: option.readingType ?? null,
      })),
    };
  }
  if (question.mode === 'stroke') {
    return {
      ...base,
      strokes: question.strokes.map((stroke) => ({ id: stroke.id, d: stroke.d })),
    };
  }
  return {
    ...base,
    meaning: question.meaning,
    readingsOn: question.readingsOn,
    readingsKun: question.readingsKun,
  };
}

/** Progress counters for the hub/session header. */
export function publicSessionState(session) {
  return {
    id: String(session._id),
    mode: session.sessionType,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    totalQuestions: session.sessionType === 'sprint' ? null : session.questions.length,
    answeredCount: session.results.length,
    correctCount: session.results.filter((result) => result.correct).length,
    endsAt: session.sprint?.endsAt ?? null,
    remainingMs: session.sprint?.remainingMs ?? null,
    bestStreak: session.sprint?.bestStreak ?? 0,
  };
}
