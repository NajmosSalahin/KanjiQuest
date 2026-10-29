/**
 * Streak card leaf — §7.1: "custom SVG leaf, 32px. Filled --success-matcha
 * if streak > 0, outlined --ink-muted if 0. Tiered growth: 1–6 = single
 * leaf; 7–13 = leaf pair; 14–29 = small branch; 30+ = branch with blossom;
 * 100+ = branch with blossoms + petals."
 */

const MATCHA = 'var(--success-matcha)';
const MUTED = 'var(--ink-muted)';

export function streakTier(streak) {
  if (streak <= 0) return 0;
  if (streak <= 6) return 1;
  if (streak <= 13) return 2;
  if (streak <= 29) return 3;
  if (streak < 100) return 4;
  return 5;
}

function Blossom({ cx, cy, r = 3, petals = 5 }) {
  const nodes = [];
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    nodes.push(
      <circle
        key={i}
        cx={cx + Math.cos(angle) * r}
        cy={cy + Math.sin(angle) * r}
        r={r * 0.72}
        fill="var(--accent-vermillion)"
        opacity="0.85"
      />
    );
  }
  nodes.push(<circle key="core" cx={cx} cy={cy} r={r * 0.55} fill="var(--accent-vermillion)" />);
  return <g>{nodes}</g>;
}

export function StreakLeaf({ streak, size = 32 }) {
  const tier = streakTier(streak);
  const alive = streak > 0;
  const stroke = alive ? MATCHA : MUTED;
  const leafFill = alive ? MATCHA : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {tier === 0 ? (
        // Withered sprout — outlined only.
        <path
          d="M16 27v-8M16 21c-3.5 0-5.5-2.2-5.5-5.5 3.6 0 5.5 2.2 5.5 5.5z"
          stroke={MUTED}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          {/* Stem / branch grows with the tier. */}
          {tier === 1 ? (
            <path d="M16 27v-9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path
              d={tier >= 3 ? 'M9 28c4-3 6-8 7-14 1 6 3 11 7 14' : 'M16 28c0-6 0-10 0-14'}
              stroke={stroke}
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Leaf(s) */}
          <path
            d="M16 20c-4 0-6.2-2.5-6.2-6.2 4.1 0 6.2 2.5 6.2 6.2z"
            fill={leafFill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {tier >= 2 ? (
            <path
              d="M16 17.5c3.7-.6 5.7-3.2 5.1-7-3.8.6-5.7 3.2-5.1 7z"
              fill={leafFill}
              stroke={stroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Branch leaves for tier 3+ */}
          {tier >= 3 ? (
            <>
              <path
                d="M10.5 17c-2.6-.5-4-2.3-3.6-5 2.7.5 4 2.3 3.6 5z"
                fill={leafFill}
                stroke={stroke}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M21.5 17c2.6-.5 4-2.3 3.6-5-2.7.5-4 2.3-3.6 5z"
                fill={leafFill}
                stroke={stroke}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {/* Blossom(s) at 30+/100+ */}
          {tier >= 4 ? <Blossom cx={16} cy={8.5} r={2.6} /> : null}
          {tier >= 5 ? (
            <>
              <Blossom cx={8} cy={11} r={1.9} petals={5} />
              <Blossom cx={24} cy={10} r={1.9} petals={5} />
              {/* falling petals */}
              <circle cx={5.5} cy={17} r={1} fill="var(--accent-vermillion)" opacity="0.6" />
              <circle cx={26.5} cy={16} r={1} fill="var(--accent-vermillion)" opacity="0.6" />
              <circle cx={12.5} cy={4.5} r={0.9} fill="var(--accent-vermillion)" opacity="0.6" />
            </>
          ) : null}
        </>
      )}
    </svg>
  );
}
