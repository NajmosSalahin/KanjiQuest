import { QUIZ_SPRINT_SECONDS } from '@kanjigarden/shared';
import { cn } from '../../lib/cn.js';

/**
 * Sprint clock — prompt.md §7.6. The server owns the clock; the client only
 * counts down from the last `remainingMs` anchor it received.
 */

const FULL_MS = QUIZ_SPRINT_SECONDS * 1000;

export function SprintTimer({ remainingMs = FULL_MS, flash = null }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const percent = Math.max(0, Math.min(100, (remainingMs / FULL_MS) * 100));
  const low = remainingMs <= 10_000;

  return (
    <div data-testid="sprint-timer">
      <div className="flex items-end justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Sprint</span>
        <span
          role="timer"
          aria-label={`${seconds} seconds remaining`}
          className={cn(
            'font-mono text-2xl leading-none transition-colors duration-fast ease-out',
            flash === 'correct' && 'text-matcha',
            flash === 'wrong' && 'text-crimson',
            !flash && (low ? 'text-crimson' : 'text-ink-primary')
          )}
        >
          {seconds}s
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={cn(
            'h-full transition-[width,background-color] duration-100 ease-linear',
            flash === 'correct' && 'bg-matcha',
            flash === 'wrong' && 'bg-crimson',
            !flash && 'bg-vermillion'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
