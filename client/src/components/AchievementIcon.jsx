/**
 * Achievement icons — §11.3: "Each has a custom 24×24 SVG icon, 2 colors
 * max (vermillion + ink), 1.5px stroke" (§3.7). One hand-drawn line motif
 * per achievement; the registry is keyed by achievement id.
 */

const INK = 'var(--ink-primary)';
const RED = 'var(--accent-vermillion)';

function Ink({ d }) {
  return (
    <path
      d={d}
      stroke={INK}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}
function Red({ d, fill = 'none' }) {
  return (
    <path
      d={d}
      stroke={RED}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={fill}
    />
  );
}
function Dot({ cx, cy, r = 1.5, fill = RED }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} />;
}
function Ring({ cx, cy, r, stroke = INK, dash }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={stroke}
      strokeWidth="1.5"
      fill="none"
      strokeDasharray={dash}
    />
  );
}

const ICONS = {
  // — Learning —
  hajimemashite: (
    <>
      <Ink d="M4 20h16M12 20v-6" />
      <Red d="M12 16c-3 0-4.6-1.9-4.6-4.6 2.9 0 4.6 1.9 4.6 4.6zM12 14.5c2.7-.4 4.1-2.4 3.7-5.1-2.7.4-4.1 2.4-3.7 5.1z" />
    </>
  ),
  juren: (
    <>
      <Dot cx={4} cy={9} />
      <Dot cx={8.7} cy={9} />
      <Dot cx={13.3} cy={9} />
      <Dot cx={18} cy={9} />
      <Dot cx={21.5} cy={9} r={1.2} />
      <Dot cx={4} cy={14} />
      <Dot cx={8.7} cy={14} />
      <Dot cx={13.3} cy={14} />
      <Dot cx={18} cy={14} />
      <Dot cx={21.5} cy={14} r={1.2} />
      <Ink d="M4 19h17.5" />
    </>
  ),
  kanpeki: (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Red d="M8 12.2l2.7 2.7L16 9" />
    </>
  ),
  sokko: (
    <>
      <Ring cx={12} cy={13} r={7.5} />
      <Ink d="M12 5.5V3.5M9.5 3.5h5" />
      <Red d="M13 9.5l-4 4.5h2.6L11 18l4-5h-2.6z" fill={RED} />
    </>
  ),
  'mizu-no-nagare': (
    <>
      <Red d="M3 8c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
      <Ink d="M3 13c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
      <Red d="M3 18c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />
    </>
  ),
  hitsuwaza: (
    <>
      <Ink d="M15 4.5l4.5 4.5L11 17.5H6.5V13z" />
      <Ink d="M13 6.5l4 4" />
      <Red d="M4 20c1.5-2.5 3-3 5-4.5" />
    </>
  ),
  'kaite-miro': (
    <>
      <Ink d="M5 4.5h9.5L19 9v10.5H5z" />
      <Ink d="M14.5 4.5V9H19" />
      <Red d="M8 16l5-5 1.8 1.8-5 5H8z" />
      <Red d="M8 19h8" />
    </>
  ),

  // — Streak —
  kokoro: (
    <Red d="M12 20.2C9 18 4.5 14.6 4.5 10.6A4 4 0 0 1 12 8.4a4 4 0 0 1 7.5 2.2c0 4-4.5 7.4-7.5 9.6z" />
  ),
  tsuki: (
    <>
      <Red d="M14.5 3.8A8.6 8.6 0 1 0 20 17.5 9 9 0 0 1 14.5 3.8z" />
      <Dot cx={19} cy={6} r={1.2} />
    </>
  ),
  kaze: (
    <>
      <Ink d="M3 8h10.5a2.8 2.8 0 1 0-2.8-2.8" />
      <Red d="M3 12h14a2.8 2.8 0 1 1-2.8 2.8" />
      <Ink d="M3 16h8.5a2.6 2.6 0 1 1-2.6 2.6" />
    </>
  ),
  hitasura: (
    <>
      <Ink d="M12 19V5m0 0l-3.5 3.5M12 5l3.5 3.5" />
      <Dot cx={6} cy={21} r={1.2} />
      <Dot cx={12} cy={21} r={1.2} />
      <Dot cx={18} cy={21} r={1.2} />
    </>
  ),
  nanakusa: (
    <>
      <Ink d="M4 20h16" />
      <Ink d="M6.5 20c0-3-.5-5-1.5-6.5M9.5 20c0-3.5-.3-5.5-1-7M14.5 20c0-3.5.3-5.5 1-7M17.5 20c0-3 .5-5 1.5-6.5" />
      <Red d="M12 20c0-4.5 0-7 0-9.5" />
    </>
  ),
  misoka: (
    <>
      <Ink d="M4.5 5h15v14.5h-15zM4.5 9h15M8.5 3.5v3M15.5 3.5v3" />
      <Dot cx={9} cy={13} r={1.2} fill={INK} />
      <Dot cx={13} cy={13} r={1.2} fill={INK} />
      <Red d="M8 16h8" />
    </>
  ),

  // — Collection —
  mebae: (
    <>
      <Ink d="M12 20.5v-8" />
      <Red d="M12 15c-3.5 0-5.4-2.2-5.4-5.4 3.4 0 5.4 2.2 5.4 5.4zM12 13.5c3.1-.5 4.8-2.8 4.3-6-3.1.5-4.8 2.8-4.3 6z" />
    </>
  ),
  irodori: (
    <>
      <Red d="M4 18.5C7 17 9.5 13 10.5 6.5" />
      <Ink d="M8 20c4-1.5 7.5-5.5 9-13" />
      <Red d="M12.5 20.2c3-2 5.5-5 7-9.5" />
    </>
  ),
  hyakuji: (
    <>
      <Ink d="M6 3.5h8.5L18.5 8v12.5H6zM14.5 3.5V8h4" />
      <Red d="M9 11.5h6.5M9 15h6.5" />
    </>
  ),
  nihyakugoji: (
    <>
      <Ink d="M4 5.5h8v14H4z" />
      <Ink d="M9.5 3.5h8l3 3v14h-11" />
      <Red d="M12.5 9.5h5M12.5 13h5" />
    </>
  ),
  hayashi: (
    <>
      <Ink d="M8 20v-4.5M8 15.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z" />
      <Red d="M16.5 20v-3.5M16.5 16.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z" />
    </>
  ),
  senji: (
    <>
      {[6, 10.7, 15.3, 20].map((cy) =>
        [6, 10.7, 15.3, 20].map((cx) => <Dot key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.15} />)
      )}
      <Ink d="M3 12h.8M20.2 12H21" />
    </>
  ),

  // — Mastery —
  'n5-kansei': (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Ring cx={12} cy={12} r={6} dash="1 2.6" />
      <Dot cx={12} cy={12} r={2} />
    </>
  ),
  'n4-kansei': (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Ring cx={12} cy={12} r={6} dash="1 2.6" />
      <Red d="M9.5 12h5" />
    </>
  ),
  'n3-kansei': (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Ring cx={12} cy={12} r={6} dash="1 2.6" />
      <Red d="M9.5 10.5h5M9.5 13.5h5" />
    </>
  ),
  'n2-kansei': (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Ring cx={12} cy={12} r={6} dash="1 2.6" />
      <Red d="M12 9l3 5.2H9z" fill={RED} />
    </>
  ),
  'n1-kansei': (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Ring cx={12} cy={12} r={6} dash="1 2.6" />
      <Red d="M12 9l1 2.1 2.3.3-1.7 1.6.4 2.3L12 14.3l-2 1 .4-2.3-1.7-1.6 2.3-.3z" fill={RED} />
    </>
  ),
  sodachi: (
    <>
      <Ink d="M9 20.5v-4M9 16.5a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2z" />
      <Dot cx={17} cy={16} r={1.3} />
      <Dot cx={19.5} cy={12} r={1.3} />
      <Dot cx={21.5} cy={8} r={1.3} />
    </>
  ),
  wakaki: (
    <>
      <Ink d="M12 20.5v-6" />
      <Red d="M12 15c-3 0-4.7-2-4.7-4.7 3 0 4.7 2 4.7 4.7zM12 13.5c2.8-.4 4.3-2.5 3.9-5.3-2.9.4-4.3 2.5-3.9 5.3z" />
      <Ink d="M9.5 20.5h5" />
    </>
  ),
  shibami: (
    <>
      <Ink d="M2.5 19c0-2.7 1.8-4.7 4.2-4.7S11 16.3 11 19" />
      <Red d="M9 19c0-3.4 2.3-6 5.2-6s5.2 2.6 5.2 6" />
      <Ink d="M16.5 19c0-2 1.3-3.5 3-3.5s2 1.5 2 3.5" />
    </>
  ),
  shinrin: (
    <>
      <Ink d="M5 19.5v-3.5M5 16a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 5 16zM19 19.5v-3.5M19 16a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 19 16z" />
      <Red d="M12 21v-5M12 16a4.6 4.6 0 1 0 0-9.2A4.6 4.6 0 0 0 12 16z" />
    </>
  ),
  joryoku: (
    <>
      <Red d="M12 3l4.5 6h-9zM12 8l5.5 7.5h-11z" />
      <Ink d="M12 15.5v5M9 20.5h6" />
    </>
  ),
  zenshu: (
    <>
      <Ink d="M4 5.5h4v14H4zM9.5 5.5h4v14h-4z" />
      <Red d="M15 6.5l3.8 1L15.8 20l-3.8-1z" />
    </>
  ),

  // — Special —
  ippo: (
    <>
      <Dot cx={8} cy={15.5} r={3.2} />
      <Ink d="M13.5 8.5H21m0 0l-3.2-3.2M21 8.5l-3.2 3.2" />
    </>
  ),
  tsuzuri: (
    <>
      <Ink d="M4 20L17 7M17 7l1.8-1.8M17 7l1.8 1.8" />
      <Red d="M7.5 11.5l2.5 2.5M10.5 8.5l2.5 2.5M13.5 5.5l2.5 2.5" />
    </>
  ),
  senkai: (
    <>
      <Red d="M20 12a8 8 0 1 1-2.4-5.7" />
      <Ink d="M17.8 2.5v4h-4" />
      <Dot cx={12} cy={12} r={1.6} fill={INK} />
    </>
  ),
  muso: (
    <>
      <Red d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
      <Red d="M5.2 5.2l3 3M15.8 15.8l3 3M18.8 5.2l-3 3M8.2 15.8l-3 3" />
      <Ring cx={12} cy={12} r={2.8} />
    </>
  ),
  hyakuten: (
    <>
      <Ink d="M5 4h14v16H5z" />
      <Red d="M8 11.8l2.6 2.6L16 8.6" />
      <Ink d="M8 17h8" />
    </>
  ),
  asagata: (
    <>
      <Ink d="M3 19h18M12 4v2.5M5.5 8l1.7 1.7M18.5 8l-1.7 1.7" />
      <Red d="M7.5 19a4.5 4.5 0 0 1 9 0" />
    </>
  ),
  yofukashi: (
    <>
      <Red d="M13.5 4.5A8 8 0 1 0 19 16.5 8.4 8.4 0 0 1 13.5 4.5z" />
      <Dot cx={19.5} cy={5.5} r={1.1} />
      <Dot cx={21} cy={10} r={0.9} fill={INK} />
      <Ink d="M3 20.5h18" />
    </>
  ),
  fukkatsu: (
    <>
      <Ink d="M7 20.5v-3h10v3M12 17.5v-3.5" />
      <Red d="M12 14c-2.6 0-4-1.7-4-4 2.6 0 4 1.7 4 4zM12 12.5c2.3-.4 3.6-2.1 3.2-4.5-2.4.4-3.6 2.1-3.2 4.5z" />
      <Red d="M19.5 4v3.5M17.75 5.75h3.5" />
    </>
  ),
  goukaku: (
    <>
      <Ink d="M6 4.5h12v15.5H6zM9 3h6v3H9z" />
      <Red d="M8.8 10l1.4 1.4 2.4-2.6M8.8 15l1.4 1.4 2.4-2.6" />
      <Ink d="M14.5 10h1.5M14.5 15h1.5" />
    </>
  ),
  itsutsu: (
    <>
      <Dot cx={6} cy={6} />
      <Dot cx={18} cy={6} />
      <Dot cx={6} cy={18} />
      <Dot cx={18} cy={18} />
      <Dot cx={12} cy={12} r={2.4} fill={INK} />
    </>
  ),
  mamori: (
    <>
      <Ink d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <Red d="M9 5.5L12 7.5l3-2M9 18.5l3-2 3 2M5.5 11l.3 3.2-2.8 1.6M18.5 11l-.3 3.2 2.8 1.6" />
    </>
  ),
};

/** Generic medallion for unknown ids (forward-safe). */
function FallbackIcon() {
  return (
    <>
      <Ring cx={12} cy={12} r={8.5} />
      <Dot cx={12} cy={12} r={2.2} />
    </>
  );
}

export function AchievementIcon({ id, size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {ICONS[id] ?? <FallbackIcon />}
    </svg>
  );
}

export const ACHIEVEMENT_ICON_IDS = Object.freeze(Object.keys(ICONS));
