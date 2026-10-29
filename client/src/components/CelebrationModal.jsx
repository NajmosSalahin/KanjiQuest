import { motion } from 'framer-motion';
import { Modal } from './ui/Modal.jsx';
import { StreakLeaf } from './StreakLeaf.jsx';
import { LEVEL_TITLES } from '@kanjigarden/shared';

/**
 * Celebration — §11.2 level-up ("custom SVG: garden grows one stage, level
 * number in Fraunces 700 text-6xl, title below, 'New title unlocked' if
 * applicable") and §11.4 streak milestones (7/30/100 trigger achievements +
 * a celebration). framer-motion is approved for celebrations only (§3.8).
 * Built on the shared Radix Modal so focus trap + Escape hold (§12).
 */

/** Garden stages for the level-up art — one growth step per tier. */
function GardenStageSvg({ stage }) {
  // stage 0..4 derived from level; art grows a stage each time.
  const treeHeight = 10 + stage * 7;
  const blossoms = stage >= 3;
  const petals = stage >= 4;
  return (
    <svg width={140} height={110} viewBox="0 0 140 110" fill="none" aria-hidden="true">
      <path d="M14 96h112" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d={`M70 96V${96 - treeHeight}`}
        stroke="var(--ink-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d={`M70 ${96 - treeHeight + 6}c-9 0-14-5.5-14-14 9.5 0 14 5.5 14 14z`}
        fill="var(--success-matcha)"
        opacity="0.9"
      />
      <path
        d={`M70 ${96 - treeHeight + 2}c8.5-1 13-6.5 12-15-9 1-13 6.5-12 15z`}
        fill="var(--success-matcha)"
        opacity="0.7"
      />
      {blossoms ? (
        <>
          <circle
            cx={58}
            cy={96 - treeHeight - 6}
            r={3}
            fill="var(--accent-vermillion)"
            opacity="0.85"
          />
          <circle
            cx={82}
            cy={96 - treeHeight - 3}
            r={2.5}
            fill="var(--accent-vermillion)"
            opacity="0.8"
          />
        </>
      ) : null}
      {petals ? (
        <>
          <circle cx={50} cy={80} r={1.5} fill="var(--accent-vermillion)" opacity="0.6" />
          <circle cx={92} cy={74} r={1.5} fill="var(--accent-vermillion)" opacity="0.6" />
          <circle
            cx={70}
            cy={96 - treeHeight - 14}
            r={1.5}
            fill="var(--accent-vermillion)"
            opacity="0.6"
          />
        </>
      ) : null}
      {/* soil mounds */}
      <path
        d="M46 96c4-4 10-4 14 0M80 96c4-4 10-4 14 0"
        stroke="var(--border-strong)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CelebrationModal({
  open,
  kind,
  level,
  title,
  newTitle,
  streakDays,
  achievement,
  onClose,
}) {
  const isLevelUp = kind === 'levelUp';

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={isLevelUp ? `Level ${level}` : `${streakDays}-day streak`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        className="flex flex-col items-center gap-3 text-center"
      >
        {isLevelUp ? (
          <>
            <GardenStageSvg stage={Math.min(Math.floor((level - 1) / 4), 4)} />
            <p className="font-display text-6xl font-bold leading-none text-ink-primary">{level}</p>
            <p className="text-lg text-ink-secondary">{title}</p>
            {newTitle ? (
              <p className="rounded-full bg-subtle px-3 py-1 text-xs font-medium text-matcha">
                New title unlocked
              </p>
            ) : null}
          </>
        ) : (
          <>
            <StreakLeaf streak={streakDays} size={72} />
            <p className="font-display text-3xl font-semibold text-ink-primary">
              {streakDays} days in a row
            </p>
            {achievement ? (
              <div className="flex items-center gap-2 rounded-control bg-subtle px-3 py-1.5 text-sm text-ink-primary">
                <span className="font-medium">{achievement.name}</span>
                <span className="text-ink-muted">({achievement.nameJa})</span>
                <span className="font-mono text-xs text-ink-muted">
                  +{achievement.rewardXP} XP
                  {achievement.rewardCoins ? ` · ${achievement.rewardCoins} coins` : ''}
                </span>
              </div>
            ) : null}
          </>
        )}
      </motion.div>
    </Modal>
  );
}

/** Titles differ? — powers the "New title unlocked" chip (§11.2). */
export function titleChanged(previousLevel, level) {
  return LEVEL_TITLES[previousLevel - 1] !== LEVEL_TITLES[level - 1];
}
