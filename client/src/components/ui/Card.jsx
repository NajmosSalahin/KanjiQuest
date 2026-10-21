import { cn } from '../../lib/cn.js';

/** Card — surface, 1px subtle border, 8px radius, shadow-sm (§3.4/§3.5). */
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-card border border-line-subtle bg-surface p-6 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}
