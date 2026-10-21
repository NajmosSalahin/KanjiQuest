import { cn } from '../../lib/cn.js';

const sizes = {
  28: 'h-7 w-7 text-[10px]',
  32: 'h-8 w-8 text-[11px]',
  128: 'h-32 w-32 text-2xl',
};

/** Avatar — circle, pill radius allowed (§3.4), 1px border (§7 chrome). */
export function Avatar({ size = 32, name = '', src, className, ...props }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'flex select-none items-center justify-center overflow-hidden rounded-full border border-line-strong',
        'bg-subtle font-semibold text-ink-secondary',
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials || '—'}
    </span>
  );
}
