import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CircleHelp, Volume2 } from 'lucide-react';
import { RATING, RATING_LABELS } from '@kanjigarden/shared';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { speakJa } from '../lib/speech.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { MobileTabBar } from '../components/AppShell.jsx';

/** Review session — prompt.md §7.2 (full-screen, distraction-free).
 *  Global top nav is replaced by a minimal bar (back · counter · ?); mobile
 *  keeps only the bottom tab bar. Shortcuts: Space reveal, 1–4 rate, U undo,
 *  S skip (client-side), X suspend, ? help. */

const SHORTCUTS = [
  { keys: 'Space', label: 'Show answer' },
  { keys: '1 – 4', label: 'Rate the card' },
  { keys: 'U', label: 'Undo the last rating (4s)' },
  { keys: 'S', label: 'Skip to the next card' },
  { keys: 'X', label: 'Suspend for 7 days' },
  { keys: '?', label: 'Toggle this help' },
];

const RATING_BUTTONS = [
  {
    value: RATING.AGAIN,
    label: RATING_LABELS[RATING.AGAIN],
    key: '1',
    rest: 'border-crimson text-crimson hover:bg-crimson hover:text-white',
    fill: 'border-crimson bg-crimson text-white',
  },
  {
    value: RATING.HARD,
    label: RATING_LABELS[RATING.HARD],
    key: '2',
    rest: 'border-persimmon text-persimmon hover:bg-persimmon hover:text-white',
    fill: 'border-persimmon bg-persimmon text-white',
  },
  {
    value: RATING.GOOD,
    label: RATING_LABELS[RATING.GOOD],
    key: '3',
    rest: 'border-matcha text-matcha hover:bg-matcha hover:text-white',
    fill: 'border-matcha bg-matcha text-white',
  },
  {
    value: RATING.EASY,
    label: RATING_LABELS[RATING.EASY],
    key: '4',
    rest: 'border-indigo text-indigo hover:bg-indigo hover:text-white',
    fill: 'border-indigo bg-indigo text-white',
  },
];

function makeSession(due) {
  return {
    phase: due.items.length > 0 ? 'session' : 'empty',
    queue: due.items,
    nextDueAt: due.nextDueAt ?? null,
    rated: 0,
    good: 0,
    xp: 0,
    streak: null,
    goalMet: false,
    reviewAgainEmpty: false,
  };
}

/** "Next review is scheduled for 14:30 today" (§7.2 empty state). */
function formatNextDue(iso) {
  if (!iso) return null;
  const when = new Date(iso);
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(when) - startOf(new Date())) / 86_400_000);
  if (dayDiff <= 0) return `Next review is scheduled for ${time} today`;
  if (dayDiff === 1) return `Next review is scheduled for ${time} tomorrow`;
  return `Next review is scheduled for ${time} on ${when.toLocaleDateString('en-US', {
    weekday: 'long',
  })}`;
}

/** Muted leaf — empty garden state (§7.2). */
function MutedLeafSvg() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <path d="M30 168h140" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M100 168c0-30-2-52-4-70"
        stroke="var(--ink-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M96 96c-24 0-40-15-42-40 26-2 42 14 42 40z"
        stroke="var(--ink-muted)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M104 130c22-4 36-20 34-44-24 4-38 20-34 44z"
        stroke="var(--border-strong)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Session summary art — the garden grows one stage (§7.2, 180px). */
