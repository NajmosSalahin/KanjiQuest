import { cn } from '../../lib/cn.js';

/**
 * Stroke-order tap question — prompt.md §7.6.
 * KanjiVG paths are rendered as individual hit targets; tapping one sends it
 * to the server, which owns the expected order. Numbered chips below show how
 * many strokes have been placed correctly.
 */

export function StrokeQuestion({
  question,
  taps = [],
  wrongStrokeId = null,
  disabled = false,
  complete = false,
  outcome = null,
  onTap,
}) {
  const placed = new Set(taps);
  const total = question.strokeCount || question.strokes.length;

  return (
    <section aria-labelledby="quiz-question" data-testid="quiz-stroke">
      <p
        id="quiz-question"
        className="text-center text-sm uppercase tracking-[0.12em] text-ink-secondary"
      >
        {question.question}
      </p>

      <div
        className={cn('mt-4 flex justify-center', wrongStrokeId && 'quiz-shake')}
        data-testid="stroke-stage"
      >
        <svg
          viewBox="0 0 109 109"
          role="group"
          aria-label={`Stroke-order kanji, ${total} strokes`}
          className="block h-auto w-full max-w-[300px] touch-none select-none"
        >
          {question.strokes.map((stroke, index) => {
            const isPlaced = placed.has(stroke.id);
            const isWrong = wrongStrokeId === stroke.id;
            return (
              <g key={stroke.id}>
                {/* Wide invisible target keeps the 3px KanjiVG paths tappable. */}
                <path
                  d={stroke.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  strokeLinecap="round"
                  role="button"
                  tabIndex={disabled || complete ? -1 : 0}
                  aria-label={`Stroke ${index + 1}`}
                  aria-disabled={disabled || complete}
                  className="cursor-pointer"
                  onClick={() => {
                    if (!disabled && !complete) onTap(stroke.id);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && !disabled && !complete) {
                      event.preventDefault();
                      onTap(stroke.id);
                    }
                  }}
                />
                <path
                  d={stroke.d}
                  fill="none"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    'pointer-events-none quiz-stroke',
                    isPlaced && 'quiz-stroke-tapped',
                    isWrong && 'quiz-stroke-wrong'
                  )}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-control border font-mono text-xs',
              index < taps.length
                ? 'border-vermillion bg-vermillion text-white'
                : 'border-line-subtle bg-surface text-ink-muted'
            )}
          >
            {index + 1}
          </span>
        ))}
      </div>

      <p
        className={cn(
          'mt-3 text-center font-mono text-xs',
          complete && outcome ? 'text-matcha' : complete ? 'text-crimson' : 'text-ink-muted'
        )}
      >
        {complete
          ? outcome
            ? 'Correct'
            : 'Not quite'
          : `${taps.length} of ${total} strokes · tap in order`}
      </p>
    </section>
  );
}
