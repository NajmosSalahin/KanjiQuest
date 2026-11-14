/**
 * Sound effects generated at runtime with the Web Audio API (kickoff Q5 /
 * §2.3 — no binary assets). Every call is best-effort: unsupported browsers
 * and jsdom no-op quietly. Preference gating lives in `feedback.js`.
 */

let audioContext = null;

const CUES = {
  correct: [
    [659.25, 0, 0.09],
    [880, 0.08, 0.14],
  ],
  wrong: [[196, 0, 0.16, 'triangle']],
  again: [[220, 0, 0.12, 'triangle']],
  tap: [[440, 0, 0.045]],
  reward: [
    [523.25, 0, 0.09],
    [659.25, 0.08, 0.09],
    [783.99, 0.16, 0.18],
  ],
  purchase: [
    [880, 0, 0.07],
    [1174.66, 0.07, 0.12],
  ],
  undo: [
    [440, 0, 0.08],
    [329.63, 0.07, 0.12, 'triangle'],
  ],
};

function getContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext || audioContext.state === 'closed') {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/** Plays a short cue. Returns false when the browser cannot synthesize audio. */
export function playCue(name) {
  const notes = CUES[name];
  if (!notes) return false;
  const ctx = getContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const start = ctx.currentTime + 0.01;
    for (const [frequency, offset, duration, type = 'sine'] of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.045, start + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

export const SOUND_CUES = Object.keys(CUES);