function GardenStageSvg() {
  return (
    <svg width="180" height="180" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <path d="M30 172h140" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M100 172V72" stroke="var(--ink-primary)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M84 172c4-9 10-13 16-13s12 4 16 13"
        stroke="var(--ink-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M100 144c-22 0-36-13-38-34 24-2 38 11 38 34z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M100 128c20-4 32-19 30-39-22 4-34 18-30 39z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M100 110c-20-2-32-16-32-36 22 1 34 15 32 36z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="100" cy="62" r="11" stroke="var(--accent-vermillion)" strokeWidth="1.5" />
      <path
        d="M100 51c4-9 13-11 20-7-3 8-10 12-20 7zM100 51c-4-9-13-11-20-7 3 8 10 12 20 7z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReadingRow({ label, character, readings }) {
  if (!readings || readings.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.08em] text-ink-muted">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {readings.map((reading) => (
          <span
            key={reading}
            className="group inline-flex items-center gap-1.5 font-jp text-xl leading-tight text-ink-primary"
          >
            <ruby>
              {character}
              <rt>{reading}</rt>
            </ruby>
            <button
              type="button"
              aria-label={`Play reading ${reading}`}
              onClick={() => speakJa(reading)}
              className="text-ink-muted transition-opacity duration-fast ease-out hover:text-ink-primary md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <Volume2 size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Review() {
  const navigate = useNavigate();
  const { push } = useToast();
  const mergeGamification = useAuth((s) => s.mergeGamification);
  const furiganaOn = useAuth((s) => s.user?.preferences?.furigana ?? true);
  const navStreak = useAuth((s) => s.gamification?.currentStreak ?? 0);

  const [session, setSession] = useState(undefined); // undefined = first load
  const [revealed, setRevealed] = useState(false);
  const [pressed, setPressed] = useState(null); // rating filling during 220ms
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [undoView, setUndoView] = useState(null); // { rating } shown on banner
  const undoRef = useRef(null); // { snapshot, cardId } while the window is open
  const undoTimerRef = useRef(null);

  async function loadDue() {
    setSession(undefined);
    setRevealed(false);
    try {
      const due = await api('/progress/due');
      setSession(makeSession(due));
    } catch (err) {
      setSession({ phase: 'error', message: err.message });
    }
  }

  useEffect(() => {
    loadDue();
    return () => clearTimeout(undoTimerRef.current);
  }, []);

  function clearUndo() {
    clearTimeout(undoTimerRef.current);
    undoRef.current = null;
    setUndoView(null);
  }

  function openUndo(snapshot, cardId, rating) {
    undoRef.current = { snapshot, cardId };
    setUndoView({ rating });
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(clearUndo, 4000);
  }

  async function performUndo() {
    const entry = undoRef.current;
    if (!entry) return;
    clearUndo();
    try {
      const res = await api(`/review/${entry.cardId}/undo`, { method: 'POST' });
      mergeGamification({ totalXP: res.xp.totalXP, currentLevel: res.xp.level });
      setSession(entry.snapshot); // compensating restore (§6.5)
      setRevealed(false);
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    }
  }

  async function rate(rating) {
    if (!session || session.phase !== 'session' || !revealed || submitting) return;
    const snapshot = session; // pre-rating state, restored by undo
    const card = session.queue[0];
    setPressed(rating);
    setSubmitting(true);
    const request = api('/progress/review', {
      method: 'POST',
      body: { cardId: card.id, rating },
    });

    window.setTimeout(async () => {
      let result = null;
      try {
        result = await request;
      } catch (err) {
        push({ message: err.message, tone: 'info' });
      }
      setPressed(null);
      setSubmitting(false);
      if (!result) return; // card stays put for a retry

      mergeGamification({
        totalXP: result.xp.totalXP,
        currentStreak: result.xp.currentStreak,
        currentLevel: result.xp.level,
        xpToNextLevel: result.xp.xpToNextLevel,
      });
      setSession((prev) => ({
        ...prev,
        queue: prev.queue.slice(1),
        rated: prev.rated + 1,
        good: prev.good + (rating >= RATING.GOOD ? 1 : 0),
        xp: prev.xp + result.xp.awarded,
        streak: result.xp.currentStreak,
        goalMet: prev.goalMet || result.xp.bonuses.includes('goalMet'),
        phase: prev.queue.length === 1 ? 'summary' : 'session',
      }));
      setRevealed(false);
      openUndo(snapshot, card.id, rating);
    }, 220);
  }

  function skip() {
    if (!session || session.phase !== 'session' || session.queue.length === 0) return;
    // Client-side only (§7.2): rotate the card to the back of today's queue.
    setSession((prev) => ({
      ...prev,
      queue: [...prev.queue.slice(1), prev.queue[0]],
    }));
    setRevealed(false);
  }

  async function suspend() {
    if (!session || session.phase !== 'session' || session.queue.length === 0) return;
    const card = session.queue[0];
    try {
      await api(`/review/${card.id}/suspend`, { method: 'POST' });
      clearUndo();
      setRevealed(false);
      push({ message: 'Buried for 7 days.', tone: 'success' });
      setSession((prev) => {
        const queue = prev.queue.slice(1);
        return {
          ...prev,
          queue,
          phase: queue.length === 0 ? (prev.rated > 0 ? 'summary' : 'empty') : 'session',
        };
      });
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    }
  }

  async function reviewAgain() {
    try {
      const due = await api('/progress/due');
      if (due.items.length === 0) {
        setSession((prev) => ({
          ...prev,
          reviewAgainEmpty: true,
          nextDueAt: due.nextDueAt ?? null,
        }));
        return;
      }
      clearUndo();
      setRevealed(false);
      setSession((prev) => ({ ...makeSession(due), streak: prev.streak }));
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    }
  }

  // Keyboard controls (§7.2). Re-registered every render for fresh closures.
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
      if (!session || session.phase === 'error') return;

      const key = event.key;
      if (key === '?') {
        setHelpOpen((open) => !open);
        return;
      }
      if (key === 'Escape') {
        setHelpOpen(false);
        return;
      }

      // Any other key discards a pending undo (§7.2).
      if (undoRef.current && key.toLowerCase() !== 'u') clearUndo();

      if (session.phase === 'session') {
        if (key === ' ' || event.code === 'Space') {
          event.preventDefault();
          if (!revealed) setRevealed(true);
          return;
        }
        if (key >= '1' && key <= '4' && revealed && !submitting) {
          rate(Number(key) - 1);
          return;
        }
        if (key.toLowerCase() === 'u' && undoRef.current) {
          performUndo();
          return;
        }
        if (key.toLowerCase() === 's') {
          skip();
          return;
        }
        if (key.toLowerCase() === 'x') {
          suspend();
          return;
        }
      } else if (session.phase === 'summary' && key.toLowerCase() === 'u' && undoRef.current) {
        performUndo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ---------------------------------------------------------------- render */

  if (session === undefined) {
    return (
      <div className="min-h-screen">
        <TopBar
          onBack={() => navigate('/')}
          counter={null}
          helpOpen={false}
          setHelpOpen={() => {}}
        />
        <main className="mx-auto w-full max-w-[640px] px-4 pt-16 md:pt-24">
          <Skeleton className="h-1 w-full" />
          <Skeleton className="mx-auto mt-8 h-32 w-32" style={{ borderRadius: '12px' }} />
          <Skeleton className="mx-auto mt-6 h-12 w-80" />
          <Skeleton className="mt-6 h-40 w-full" />
        </main>
        <MobileTabBar />
      </div>
    );
  }

  if (session.phase === 'error') {
    return (
      <div className="min-h-screen">
        <TopBar
          onBack={() => navigate('/')}
          counter={null}
          helpOpen={false}
          setHelpOpen={() => {}}
        />
        <main className="mx-auto w-full max-w-[640px] px-4 pt-16 md:pt-24">
          <div className="rounded-card border border-line-subtle bg-surface p-10 text-center shadow-sm">
            <h2 className="font-display text-2xl font-medium text-ink-primary">
              Couldn&apos;t load your reviews
            </h2>
            <p className="mx-auto mt-2 max-w-[400px] text-sm text-ink-secondary">
              {session.message}
            </p>
            <Button className="mt-4" onClick={loadDue}>
              Try again
            </Button>
          </div>
        </main>
        <MobileTabBar />
      </div>
    );
  }

  const counter =
    session.phase === 'session'
      ? `Card ${session.rated + 1} of ${session.rated + session.queue.length}`
      : null;
  const progress =
    session.phase === 'session' && session.rated + session.queue.length > 0
      ? (session.rated / (session.rated + session.queue.length)) * 100
      : session.phase === 'summary'
        ? 100
        : 0;

  return (
    <div className="min-h-screen">
      <TopBar
        onBack={() => navigate('/')}
        counter={counter}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
      />

      <main className="mx-auto w-full max-w-[640px] px-4 pb-28 pt-16 md:pt-24">
        {/* Progress bar (§7.2): 4px, subtle bg, vermillion fill */}
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

        {session.phase === 'empty' ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-card border border-line-subtle bg-surface p-10 text-center shadow-sm">
            <MutedLeafSvg />
            <h1 className="font-display text-2xl font-medium text-ink-primary">Nothing due</h1>
            <p className="max-w-[400px] text-sm text-ink-secondary">
              {formatNextDue(session.nextDueAt) ??
                "You're all caught up. Browse kanji to add more to your garden."}
            </p>
            <Button variant="outline" onClick={() => navigate('/learn')}>
              Browse kanji
            </Button>
          </div>
        ) : null}

        {session.phase === 'session' ? (
          <CardStage
            card={session.queue[0]}
            revealed={revealed}
            pressed={pressed}
            submitting={submitting}
            furiganaOn={furiganaOn}
            onReveal={() => setRevealed(true)}
            onRate={rate}
          />
        ) : null}

        {session.phase === 'summary' ? (
          <section className="mx-auto mt-8 flex max-w-[480px] flex-col items-center rounded-card border border-line-subtle bg-surface p-8 text-center shadow-sm">
            <GardenStageSvg />
            <h1 className="mt-2 font-display text-4xl font-medium text-ink-primary">
              {session.rated} reviews
            </h1>
            <p className="text-sm text-ink-muted">completed</p>
            <div className="mt-5 font-mono text-sm text-ink-primary">
              Accuracy {Math.round((session.good / Math.max(session.rated, 1)) * 100)}%
              <span className="mx-2 text-ink-muted">|</span>+{session.xp} XP
              <span className="mx-2 text-ink-muted">|</span>
              Streak {session.streak ?? navStreak} days
            </div>
            {session.goalMet ? (
              <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-control bg-matcha/15 py-2 text-sm font-medium text-matcha">
                <CheckCircle2 size={16} aria-hidden="true" />
                Daily goal met
              </div>
            ) : null}
            <Button className="mt-6 w-full" onClick={() => navigate('/')}>
              Continue
            </Button>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={reviewAgain}
              disabled={session.reviewAgainEmpty}
            >
              {session.reviewAgainEmpty ? 'All caught up' : 'Review again'}
            </Button>
          </section>
        ) : null}

        {/* Keyboard footer (desktop only, §7.2) */}
        {session.phase === 'session' ? (
          <p className="mt-6 hidden text-center font-mono text-xs text-ink-muted md:block">
            Space to reveal · 1–4 to rate · U to undo · S to skip · X to suspend
          </p>
        ) : null}
      </main>

      {/* Undo banner (§7.2): bottom-left, 4 seconds, previous rating */}
      {undoView ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 left-4 z-50 flex items-center gap-3 rounded-card border border-line-subtle bg-surface p-3 text-sm text-ink-primary shadow-md md:bottom-4"
        >
          <span>
            Rated <strong className="font-medium">{RATING_LABELS[undoView.rating]}</strong>
          </span>
          <button
            type="button"
            onClick={performUndo}
            className="rounded-control px-2 py-1 text-xs font-medium text-vermillion transition-colors duration-fast ease-out hover:bg-subtle"
          >
            Undo
          </button>
        </div>
      ) : null}

      <MobileTabBar />
    </div>
  );
}

