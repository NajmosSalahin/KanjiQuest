import { cn } from '../../lib/cn.js';

const variants = {
  primary: 'bg-vermillion text-white hover:bg-vermillion-hover',
  outline:
    'bg-surface border border-line-subtle text-ink-primary hover:border-vermillion hover:text-vermillion',
  ghost: 'bg-transparent text-ink-secondary hover:bg-subtle hover:text-ink-primary',
  // SRS rating colors (§3.1) — review buttons only (§7.2)
  again: 'bg-surface border border-crimson text-crimson hover:bg-crimson hover:text-white',
  hard: 'bg-surface border border-persimmon text-persimmon hover:bg-persimmon hover:text-white',
  good: 'bg-surface border border-matcha text-matcha hover:bg-matcha hover:text-white',
  easy: 'bg-surface border border-indigo text-indigo hover:bg-indigo hover:text-white',
};

const sizes = {
  md: 'px-4 py-2',
  lg: 'px-5 py-3',
  block: 'w-full px-4 py-3',
};

/**
 * Button — §3.4 radius 6px, weight 500, no pill shapes.
 */
export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium',
        'transition-colors duration-fast ease-out',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
