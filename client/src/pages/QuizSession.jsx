import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CircleHelp } from 'lucide-react';
import { QUIZ_MODES, QUIZ_SPRINT_SECONDS } from '@kanjigarden/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { MobileTabBar } from '../components/AppShell.jsx';
import { CelebrationModal, titleChanged } from '../components/CelebrationModal.jsx';
import { unlockToastMessage } from '../lib/gamification.js';
import { QUIZ_MODE_INFO } from '../components/quiz/QuizIcons.jsx';
import { ChoiceQuestion } from '../components/quiz/ChoiceQuestion.jsx';
import { StrokeQuestion } from '../components/quiz/StrokeQuestion.jsx';
import { DrawingQuestion } from '../components/quiz/DrawingQuestion.jsx';
import { SprintTimer } from '../components/quiz/SprintTimer.jsx';

/**
 * Quiz session — prompt.md §7.6 (full-screen, max-width 640px).
 *
 * The server owns the questions, answer keys, drawing scores and clock; this
 * page renders one question at a time and posts every choice/tap/check.
 * Navigation away from an active session requires confirmation.
 */

const SHORTCUTS = [
  { keys: '1 – 4', label: 'Choose an answer' },
  { keys: 'Space', label: 'Continue' },
  { keys: '?', label: 'Toggle this help' },
];

const PRACTICE_FEEDBACK_MS = 800;
const SPRINT_FEEDBACK_MS = 450;

function clearedQuestion() {
  return {
    selectedId: null,
    correctOptionId: null,
    taps: [],
    wrongStrokeId: null,
    strokeComplete: false,
    strokeOutcome: null,
    drawingStrokes: [],
    drawingResult: null,
  };
}