function TopBar({ onBack, counter, helpOpen, setHelpOpen }) {
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

function CardStage({ card, revealed, pressed, submitting, furiganaOn, onReveal, onRate }) {
  const reading = card.readingsKun?.[0] ?? card.readingsOn?.[0] ?? null;
  const example = card.exampleWords?.[0] ?? null;

  return (
    <section className="mt-8" data-testid="review-card">
      {revealed ? (
        /* ---- Card back (§7.2): smaller kanji + content card ---- */
        <div
          className={cn(
            'transition-opacity duration-150',
            pressed !== null ? 'opacity-0' : 'opacity-100'
          )}
        >
          <div
            className="text-center font-jp-serif text-ink-primary"
            style={{ fontSize: '4rem', lineHeight: 1 }}
          >
            {card.character}
          </div>

          <div className="mt-4 rounded-card border border-line-subtle bg-surface p-5">
            <p className="text-lg font-medium text-ink-primary">{card.meanings.join(' · ')}</p>

            <div className="mt-4 space-y-3">
              <ReadingRow label="On" character={card.character} readings={card.readingsOn} />
              <ReadingRow label="Kun" character={card.character} readings={card.readingsKun} />
            </div>

            {example ? (
              <div className="mt-5 border-t border-line-subtle pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-jp-serif text-xl text-ink-primary">{example.word}</span>
                  <span className="font-jp text-sm text-ink-muted">{example.reading}</span>
                </div>
                <div className="text-sm text-ink-secondary">{example.meaning}</div>
              </div>
            ) : null}

            {card.mnemonic ? (
              <p className="mt-4 text-sm">
                <span className="text-xs font-medium uppercase tracking-[0.06em] text-vermillion">
                  Remember:{' '}
                </span>
                <span className="italic text-ink-secondary">{card.mnemonic}</span>
              </p>
            ) : null}
          </div>

          {/* Rating buttons: 8px gap row desktop, 2×2 mobile, 220ms fill */}
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            {RATING_BUTTONS.map((button) => (
              <button
                key={button.value}
                type="button"
                aria-label={button.label}
                disabled={submitting || pressed !== null}
                onClick={() => onRate(button.value)}
                className={cn(
                  'rounded-control border bg-surface py-3 text-sm font-medium transition-colors duration-[220ms] ease-out',
                  'disabled:pointer-events-none disabled:opacity-50',
                  pressed === button.value ? button.fill : button.rest
                )}
              >
                {button.label}
                <span
                  className={cn(
                    'mt-0.5 block text-[10px] font-normal',
                    pressed === button.value ? 'text-white/80' : 'text-ink-muted'
                  )}
                >
                  {button.key}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ---- Card front (§7.2): kanji at --text-kanji-xl, show answer ---- */
        <div
          className={cn(
            'transition-opacity duration-150',
            pressed !== null ? 'opacity-0' : 'opacity-100'
          )}
        >
          <div
            className="flex min-h-32 items-center justify-center text-center text-ink-primary"
            data-testid="review-kanji"
          >
            {furiganaOn && reading ? (
              <ruby
                className="font-jp-serif"
                style={{ fontSize: 'var(--text-kanji-xl)', lineHeight: 1, fontWeight: 400 }}
              >
                {card.character}
                <rt className="font-jp text-ink-muted" style={{ fontSize: '0.3em' }}>
                  {reading}
                </rt>
              </ruby>
            ) : (
              <span
                className="font-jp-serif"
                style={{ fontSize: 'var(--text-kanji-xl)', lineHeight: 1, fontWeight: 400 }}
              >
                {card.character}
              </span>
            )}
          </div>

          <Button size="block" className="mt-5 md:mx-auto md:block md:w-80" onClick={onReveal}>
            Show answer
          </Button>
        </div>
      )}
    </section>
  );
}
