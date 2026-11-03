import { useEffect, useRef, useState } from 'react';
import { QUIZ_DRAWING } from '@kanjigarden/shared';

/**
 * Drawing canvas — prompt.md §7.6 / DECISIONS.md D14.
 *
 * Pointer strokes are normalized client-side to the 0–300 canvas box the
 * server's scoring contract expects. React owns the committed stroke list;
 * the stroke currently under the pointer stays local so pointermove never
 * re-renders the whole session screen.
 */

const SIZE = QUIZ_DRAWING.CANVAS_SIZE;
const MIN_STEP = 1.5; // canvas units; drops jitter without thinning real lines

function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function drawGrid(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = cssVar('--border-subtle', '#d8d2c8');
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const at = (SIZE / 10) * i;
    ctx.beginPath();
    ctx.moveTo(at, 0);
    ctx.lineTo(at, SIZE);
    ctx.moveTo(0, at);
    ctx.lineTo(SIZE, at);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStroke(ctx, points) {
  if (!points || points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = cssVar('--ink-primary', '#1a1713');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function DrawingCanvas({
  strokes,
  onChange,
  disabled = false,
  overlay = null,
  clearKey = 0,
}) {
  const canvasRef = useRef(null);
  const strokesRef = useRef(strokes);
  const currentRef = useRef(null);
  const drawingRef = useRef(false);
  const [current, setCurrent] = useState(null);

  strokesRef.current = strokes;

  useEffect(() => {
    currentRef.current = null;
    drawingRef.current = false;
    setCurrent(null);
  }, [clearKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return; // jsdom: drawing tests stub getContext
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawGrid(ctx);
    for (const stroke of strokes) drawStroke(ctx, stroke);
    if (current) drawStroke(ctx, current);
  }, [strokes, current, clearKey]);

  function pointFromEvent(event) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * SIZE;
    return {
      x: Math.max(0, Math.min(SIZE, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(SIZE, Math.round(y * 10) / 10)),
    };
  }

  function start(event) {
    if (disabled) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    currentRef.current = [point];
    setCurrent([point]);
  }

  function move(event) {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const points = currentRef.current ?? [];
    const last = points[points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_STEP) return;
    currentRef.current = [...points, point];
    setCurrent(currentRef.current);
  }

  function finish() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = currentRef.current ?? [];
    currentRef.current = null;
    setCurrent(null);
    if (points.length > 0) onChange([...strokesRef.current, points]);
  }

  return (
    <div
      className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-control border border-line-subtle bg-surface"
      style={{ aspectRatio: '1 / 1' }}
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        data-testid="drawing-canvas"
        role="img"
        aria-label="Drawing canvas. Draw the kanji from memory, then check your drawing."
        className="block h-full w-full touch-none"
        style={{ cursor: disabled ? 'default' : 'crosshair' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      />
      {overlay?.length ? (
        <svg
          viewBox="0 0 109 109"
          aria-hidden="true"
          data-testid="drawing-overlay"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: 0.3 }}
        >
          {overlay.map((stroke) => (
            <path
              key={stroke.id}
              d={stroke.d}
              fill="none"
              stroke="var(--ink-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