export default function QuizSession() {
  const navigate = useNavigate();
  const { mode } = useParams();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const mergeGamification = useAuth((s) => s.mergeGamification);
  const validMode = QUIZ_MODES.includes(mode);
  const modeTitle = QUIZ_MODE_INFO[mode]?.title ?? 'Quiz';

  const [phase, setPhase] = useState('loading'); // loading | active | summary | error
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [summary, setSummary] = useState(null);
  const [emptySprint, setEmptySprint] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebration, setCelebration] = useState(null);

  // Per-question state.
  const [selectedId, setSelectedId] = useState(null);
  const [correctOptionId, setCorrectOptionId] = useState(null);
  const [taps, setTaps] = useState([]);
  const [wrongStrokeId, setWrongStrokeId] = useState(null);
  const [strokeComplete, setStrokeComplete] = useState(false);
  const [strokeOutcome, setStrokeOutcome] = useState(null);
  const [drawingStrokes, setDrawingStrokes] = useState([]);
  const [drawingResult, setDrawingResult] = useState(null);
  const [drawingClearKey, setDrawingClearKey] = useState(0);
  const [checking, setChecking] = useState(false);

  // Sprint clock + feedback flash.
  const [sprintLeft, setSprintLeft] = useState(0);
  const [sprintFlash, setSprintFlash] = useState(null);

  const startedRef = useRef(false);
  const sessionRef = useRef(null);
  const phaseRef = useRef(phase);
  const lockedRef = useRef(false);
  const answeringRef = useRef(false);
  const submittingRef = useRef(false);
  const summaryDoneRef = useRef(false);
  const sprintRemainingRef = useRef(0);
  const sprintAnchorRef = useRef(0);
  const advanceRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const wrongTimerRef = useRef(null);
  const allowLeaveRef = useRef(false);
  const finalizeRef = useRef(null);

  sessionRef.current = session;
  phaseRef.current = phase;

  function clearTimers() {
    clearTimeout(advanceTimerRef.current);
    clearTimeout(flashTimerRef.current);
    clearTimeout(wrongTimerRef.current);
    advanceTimerRef.current = null;
    flashTimerRef.current = null;
    wrongTimerRef.current = null;
    advanceRef.current = null;
  }

  useEffect(() => clearTimers, []);

  function unlock() {
    lockedRef.current = false;
    setLocked(false);
  }

  function lock() {
    lockedRef.current = true;
    setLocked(true);
  }

  function resetQuestion() {
    const fresh = clearedQuestion();
    setSelectedId(fresh.selectedId);
    setCorrectOptionId(fresh.correctOptionId);
    setTaps(fresh.taps);
    setWrongStrokeId(fresh.wrongStrokeId);
    setStrokeComplete(fresh.strokeComplete);
    setStrokeOutcome(fresh.strokeOutcome);
    setDrawingStrokes(fresh.drawingStrokes);
    setDrawingResult(fresh.drawingResult);
    setChecking(false);
    setDrawingClearKey((key) => key + 1);
    advanceRef.current = null;
    unlock();
  }

  function reportResult(data) {
    const xp = data?.xp;
    if (!xp) return;
    mergeGamification({
      totalXP: xp.totalXP,
      currentLevel: xp.level,
      xpToNextLevel: xp.xpToNextLevel,
      coins: xp.coins,
      currentStreak: xp.currentStreak,
    });
    for (const achievement of xp.newlyUnlocked ?? []) {
      push({ message: unlockToastMessage(achievement), tone: 'success' });
    }
    for (const quest of data.questCompletions ?? []) {
      push({
        message: `Quest complete: ${quest.title} — +${
          quest.xpAwarded || quest.xpReward
        } XP, ${quest.coinsAwarded || quest.coinReward} coins`,
        tone: 'success',
      });
    }
    if (data.questSweep) {
      push({
        message: `Daily sweep complete — +${data.questSweep.awarded} XP`,
        tone: 'success',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['quests', 'today'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['progress', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['quiz', 'overview'] });
    if (xp.leveledUp) {
      setCelebration({
        kind: 'levelUp',
        level: xp.level,
        title: xp.title,
        newTitle: titleChanged(xp.previousLevel, xp.level),
      });
    }
  }

  function completeSummary(data) {
    clearTimers();
    summaryDoneRef.current = true;
    submittingRef.current = false;
    answeringRef.current = false;
    unlock();
    setSummary(data);
    setEmptySprint(false);
    setPhase('summary');
    reportResult(data);
  }

  const startQuiz = useCallback(async () => {
    clearTimers();
    setSummary(null);
    setEmptySprint(false);
    setCelebration(null);
    setSession(null);
    setQuestion(null);
    setIndex(0);
    summaryDoneRef.current = false;
    submittingRef.current = false;
    answeringRef.current = false;
    allowLeaveRef.current = false;
    resetQuestion();

    if (!validMode) {
      setError('Choose a quiz mode from the hub.');
      setPhase('error');
      return;
    }

    setPhase('loading');
    setError(null);
    try {
      const data = await api('/quiz/start', {
        method: 'POST',
        body: { mode },
      });
      setSession(data.session);
      setQuestion(data.question);
      if (data.session.mode === 'sprint') {
        const remaining = data.session.remainingMs ?? QUIZ_SPRINT_SECONDS * 1000;
        sprintRemainingRef.current = remaining;
        sprintAnchorRef.current = Date.now();
        setSprintLeft(remaining);
      }
      setPhase('active');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, [mode, validMode]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startQuiz();
  }, [startQuiz]);

  function goNext(next) {
    setQuestion(next);
    setIndex((current) => current + 1);
    resetQuestion();
  }

  function scheduleAdvance(next, delay, finish) {
    advanceRef.current = () => {
      advanceTimerRef.current = null;
      advanceRef.current = null;
      if (next) goNext(next);
      else finish();
    };
    advanceTimerRef.current = setTimeout(() => advanceRef.current?.(), delay);
  }

  async function finalizePractice() {
    if (!sessionRef.current || submittingRef.current || summaryDoneRef.current) return;
    submittingRef.current = true;
    lock();
    try {
      const data = await api(`/quiz/${sessionRef.current.id}/submit`, { method: 'POST' });
      completeSummary(data);
    } catch (err) {
      submittingRef.current = false;
      unlock();
      push({ message: err.message, tone: 'info' });
    }
  }

  async function finalizeSprint(attempt = 0) {
    if (!sessionRef.current || summaryDoneRef.current) return;
    if (attempt === 0) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      lock();
    }
    try {
      const data = await api(`/quiz/${sessionRef.current.id}/submit`, { method: 'POST' });
      completeSummary(data);
    } catch (err) {
      if (err.code === 'SPRINT_ACTIVE' && attempt < 16) {
        window.setTimeout(() => finalizeSprint(attempt + 1), 250);
        return;
      }
      if (err.code === 'SPRINT_EMPTY') {
        clearTimers();
        summaryDoneRef.current = true;
        submittingRef.current = false;
        unlock();
        setSummary(null);
        setEmptySprint(true);
        setPhase('summary');
        return;
      }
      submittingRef.current = false;
      unlock();
      push({ message: err.message, tone: 'info' });
    }
  }

  finalizeRef.current = finalizeSprint;

  function handleAnswerError(err) {
    answeringRef.current = false;
    if (err.code === 'SPRINT_ENDED') {
      finalizeSprint();
      return;
    }
    if (err.code === 'QUIZ_EXPIRED' || err.code === 'QUIZ_NOT_FOUND') {
      setError(err.message);
      setPhase('error');
      return;
    }
    unlock();
    push({ message: err.message, tone: 'info' });
  }

  async function chooseOption(option) {
    if (lockedRef.current || correctOptionId !== null || !sessionRef.current) return;
    answeringRef.current = true;
    lock();
    setSelectedId(option.id);

    try {
      const data = await api(`/quiz/${sessionRef.current.id}/answer`, {
        method: 'POST',
        body: { optionId: option.id },
      });
      answeringRef.current = false;
      setSession(data.session);

      if (data.session.mode === 'sprint') {
        handleSprintTiming(data.session);
        setCorrectOptionId(data.correctOptionId ?? null);
        setSprintFlash(data.timeDeltaMs > 0 ? 'correct' : 'wrong');
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setSprintFlash(null), 400);
        if (data.ended || !data.nextQuestion) {
          scheduleAdvance(null, SPRINT_FEEDBACK_MS, finalizeSprint);
          return;
        }
        scheduleAdvance(data.nextQuestion, SPRINT_FEEDBACK_MS, finalizeSprint);
        return;
      }

      setCorrectOptionId(data.correctOptionId ?? null);
      scheduleAdvance(data.nextQuestion, PRACTICE_FEEDBACK_MS, finalizePractice);
    } catch (err) {
      handleAnswerError(err);
    }
  }

  function handleSprintTiming(nextSession) {
    if (!nextSession) return;
    const remaining = nextSession.remainingMs ?? sprintRemainingRef.current;
    sprintRemainingRef.current = remaining;
    sprintAnchorRef.current = Date.now();
    setSprintLeft(remaining);
  }

  async function tapStroke(strokeId) {
    if (lockedRef.current || strokeComplete || !sessionRef.current) return;
    answeringRef.current = true;
    lock();

    try {
      const data = await api(`/quiz/${sessionRef.current.id}/answer`, {
        method: 'POST',
        body: { strokeId },
      });
      answeringRef.current = false;
      setSession(data.session);

      if (data.tapCorrect) {
        setTaps((current) => [...current, strokeId]);
      } else {
        setWrongStrokeId(strokeId);
        clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = setTimeout(() => setWrongStrokeId(null), 220);
      }

      if (data.session.mode === 'sprint') {
        handleSprintTiming(data.session);
        if (!data.complete) {
          unlock();
          return;
        }
        setStrokeComplete(true);
        setStrokeOutcome(!!data.correct);
        setSprintFlash(data.timeDeltaMs > 0 ? 'correct' : 'wrong');
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setSprintFlash(null), 400);
        if (data.ended || !data.nextQuestion) {
          scheduleAdvance(null, SPRINT_FEEDBACK_MS, finalizeSprint);
          return;
        }
        scheduleAdvance(data.nextQuestion, SPRINT_FEEDBACK_MS, finalizeSprint);
        return;
      }

      if (!data.complete) {
        unlock();
        return;
      }
      setStrokeComplete(true);
      setStrokeOutcome(!!data.correct);
      scheduleAdvance(data.nextQuestion, PRACTICE_FEEDBACK_MS, finalizePractice);
    } catch (err) {
      handleAnswerError(err);
    }
  }

  async function checkDrawing() {
    if (checking || drawingResult?.complete || drawingStrokes.length === 0) return;
    if (!sessionRef.current) return;
    setChecking(true);
    try {
      const data = await api(`/quiz/${sessionRef.current.id}/answer`, {
        method: 'POST',
        body: { strokes: drawingStrokes },
      });
      setSession(data.session);
      setDrawingResult(data);
      if (data.complete) {
        advanceRef.current = () => {
          advanceTimerRef.current = null;
          advanceRef.current = null;
          if (data.nextQuestion) goNext(data.nextQuestion);
          else finalizePractice();
        };
      }
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    } finally {
      setChecking(false);
    }
  }

  function clearDrawing() {
    setDrawingStrokes([]);
    setDrawingClearKey((key) => key + 1);
    if (!drawingResult?.complete) setDrawingResult(null);
  }

  function continueDrawing() {
    advanceRef.current?.();
  }

  function leaveQuiz() {
    if (phaseRef.current === 'active') {
      setLeaveOpen(true);
      return;
    }
    navigate('/quiz', { replace: true });
  }

  function confirmLeave() {
    allowLeaveRef.current = true;
    setLeaveOpen(false);
    navigate('/quiz', { replace: true });
  }

  // Confirmation for browser back / tab close while a session is active (§7.6).
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const sentinel = { quizGuard: true };
    window.history.pushState(sentinel, '');
    function onPopState() {
      if (allowLeaveRef.current) return;
      window.history.pushState(sentinel, '');
      setLeaveOpen(true);
    }
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [phase]);

  // Server-owned sprint clock: count down from the last received anchor.
  useEffect(() => {
    if (phase !== 'active' || session?.mode !== 'sprint') return undefined;
    const id = window.setInterval(() => {
      const left = Math.max(0, sprintRemainingRef.current - (Date.now() - sprintAnchorRef.current));
      setSprintLeft(left);
      if (left <= 0 && !answeringRef.current) finalizeRef.current?.();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, session?.id, session?.mode]);

  // Keyboard shortcuts (§7.6): 1–4, Space, ?. Re-registered per render.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === '?') {
        setHelpOpen((open) => !open);
        return;
      }
      if (event.key === 'Escape') {
        setHelpOpen(false);
        return;
      }
      if (phase !== 'active' || !question) return;

      if (question.mode === 'meaning' || question.mode === 'reading') {
        const digit = Number(event.key);
        if (digit >= 1 && digit <= 4 && correctOptionId === null && !lockedRef.current) {
          const option = question.options[digit - 1];
          if (option) chooseOption(option);
          return;
        }
      }

      if (event.key === ' ' || event.code === 'Space') {
        if (advanceRef.current) {
          event.preventDefault();
          const advance = advanceRef.current;
          advanceRef.current = null;
          clearTimeout(advanceTimerRef.current);
          advanceTimerRef.current = null;
          advance();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ---------------------------------------------------------------- render */

  if (phase === 'loading') {
    return (
      <div className="min-h-screen">
        <SessionTopBar onBack={() => navigate('/quiz', { replace: true })} counter={modeTitle} />
        <main className="mx-auto w-full max-w-[640px] px-4 pt-16 md:pt-24">
          <Skeleton className="h-1 w-full" />
          <Skeleton className="mx-auto mt-8 h-32 w-32" />
          <Skeleton className="mx-auto mt-6 h-12 w-80" />
          <Skeleton className="mt-6 h-40 w-full" />
        </main>
        <MobileTabBar />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen">
        <SessionTopBar onBack={() => navigate('/quiz', { replace: true })} counter={modeTitle} />
        <main className="mx-auto w-full max-w-[640px] px-4 pt-16 md:pt-24">
          <div className="rounded-card border border-line-subtle bg-surface p-10 text-center shadow-sm">
            <h1 className="font-display text-2xl font-medium text-ink-primary">
              Couldn&apos;t start this quiz
            </h1>
            <p className="mx-auto mt-2 max-w-[400px] text-sm text-ink-secondary">
              {error ?? 'Something went wrong on our side.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate('/quiz', { replace: true })}>
                Back to quiz
              </Button>
              <Button onClick={startQuiz}>Try again</Button>
            </div>
          </div>
        </main>
        <MobileTabBar />
      </div>
    );
  }

  if (phase === 'summary') {
    const isSprint = mode === 'sprint';
    return (
      <div className="min-h-screen">
        <SessionTopBar onBack={() => navigate('/quiz', { replace: true })} counter={modeTitle} />
        <main className="mx-auto w-full max-w-[640px] px-4 pb-28 pt-16 md:pt-24">
          <section
            className="mx-auto flex max-w-[480px] flex-col items-center rounded-card border border-line-subtle bg-surface p-8 text-center shadow-sm"
            data-testid="quiz-summary"
          >
            <CheckCircle2 size={48} className="text-matcha" aria-hidden="true" />
            {emptySprint ? (
              <>
                <h1 className="mt-3 font-display text-3xl font-medium text-ink-primary">
                  Time&apos;s up
                </h1>
                <p className="mt-1 text-sm text-ink-secondary">
                  No answers this time — nothing to score.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-3 font-display text-3xl font-medium text-ink-primary">
                  {isSprint
                    ? `You got ${summary?.correctCount ?? 0} correct in 60 seconds`
                    : `${summary?.correctCount ?? 0} of ${summary?.answeredCount ?? 0} correct`}
                </h1>
                <p className="mt-1 text-sm text-ink-secondary">
                  {isSprint ? 'Sprint complete' : 'Quiz complete'}
                </p>
                <div className="mt-5 font-mono text-sm text-ink-primary">
                  Accuracy {summary?.accuracy ?? 0}%<span className="mx-2 text-ink-muted">|</span>+
                  {summary?.xpEarned ?? 0} XP
                  {isSprint ? (
                    <>
                      <span className="mx-2 text-ink-muted">|</span>
                      Best streak {summary?.bestStreak ?? 0}
                    </>
                  ) : null}
                </div>
                {summary?.xp?.bonuses?.includes('goalMet') ? (
                  <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-control bg-matcha/15 py-2 text-sm font-medium text-matcha">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Daily goal met
                  </div>
                ) : null}
              </>
            )}

            <Button className="mt-6 w-full" onClick={() => navigate('/quiz', { replace: true })}>
              Back to quiz
            </Button>
            <Button variant="outline" className="mt-3 w-full" onClick={startQuiz}>
              Play again
            </Button>
          </section>

          {celebration ? (
            <CelebrationModal
              open
              kind={celebration.kind}
              level={celebration.level}
              title={celebration.title}
              newTitle={celebration.newTitle}
              onClose={() => setCelebration(null)}
            />
          ) : null}
        </main>
        <MobileTabBar />
      </div>
    );
  }

  const totalQuestions = session?.totalQuestions ?? 0;
  const progress = totalQuestions > 0 ? Math.min(100, (index / totalQuestions) * 100) : 0;
  const isSprint = session?.mode === 'sprint';

  return (
    <div className="min-h-screen">
      <SessionTopBar
        onBack={leaveQuiz}
        counter={
          isSprint
            ? 'Sprint'
            : `Question ${Math.min(index + 1, totalQuestions || 1)} of ${totalQuestions || 1}`
        }
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
      />

      <main className="mx-auto w-full max-w-[640px] px-4 pb-28 pt-16 md:pt-24">
        {isSprint ? (
          <SprintTimer remainingMs={sprintLeft} flash={sprintFlash} />
        ) : (
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-line-subtle"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full bg-vermillion transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="mt-8" data-testid="quiz-stage">
          {question?.mode === 'meaning' || question?.mode === 'reading' ? (
            <ChoiceQuestion
              question={question}
              selectedId={selectedId}
              correctOptionId={correctOptionId}
              disabled={locked}
              onSelect={chooseOption}
            />
          ) : null}

          {question?.mode === 'stroke' ? (
            <StrokeQuestion
              question={question}
              taps={taps}
              wrongStrokeId={wrongStrokeId}
              disabled={locked}
              complete={strokeComplete}
              outcome={strokeOutcome}
              onTap={tapStroke}
            />
          ) : null}

          {question?.mode === 'drawing' ? (
            <DrawingQuestion
              question={question}
              strokes={drawingStrokes}
              onStrokesChange={setDrawingStrokes}
              clearKey={drawingClearKey}
              result={drawingResult}
              checking={checking}
              onCheck={checkDrawing}
              onClear={clearDrawing}
              onContinue={continueDrawing}
            />
          ) : null}
        </div>

        <p className="mt-6 hidden text-center font-mono text-xs text-ink-muted md:block">
          1–4 to answer · Space to continue · ? for shortcuts
        </p>
      </main>

      <Modal
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this quiz?"
        description="Your progress in this session won't be saved."
        footer={
          <>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Stay
            </Button>
            <Button onClick={confirmLeave}>Leave quiz</Button>
          </>
        }
      />
    </div>
  );
}

function SessionTopBar({ onBack, counter, helpOpen = false, setHelpOpen = () => {} }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!helpOpen) return undefined;
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setHelpOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [helpOpen, setHelpOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-14 border-b border-line-subtle bg-canvas md:h-16">
      <div className="relative mx-auto flex h-full max-w-[960px] items-center justify-between px-4 md:px-6">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="p-1 text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>

        <span className="font-mono text-sm text-ink-secondary">{counter}</span>

        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
            className="p-1 text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
          >
            <CircleHelp size={20} aria-hidden="true" />
          </button>
          {helpOpen ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-card border border-line-subtle bg-surface p-4 shadow-md">
              <div className="mb-2 text-xs uppercase tracking-[0.08em] text-ink-muted">
                Shortcuts
              </div>
              <dl className="space-y-1.5">
                {SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between gap-3">
                    <dt className="font-mono text-xs text-ink-primary">{shortcut.keys}</dt>
                    <dd className="text-right text-xs text-ink-secondary">{shortcut.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
