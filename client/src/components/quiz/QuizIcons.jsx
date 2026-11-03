/**
 * Quiz hub icons — prompt.md §7.5 (96px, minimal line, vermillion + ink).
 * Each icon is a 96×96 inline SVG so it inherits the card's currentColor
 * for ink and uses `--accent-vermillion` for the single accent stroke.
 */

const base = {
  width: 96,
  height: 96,
  viewBox: '0 0 96 96',
  fill: 'none',
  'aria-hidden': true,
  focusable: false,
};

const ink = 'var(--ink-primary)';
const accent = 'var(--accent-vermillion)';
const strokeProps = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function MeaningIcon() {
  return (
    <svg {...base}>
      <rect x="16" y="18" width="64" height="60" rx="6" stroke={ink} {...strokeProps} />
      <path d="M28 34h24M28 44h40M28 54h32M28 64h18" stroke={ink} {...strokeProps} />
      <path d="M60 30l8 8-8 8" stroke={accent} {...strokeProps} />
    </svg>
  );
}

function ReadingIcon() {
  return (
    <svg {...base}>
      <path
        d="M18 30a8 8 0 0 1 8-8h44a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H40l-14 12V64h-0a8 8 0 0 1-8-8V30z"
        stroke={ink}
        {...strokeProps}
      />
      <text
        x="30"
        y="50"
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 20,
          fill: ink,
        }}
      >
        音
      </text>
      <text
        x="52"
        y="56"
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 10,
          fill: accent,
        }}
      >
        おん
      </text>
    </svg>
  );
}

function StrokeIcon() {
  return (
    <svg {...base}>
      <path d="M22 74h52" stroke={ink} {...strokeProps} />
      <path d="M32 62c6-14 12-24 20-34" stroke={ink} {...strokeProps} />
      <path d="M50 28l10-8 8 6-8 10-10-8z" stroke={accent} {...strokeProps} />
      <path d="M24 40h14M30 52h20M42 64h22" stroke={ink} {...strokeProps} />
      <circle cx="70" cy="24" r="3" fill={accent} />
    </svg>
  );
}

function DrawingIcon() {
  return (
    <svg {...base}>
      <rect x="16" y="16" width="54" height="54" rx="5" stroke={ink} {...strokeProps} />
      <path d="M26 58l8-20 10 8 8-12 8 24" stroke={accent} {...strokeProps} />
      <path d="M62 70l14-14 6 6-14 14-8 2 2-8z" stroke={ink} {...strokeProps} />
    </svg>
  );
}

function SprintIcon() {
  return (
    <svg {...base}>
      <circle cx="44" cy="52" r="26" stroke={ink} {...strokeProps} />
      <path d="M44 52V36M44 52l11 7" stroke={accent} {...strokeProps} />
      <path d="M36 18h16M44 18v8M72 30l5-5M78 46h6" stroke={ink} {...strokeProps} />
      <path d="M74 58l8 4M68 70l5 6" stroke={accent} {...strokeProps} />
    </svg>
  );
}

export const QUIZ_MODE_INFO = Object.freeze({
  meaning: {
    title: 'Meaning quiz',
    description: 'Pick the correct meaning for a kanji.',
    Icon: MeaningIcon,
  },
  reading: {
    title: 'Reading match',
    description: 'Pick the correct on-yomi or kun-yomi.',
    Icon: ReadingIcon,
  },
  stroke: {
    title: 'Stroke order',
    description: 'Tap the strokes in the correct order.',
    Icon: StrokeIcon,
  },
  drawing: {
    title: 'Drawing canvas',
    description: 'Draw the kanji from memory.',
    Icon: DrawingIcon,
  },
  sprint: {
    title: '60-second sprint',
    description: 'Mixed modes, each correct answer adds 3 seconds.',
    Icon: SprintIcon,
  },
});

export function QuizModeIcon({ mode, size = 96 }) {
  const info = QUIZ_MODE_INFO[mode];
  if (!info) return null;
  return (
    <span style={{ width: size, height: size, display: 'inline-block' }}>
      <info.Icon />
    </span>
  );
}
