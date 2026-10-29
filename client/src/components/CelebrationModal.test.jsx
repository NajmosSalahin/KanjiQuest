import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CelebrationModal, titleChanged } from './CelebrationModal.jsx';

/** Celebration (§11.2 level-up, §11.4 streak milestones) — framer-motion is
 *  approved for exactly this (§3.8); built on the shared Radix Modal. */

describe('CelebrationModal (§11.2 / §11.4)', () => {
  it('renders the level-up variant: big level number, title, new-title chip', () => {
    render(
      <CelebrationModal
        open
        kind="levelUp"
        level={5}
        title="Young Tree"
        newTitle
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Level 5' })).toBeTruthy();
    expect(screen.getByText('Young Tree')).toBeTruthy();
    expect(screen.getByText('New title unlocked')).toBeTruthy();
  });

  it('omits the new-title chip when the title did not change', () => {
    render(
      <CelebrationModal
        open
        kind="levelUp"
        level={6}
        title="Bough"
        newTitle={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText('New title unlocked')).toBeNull();
  });

  it('renders the streak milestone variant with the folded achievement + rewards', () => {
    render(
      <CelebrationModal
        open
        kind="streak"
        streakDays={7}
        achievement={{
          id: 'kokoro',
          name: 'Kokoro',
          nameJa: '\u5fc3',
          rewardXP: 100,
          rewardCoins: 20,
        }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: '7-day streak' })).toBeTruthy();
    expect(screen.getByText('7 days in a row')).toBeTruthy();
    expect(screen.getByText('Kokoro')).toBeTruthy();
    expect(screen.getByText('(\u5fc3)')).toBeTruthy();
    expect(screen.getByText('+100 XP \u00b7 20 coins')).toBeTruthy();
  });

  it('titleChanged detects level-title boundaries (§11.2 "if applicable")', () => {
    expect(titleChanged(1, 2)).toBe(true); // Seedling -> Sprout
    expect(titleChanged(4, 5)).toBe(true); // Sapling -> Young Tree
  });
});
