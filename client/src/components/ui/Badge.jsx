import { cn } from '../../lib/cn.js';

const variants = {
  neutral: 'bg-subtle border-line-subtle text-ink-muted',
  success: 'bg-subtle border-matcha text-matcha',
  danger: 'bg-subtle border-crimson text-crimson',
  indigo: 'bg-subtle border-indigo text-indigo',
};

/** Badge/tag — pill radius allowed (§3.4). */
export function Badge({ variant = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
