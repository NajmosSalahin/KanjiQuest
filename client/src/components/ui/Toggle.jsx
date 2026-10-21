import { cn } from '../../lib/cn.js';

/**
 * Toggle — role="switch" button (never a div, §12). Rectangular geometry:
 * anti-slop rule 6 reserves pills for tags/avatars only.
 */
export function Toggle({ checked, onChange, label, id, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-10 shrink-0 rounded-control border transition-colors duration-fast ease-out',
        checked ? 'border-vermillion bg-vermillion' : 'border-line-strong bg-subtle'
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[2px] top-[2px] h-4 w-4 rounded-[4px] bg-surface shadow-sm',
          'transition-transform duration-fast ease-out',
          checked && 'translate-x-[18px]'
        )}
      />
    </button>
  );
}
