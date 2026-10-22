import { describe, it, expect } from 'vitest';
import { htmlToTokens } from '../src/services/furigana.js';

/**
 * Render-time furigana (§5.4): kuroshiro HTML -> safe token arrays. The real
 * analyzer init is exercised in E2E; these cover the parsing contract the
 * client's <ruby> rendering depends on.
 */
describe('htmlToTokens', () => {
  it('splits kuroshiro ruby markup into text/reading tokens', () => {
    expect(htmlToTokens('<ruby>漢字<rt>かんじ</rt></ruby>です')).toEqual([
      { text: '漢字', reading: 'かんじ' },
      { text: 'です' },
    ]);
  });

  it('keeps plain segments intact and interleaves multiple rubies', () => {
    expect(htmlToTokens('私は<ruby>学生<rt>がくせい</rt></ruby>です。')).toEqual([
      { text: '私は' },
      { text: '学生', reading: 'がくせい' },
      { text: 'です。' },
    ]);
  });

  it('returns one plain token without ruby markup', () => {
    expect(htmlToTokens('水')).toEqual([{ text: '水' }]);
  });

  it('returns an empty array for empty input', () => {
    expect(htmlToTokens('')).toEqual([]);
  });
});
