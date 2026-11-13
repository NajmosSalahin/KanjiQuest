import { cn } from '../../lib/cn.js';

const sizes = {
  28: 'h-7 w-7 text-[10px]',
  32: 'h-8 w-8 text-[11px]',
  128: 'h-32 w-32 text-2xl',
};

/**
 * Store avatar frames (D17) — custom line-art rings. The profile stores the
 * item id (`frame-sakura`); accept either the id or the short value.
 */
function FrameOverlay({ frame }) {
  const name = String(frame ?? '').replace(/^frame-/, '');
  if (!['sakura', 'take', 'tsuki'].includes(name)) return null;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)]"
      aria-hidden="true"
      fill="none"
    >
      {name === 'sakura' ? (
        <g stroke="var(--accent-vermillion)" strokeWidth="2.5">
          <circle cx="50" cy="50" r="47" />
          <g fill="var(--accent-vermillion)" stroke="none" opacity="0.9">
            <circle cx="72" cy="22" r="3" />
            <circle cx="82" cy="30" r="2.4" />
            <circle cx="67" cy="31" r="2.2" />
            <circle cx="26" cy="74" r="2.4" />
            <circle cx="34" cy="82" r="2" />
          </g>
          <path d="M70 27c3-5 7-7 11-7" strokeLinecap="round" strokeWidth="1.5" opacity="0.7" />
        </g>
      ) : null}
      {name === 'take' ? (
        <g stroke="var(--success-matcha)" strokeWidth="2.5">
          <circle cx="50" cy="50" r="47" />
          <path d="M50 3v9M50 88v9M3 50h9M88 50h9" strokeLinecap="round" strokeWidth="2" />
          <path
            d="M20 20l6 6M80 20l-6 6M20 80l6-6M80 80l-6-6"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
      ) : null}
      {name === 'tsuki' ? (
        <g stroke="var(--accent-indigo)" strokeWidth="2.5">
          <circle cx="50" cy="50" r="47" />
          <path
            d="M68 16a15 15 0 100 22 14 14 0 0113-22h-13z"
            fill="var(--accent-indigo)"
            stroke="none"
            opacity="0.85"
            transform="translate(2 0)"
          />
          <circle cx="28" cy="72" r="1.6" fill="var(--accent-indigo)" stroke="none" />
          <circle cx="38" cy="82" r="1.2" fill="var(--accent-indigo)" stroke="none" />
        </g>
      ) : null}
    </svg>
  );
}

/** Avatar — circle, pill radius allowed (§3.4), 1px border (§7 chrome). */
export function Avatar({ size = 32, name = '', src, frame, className, ...props }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span className={cn('relative inline-flex shrink-0', className)} {...props}>
      <FrameOverlay frame={frame} />
      <span
        className={cn(
          'flex select-none items-center justify-center overflow-hidden rounded-full border border-line-strong',
          'bg-subtle font-semibold text-ink-secondary',
          sizes[size]
        )}
      >
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials || '—'}
      </span>
    </span>
  );
}
