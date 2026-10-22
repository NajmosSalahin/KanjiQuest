/**
 * Audio via the Web Speech API (§0.1 Q3 — zero binary assets).
 * ja-JP synthesis for readings and sentences; returns false where unsupported
 * (e.g. jsdom in tests) so callers can no-op quietly.
 */
export function speakJa(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (!text) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
