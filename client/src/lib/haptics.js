/**
 * Haptics via the Vibration API. Gated by `preferences.hapticsEnabled`
 * (default off) in `feedback.js`; unsupported devices no-op.
 */

const PATTERNS = {
  correct: 12,
  wrong: [18, 40, 18],
  tap: 8,
  reward: [12, 30, 12, 30, 24],
  purchase: [10, 25, 10],
  undo: 10,
};

export function vibrate(name) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  const pattern = PATTERNS[name];
  if (!pattern) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const HAPTIC_CUES = Object.keys(PATTERNS);
