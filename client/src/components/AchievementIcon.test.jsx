import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { AchievementIcon, ACHIEVEMENT_ICON_IDS } from './AchievementIcon.jsx';

/** §11.3: every achievement has a custom 24×24 two-color icon (D11: 41). */

const CANONICAL_IDS = [
  // learning (7)
  'hajimemashite',
  'juren',
  'kanpeki',
  'sokko',
  'mizu-no-nagare',
  'hitsuwaza',
  'kaite-miro',
  // streak (6)
  'kokoro',
  'tsuki',
  'kaze',
  'hitasura',
  'nanakusa',
  'misoka',
  // collection (6)
  'mebae',
  'irodori',
  'hyakuji',
  'nihyakugoji',
  'hayashi',
  'senji',
  // mastery (11)
  'n5-kansei',
  'n4-kansei',
  'n3-kansei',
  'n2-kansei',
  'n1-kansei',
  'sodachi',
  'wakaki',
  'shibami',
  'shinrin',
  'joryoku',
  'zenshu',
  // special (11)
  'ippo',
  'tsuzuri',
  'senkai',
  'muso',
  'hyakuten',
  'asagata',
  'yofukashi',
  'fukkatsu',
  'goukaku',
  'itsutsu',
  'mamori',
];

describe('AchievementIcon (§11.3)', () => {
  it('has an icon for all 41 D11 achievement ids', () => {
    expect(CANONICAL_IDS).toHaveLength(41);
    expect(ACHIEVEMENT_ICON_IDS).toHaveLength(41);
    expect(ACHIEVEMENT_ICON_IDS).toEqual(expect.arrayContaining(CANONICAL_IDS));
  });

  it('renders drawn svg content for known ids and a medallion fallback otherwise', () => {
    const { container, rerender } = render(<AchievementIcon id="kokoro" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('svg path')).toBeTruthy();

    rerender(<AchievementIcon id="unknown-future-id" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });
});
