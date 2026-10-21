import { cn } from '../../lib/cn.js';

/**
 * Skeleton — every async state uses these; "Loading..." text is banned (§2.12).
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-card bg-subtle', className)}
      {...props}
    />
  );
}
