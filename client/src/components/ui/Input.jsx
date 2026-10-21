import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Input — always has a <label> (§12); error state = crimson border +
 * crimson message with alert-circle icon (§7.11).
 */
export const Input = forwardRef(function Input(
  { id, label, error, hint, className, ...props },
  ref
) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-primary">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink-primary',
          'placeholder:text-ink-muted transition-colors duration-fast ease-out',
          error ? 'border-crimson' : 'border-line-subtle hover:border-line-strong',
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-crimson">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
});
