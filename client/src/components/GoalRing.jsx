/**
 * Daily goal ring — §7.1: "circular progress ring, 64px diameter, 5px
 * stroke, background --border-subtle, fill --accent-vermillion. Center:
 * XP number (Geist Mono 20px) + 'XP' (ink-muted, text-xs)."
 */
export function GoalRing({ value, total, size = 64, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(value / total, 1) : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent-vermillion)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset var(--duration-normal) var(--ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-1">
        <span className="font-mono text-xl leading-none text-ink-primary">{value}</span>
        <span className="ml-0.5 text-xs leading-none text-ink-muted">XP</span>
      </div>
    </div>
  );
}
