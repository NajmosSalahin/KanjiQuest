import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sound.js', () => ({ playCue: vi.fn(() => true) }));
vi.mock('./haptics.js', () => ({ vibrate: vi.fn(() => true) }));

import { feedback } from './feedback.js';
import { playCue } from './sound.js';
import { vibrate } from './haptics.js';
import { useAuth } from '../stores/auth.js';

beforeEach(() => {
  playCue.mockClear();
  vibrate.mockClear();
});

describe('preference-gated feedback (§6.13)', () => {
  it('plays sound by default but never vibrates by default', () => {
    useAuth.setState({ user: { preferences: {} } });
    feedback('correct');
    expect(playCue).toHaveBeenCalledWith('correct');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('respects sound off and haptics on', () => {
    useAuth.setState({ user: { preferences: { soundEnabled: false, hapticsEnabled: true } } });
    feedback('wrong');
    expect(playCue).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith('wrong');
  });
});
