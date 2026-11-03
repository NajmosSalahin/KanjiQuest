import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { GamificationProfile } from '../src/models/GamificationProfile.js';
import { Kanji } from '../src/models/Kanji.js';
import { QuizSession } from '../src/models/QuizSession.js';
import { User } from '../src/models/User.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { samplePath } from '../src/services/drawingScore.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });
const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };
const CANVAS = 300;
const TEMPLATE = 109;
let mongod;

const CHARACTERS = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '水',
  '火',
  '木',
  '金',
  '土',
];

function strokeSvg(first, second) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109">
  <g id="kvg:StrokePaths_test">
    <g id="kvg:test" kvg:element="x">
      <path id="kvg:test-s1" d="${first}"/>
      <path id="kvg:test-s2" d="${second}"/>
    </g>
  </g>
</svg>`;
}

async function seedKanji(count = 15) {
  const docs = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      character: CHARACTERS[i],
      unicode: (0x4e00 + i).toString(16),
      meanings: [`meaning-${i}`],
      readingsOn: [`on-${i}`],
      readingsKun: [`kun-${i}`],
      jlptLevel: 5,
      strokeCount: 2,
      hasStrokeOrder: true,
      strokeOrderSvg: strokeSvg('M10 20 L90 20', 'M50 30 L50 90'),
    });
  }
  return Kanji.insertMany(docs);
}

function cookieHeader(res) {
  const raw = res.headers['set-cookie'] ?? [];
  return raw.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function signUp(email = 'quiz@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set(csrfHeaders)
    .send({ email, password: 'garden123', displayName: 'Quiz Tester' });
  expect(res.status).toBe(201);
  const user = await User.findOne({ email });
  return { jar: cookieHeader(res), user };
}

async function track(user, kanjiDocs) {
  await UserProgress.insertMany(
    kanjiDocs.map((kanji) => ({
      userId: user._id,
      kanjiId: kanji._id,
      state: 'learning',
      dueDate: new Date(),
    }))
  );
}

function answer(app, jar, sessionId, body) {
  return request(app)
    .post(`/api/v1/quiz/${sessionId}/answer`)
    .set(csrfHeaders)
    .set('Cookie', jar)
    .send(body);
}

function submit(app, jar, sessionId) {
  return request(app).post(`/api/v1/quiz/${sessionId}/submit`).set(csrfHeaders).set('Cookie', jar);
}

async function currentSession(user) {
  return QuizSession.findOne({ userId: user._id }).sort({ startedAt: -1 });
}

beforeAll(async () => {
  mongod = await startTestDb();
});

afterAll(async () => {
  await stopTestDb(mongod);
});

beforeEach(async () => {
  await clearDb();
});

describe('GET /api/v1/quiz/overview (D15)', () => {
  it('requires auth and reports fallback counts without tracking', async () => {
    expect((await request(app).get('/api/v1/quiz/overview')).status).toBe(401);

    const { jar } = await signUp();
    await seedKanji();
    const res = await request(app).get('/api/v1/quiz/overview').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      trackedCount: 0,
      fallback: true,
      label: 'practice set',
    });
    expect(res.body.data.modes.meaning).toEqual({ available: 10, fallback: true });
    expect(res.body.data.modes.sprint.available).toBe(15);
  });

  it('uses the review-queue label once ten tracked kanji support each practice mode', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const res = await request(app).get('/api/v1/quiz/overview').set('Cookie', jar);
    expect(res.status).toBe(200);
    expect(res.body.data.trackedCount).toBe(15);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.label).toBe('review queue');
    expect(res.body.data.modes.meaning).toEqual({ available: 15, fallback: false });
  });
});

describe('POST /api/v1/quiz/start', () => {
  it('422s when neither the review queue nor N5 fallback has kanji', async () => {
    const { jar } = await signUp();
    const res = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'meaning' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('QUIZ_POOL_EMPTY');
  });

  it('rejects an unknown mode and 401s without a session', async () => {
    const { jar } = await signUp();
    await seedKanji();

    const bad = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'typing' });
    expect(bad.status).toBe(400);

    const anon = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .send({ mode: 'meaning' });
    expect(anon.status).toBe(401);
  });
});

describe('meaning practice session (§7.6)', () => {
  it('serves 10 questions without answers, enforces order, and awards XP once', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'meaning' });
    expect(start.status).toBe(201);
    expect(start.body.data.questions).toHaveLength(10);
    expect(start.body.data.session.totalQuestions).toBe(10);
    for (const question of start.body.data.questions) {
      expect(question).toMatchObject({ mode: 'meaning', character: expect.any(String) });
      expect(question.options).toHaveLength(4);
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('template');
    }

    const session = await currentSession(user);
    const first = session.questions[0];
    const q1 = session.questions[0].answer.optionId;

    const correct = await answer(app, jar, session._id, { optionId: q1 });
    expect(correct.status).toBe(200);
    expect(correct.body.data.correct).toBe(true);
    expect(correct.body.data.correctOptionId).toBe(q1);
    expect(correct.body.data.session.answeredCount).toBe(1);

    // Network retry of the same choice is idempotent, not a second answer.
    const replay = await answer(app, jar, session._id, { optionId: q1 });
    expect(replay.status).toBe(200);
    expect(replay.body.data.correct).toBe(true);
    expect(replay.body.data.session.answeredCount).toBe(1);

    const different = first.options.find((option) => option.id !== q1);
    const conflict = await answer(app, jar, session._id, { optionId: different.id });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('QUESTION_ANSWERED');

    // Answers arrive in array order: q3's option id is not an option on q2.
    const outOfOrder = await answer(app, jar, session._id, {
      optionId: session.questions[2].answer.optionId,
    });
    expect(outOfOrder.status).toBe(400);
    expect(outOfOrder.body.error.code).toBe('INVALID_ANSWER');

    for (let i = 1; i < session.questions.length; i++) {
      const res = await answer(app, jar, session._id, {
        optionId: session.questions[i].answer.optionId,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(true);
    }

    const done = await submit(app, jar, session._id);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({
      mode: 'meaning',
      answeredCount: 10,
      correctCount: 10,
      accuracy: 100,
      xpEarned: 100, // 5×10 correct + 20 session + 30 daily goal
    });
    expect(done.body.data.xp.bonuses).toContain('goalMet');
    expect(done.body.data.xp.dailyXPProgress).toBe(100);
    expect(done.body.data.xp.newlyUnlocked.map((a) => a.id)).toContain('kanpeki');

    const profile = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(profile.currentStreak).toBe(0); // quiz XP never touches the streak (D13)
    expect(profile.dailyXPProgress).toBe(100);
    expect(profile.dailyXPDate).toBe(new Date().toISOString().slice(0, 10));
    expect(profile.totalXP).toBeGreaterThanOrEqual(250);

    // Replaying submit returns the stored payload and never double-awards.
    const totalBefore = profile.totalXP;
    const again = await submit(app, jar, session._id);
    expect(again.status).toBe(200);
    expect(again.body.data.xpEarned).toBe(100);
    const after = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(after.totalXP).toBe(totalBefore);
  });
});

describe('reading + stroke practice', () => {
  it('renders reading options with on/kun ruby tags', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'reading' });
    expect(start.status).toBe(201);
    const session = await currentSession(user);
    for (const [index, question] of start.body.data.questions.entries()) {
      expect(question.readingType).toMatch(/^(on|kun)$/);
      expect(question.options).toHaveLength(4);
      for (const option of question.options) {
        expect(option.readingType).toMatch(/^(on|kun)$/);
      }
      const correct = question.options.find(
        (option) => option.id === session.questions[index].answer.optionId
      );
      expect(correct.text).toBe(session.questions[index].answer.reading);
      expect(correct.readingType).toBe(question.readingType);
    }

    const res = await answer(app, jar, session._id, {
      optionId: session.questions[0].answer.optionId,
    });
    expect(res.status).toBe(200);
    const done = await submit(app, jar, session._id);
    expect(done.status).toBe(200);
    expect(done.body.data.xpEarned).toBe(5); // one correct, no completion bonus
  });

  it('taps strokes in order; any wrong tap makes that question incorrect', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'stroke' });
    expect(start.status).toBe(201);
    for (const question of start.body.data.questions) {
      expect(question.mode).toBe('stroke');
      expect(question.strokes).toHaveLength(2);
      expect(question).not.toHaveProperty('answer');
    }

    const session = await currentSession(user);
    const order = session.questions[0].answer.order;

    const wrong = await answer(app, jar, session._id, { strokeId: order[1] });
    expect(wrong.status).toBe(200);
    expect(wrong.body.data).toMatchObject({ tapCorrect: false, complete: false, progress: 0 });

    let last;
    for (const strokeId of order) {
      last = await answer(app, jar, session._id, { strokeId });
    }
    expect(last.body.data).toMatchObject({ tapCorrect: true, complete: true });
    expect(last.body.data.result.correct).toBe(false);
    expect(last.body.data.correctOrder).toEqual(order);

    for (const strokeId of session.questions[1].answer.order) {
      last = await answer(app, jar, session._id, { strokeId });
    }
    expect(last.body.data.result.correct).toBe(true);

    const done = await submit(app, jar, session._id);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ answeredCount: 2, correctCount: 1, xpEarned: 5 });

    const profile = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(profile.perfectStrokeQuestions).toBe(1);
  });
});

describe('drawing practice (§7.6)', () => {
  it('scores server-side, allows two checks, and overlays after a miss', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'drawing' });
    expect(start.status).toBe(201);
    for (const question of start.body.data.questions) {
      expect(question.mode).toBe('drawing');
      expect(question.character).toBeUndefined();
      expect(question).not.toHaveProperty('template');
    }

    const session = await currentSession(user);

    const miss = await answer(app, jar, session._id, { strokes: [] });
    expect(miss.status).toBe(200);
    expect(miss.body.data).toMatchObject({
      verdict: 'notQuite',
      complete: false,
      attempts: 1,
      attemptsRemaining: 1,
    });
    expect(miss.body.data.overlay).toHaveLength(2);

    const missAgain = await answer(app, jar, session._id, { strokes: [] });
    expect(missAgain.status).toBe(200);
    expect(missAgain.body.data).toMatchObject({ complete: true, attempts: 2 });
    expect(missAgain.body.data.result.correct).toBe(false);

    const template = session.questions[1].template;
    const traced = template.map((stroke) =>
      samplePath(stroke.d).map((point) => ({
        x: (point.x / TEMPLATE) * CANVAS,
        y: (point.y / TEMPLATE) * CANVAS,
      }))
    );
    const hit = await answer(app, jar, session._id, { strokes: traced });
    expect(hit.status).toBe(200);
    expect(hit.body.data.verdict).toBe('correct');
    expect(hit.body.data).toMatchObject({ complete: true, correct: true });
    expect(hit.body.data.score).toBeGreaterThanOrEqual(85);
    expect(hit.body.data.overlay).toBeNull();

    const done = await submit(app, jar, session._id);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ answeredCount: 2, correctCount: 1, xpEarned: 5 });

    const profile = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(profile.highDrawingQuestions).toBe(1);
  });
});

describe('60-second sprint (§7.6/§11.1)', () => {
  it('streams one question at a time, adjusts time, and only submits at 0s', async () => {
    const { jar, user } = await signUp();
    const kanji = await seedKanji();
    await track(user, kanji);

    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'sprint' });
    expect(start.status).toBe(201);
    expect(start.body.data.questions).toBeUndefined();
    expect(start.body.data.question).toBeTruthy();
    expect(start.body.data.session.totalQuestions).toBeNull();
    expect(start.body.data.session.remainingMs).toBe(60_000);

    const session = await currentSession(user);
    expect(session.questions.length).toBeGreaterThanOrEqual(40);
    expect(session.sprint.durationSec).toBe(60);

    let last;
    for (let i = 0; i < 2; i++) {
      const question = session.questions[i];
      if (question.mode === 'meaning' || question.mode === 'reading') {
        last = await answer(app, jar, session._id, { optionId: question.answer.optionId });
        expect(last.body.data).toMatchObject({ complete: true, correct: true, timeDeltaMs: 3000 });
      } else {
        for (const strokeId of question.answer.order) {
          last = await answer(app, jar, session._id, { strokeId });
        }
        expect(last.body.data).toMatchObject({ complete: true, correct: true, timeDeltaMs: 3000 });
      }
      expect(last.body.data.nextQuestion).toBeTruthy();
    }
    expect(last.body.data.session.bestStreak).toBe(2);

    const early = await submit(app, jar, session._id);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('SPRINT_ACTIVE');

    // Let the server clock hit zero, then finalize.
    await QuizSession.updateOne(
      { _id: session._id },
      {
        $set: {
          'sprint.remainingMs': 0,
          'sprint.lastTickAt': new Date(0),
          'sprint.endsAt': new Date(0),
        },
      }
    );
    const done = await submit(app, jar, session._id);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({
      mode: 'sprint',
      correctCount: 2,
      answeredCount: 2,
      xpEarned: 80, // 30 base + 10×2 correct + 30 daily goal
      bestStreak: 2,
      durationSec: 60,
    });

    const profile = await GamificationProfile.findOne({ userId: user._id }).lean();
    expect(profile.currentStreak).toBe(0);
    expect(profile.quizModesPlayed).toContain('sprint');
  });

  it('refuses a sprint submit with no answers', async () => {
    const { jar, user } = await signUp();
    await seedKanji();
    const start = await request(app)
      .post('/api/v1/quiz/start')
      .set(csrfHeaders)
      .set('Cookie', jar)
      .send({ mode: 'sprint' });
    expect(start.status).toBe(201);
    const session = await currentSession(user);
    await QuizSession.updateOne(
      { _id: session._id },
      { $set: { 'sprint.remainingMs': 0, 'sprint.lastTickAt': new Date(0) } }
    );
    const res = await submit(app, jar, session._id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SPRINT_EMPTY');
  });
});
