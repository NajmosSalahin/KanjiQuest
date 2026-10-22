import { Fragment, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Stroke-order animation — prompt.md §7.4 + approved deviation D5.
 * Idle: all strokes fully visible in --ink-muted.
 * Play: each stroke draws via stroke-dashoffset — 600ms at 1× / 1200ms at
 * 0.5×, staggered 300ms / 600ms (D5; spec said 400/200) — current stroke
 * vermillion, settled strokes --ink-primary. Default speed 0.5× (D5).
 */

const iconBtn =
  'inline-flex items-center justify-center rounded-control p-1.5 text-ink-secondary transition-colors duration-fast ease-out hover:bg-subtle hover:text-ink-primary';

function getDrawMs(speed) {
  return speed === '0.5' ? 1200 : 600;
}
function getGapMs(speed) {
  return speed === '0.5' ? 600 : 300;
}

export function StrokeOrderPlayer({ character, strokes }) {
  const [speed, setSpeed] = useState('0.5'); // D5: default 0.5×
  const [playing, setPlaying] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const pathRefs = useRef([]);
  const timers = useRef([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  function reset() {
    clearTimers();
    setPlaying(false);
    setResetTick((tick) => tick + 1); // remount paths to idle (muted, visible)
  }

  function startStroke(i) {
    const path = pathRefs.current[i];
    if (!path) return;
    const drawMs = getDrawMs(speedRef.current);
    path.classList.add('current'); // vermillion while drawing
    path.style.transition = 'none';
    path.style.strokeDashoffset = '1'; // hide, then draw
    void path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${drawMs}ms var(--ease-out)`;
    path.style.strokeDashoffset = '0';
    timers.current.push(setTimeout(() => path.classList.remove('pending', 'current'), drawMs));
  }

  function play() {
    if (playing || strokes.length === 0) return;
    const paths = pathRefs.current.filter(Boolean);
    const allSettled = paths.every((p) => !p.classList.contains('pending'));
    if (allSettled) paths.forEach((p) => p.classList.add('pending'));
    paths.forEach((p) => {
      // hide everything not yet drawn
      if (p.classList.contains('pending')) {
        p.style.transition = 'none';
        p.style.strokeDashoffset = '1';
      }
    });
    setPlaying(true);
    paths.forEach((_, i) => {
      timers.current.push(setTimeout(() => startStroke(i), i * getGapMs(speedRef.current)));
    });
    timers.current.push(
      setTimeout(
        () => setPlaying(false),
        (paths.length - 1) * getGapMs(speedRef.current) + getDrawMs(speedRef.current)
      )
    );
  }

  function pause() {
    setPlaying(false);
    clearTimers();
    pathRefs.current.forEach((path) => {
      if (!path) return;
      const offset = getComputedStyle(path).strokeDashoffset;
      path.style.transition = 'none';
      path.style.strokeDashoffset = offset;
      path.classList.remove('current');
    });
  }

  function toggleSpeed() {
    setSpeed((current) => (current === '0.5' ? '1' : '0.5'));
  }

  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Stroke order</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={iconBtn}
            aria-label="Play stroke animation"
            onClick={play}
            disabled={strokes.length === 0}
          >
            <Play size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Pause stroke animation"
            onClick={pause}
            disabled={strokes.length === 0}
          >
            <Pause size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleSpeed}
            aria-label="Toggle animation speed"
            className={cn(
              'rounded-control border bg-surface px-2 py-[3px] font-mono text-xs transition-colors duration-fast ease-out',
              speed === '0.5'
                ? 'border-indigo text-indigo'
                : 'border-line-subtle text-ink-secondary hover:border-line-strong'
            )}
          >
            1× / 0.5×
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label="Reset stroke animation"
            onClick={reset}
            disabled={strokes.length === 0}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {strokes.length === 0 ? (
        /* §7.4: hasStrokeOrder:false replaces the SVG, not the card. */
        <p className="text-center text-sm text-ink-secondary" style={{ padding: 80 }}>
          Stroke-order data isn&apos;t available for this kanji.
        </p>
      ) : (
        <svg
          viewBox="0 0 109 109"
          role="img"
          aria-label={`Stroke order animation for ${character}, ${strokes.length} strokes`}
          className="stroke-svg mx-auto block"
        >
          {strokes.map((stroke, index) => (
            <path
              key={`${resetTick}-${stroke.n}`}
              ref={(el) => {
                pathRefs.current[index] = el;
              }}
              className="stroke-path pending"
              pathLength="1"
              d={stroke.d}
            />
          ))}
          {strokes.map((stroke) =>
            stroke.x !== null && stroke.y !== null ? (
              <text key={`label-${stroke.n}`} x={stroke.x} y={stroke.y}>
                {stroke.n}
              </text>
            ) : null
          )}
        </svg>
      )}
    </div>
  );
}

/** Shared ruby-token renderer (sentences, §7.4 "In context"). */
export function FuriganaText({ tokens }) {
  return (
    <>
      {(tokens ?? []).map((token, index) =>
        token.reading ? (
          <Fragment key={index}>
            <ruby>
              {token.text}
              <rt>{token.reading}</rt>
            </ruby>
          </Fragment>
        ) : (
          <Fragment key={index}>{token.text}</Fragment>
        )
      )}
    </>
  );
}
