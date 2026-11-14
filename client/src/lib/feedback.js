import { useAuth } from '../stores/auth.js';
import { playCue } from './sound.js';
import { vibrate } from './haptics.js';

/**
 * Preference-aware feedback bridge (§6.13): sound defaults on, haptics
 * defaults off. Call sites stay declarative: `feedback('correct')`.
 */
export function feedback(name) {
  const preferences = useAuth.getState().user?.preferences;
  const result = { sound: false, haptic: false };

  if (preferences?.soundEnabled !== false) {
    result.sound = playCue(name);
  }
  if (preferences?.hapticsEnabled === true) {
    result.haptic = vibrate(name);
  }
  return result;
}
