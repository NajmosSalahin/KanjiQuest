import { Link } from 'react-router-dom';
import { Button } from './Button.jsx';
import { cn } from '../../lib/cn.js';

/**
 * EmptyState (§2.9): specific SVG + headline naming the missing thing +
 * one-line explanation + specific CTA. Default = the dashboard's empty
 * garden (§7.1) using exact spec copy.
 */

/** Seed sprouting — minimal line art, 2 colors, 1.5px stroke (§3.7). */
function SeedSproutSvg({ size = 200, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M30 168h140" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M100 168v-56" stroke="var(--ink-primary)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M100 124c-20 0-34-12-36-32 22-2 36 10 36 32z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M100 112c18-4 28-18 26-36-20 4-30 16-26 36z"
        stroke="var(--accent-vermillion)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M84 168c0-14 7-24 16-24s16 10 16 24"
        stroke="var(--ink-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({
  svg,
  headline,
  description,
  action,
  className,
  svgSize,
  compact = false,
}) {
  const resolvedSvgSize = svgSize ?? (compact ? 96 : 200);
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-line-subtle bg-surface text-center shadow-sm',
        compact ? 'gap-3 p-5' : 'gap-4 p-10',
        className
      )}
    >
      {svg ?? <SeedSproutSvg size={resolvedSvgSize} />}
      <h2
        className={cn(
          'font-display font-medium text-ink-primary',
          compact ? 'text-base' : 'text-2xl'
        )}
      >
        {headline}
      </h2>
      {description ? (
        <p
          className={cn('text-sm text-ink-secondary', compact ? 'max-w-[340px]' : 'max-w-[400px]')}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        action.to ? (
          <Link
            to={action.to}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-vermillion px-4 py-2 text-sm font-medium text-white transition-colors duration-fast ease-out hover:bg-vermillion-hover"
          >
            {action.label}
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      ) : null}
    </div>
  );
}
